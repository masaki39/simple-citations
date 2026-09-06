import { Platform } from "obsidian";
import { tryRequireNode } from "./nodeModules";

/**
 * Locate the user's Downloads folder so the settings tab can fill the export
 * folder in with one click. The path differs by platform and can be relocated:
 *
 * - macOS: always `~/Downloads` on disk, even when Finder shows a localized name.
 * - Linux: the XDG spec lets the user move it — `~/.config/user-dirs.dirs` holds
 *   `XDG_DOWNLOAD_DIR`; fall back to `~/Downloads`.
 * - Windows: relocatable via the registry (`User Shell Folders`, known-folder
 *   GUID `{374DE290-…}`); fall back to `%USERPROFILE%\Downloads`.
 *
 * Desktop only — guard call sites with `Platform.isDesktop`.
 */

type FsModule = typeof import("fs");
type OsModule = typeof import("os");
type ChildProcess = typeof import("child_process");

/** Known-folder GUID for the Downloads directory. */
const WINDOWS_DOWNLOADS_GUID = "{374DE290-123F-4565-9164-39C4925E467B}";

export interface DownloadsProbe {
	/** Absolute path to an existing Downloads folder, or `null`. */
	path: string | null;
	/** Human-readable trace of what was attempted (for troubleshooting). */
	diagnostics: string[];
}

function homeDir(): string | null {
	const os = tryRequireNode<OsModule>("os");
	if (os.ok) {
		try {
			const home = os.module.homedir();
			if (home) return home;
		} catch {
			/* fall through to env */
		}
	}
	return process.env.HOME || process.env.USERPROFILE || null;
}

/** True when `target` exists and is a directory. */
export function directoryExists(target: string): boolean {
	const fs = tryRequireNode<FsModule>("fs");
	if (!fs.ok) return false;
	try {
		return fs.module.statSync(target).isDirectory();
	} catch {
		return false;
	}
}

function readFileText(target: string): string | null {
	const fs = tryRequireNode<FsModule>("fs");
	if (!fs.ok) return null;
	try {
		return fs.module.readFileSync(target, "utf8");
	} catch {
		return null;
	}
}

/** Run `command args` synchronously, returning stdout or `null` if it did not run. */
function runSync(command: string, args: string[]): string | null {
	const cp = tryRequireNode<ChildProcess>("child_process");
	if (!cp.ok) return null;
	try {
		return cp.module.execFileSync(command, args, {
			encoding: "utf8",
			timeout: 4000,
			windowsHide: true,
			stdio: ["ignore", "pipe", "ignore"],
		});
	} catch {
		return null;
	}
}

/**
 * Parse a `user-dirs.dirs` file for `XDG_DOWNLOAD_DIR`. The value is shell-quoted
 * and usually written relative to `$HOME`, e.g. `XDG_DOWNLOAD_DIR="$HOME/Downloads"`.
 */
export function parseXdgUserDirs(contents: string, home: string): string | null {
	for (const rawLine of contents.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line.startsWith("#")) continue;
		const match = line.match(/^XDG_DOWNLOAD_DIR\s*=\s*"?(.*?)"?\s*$/);
		if (!match) continue;
		let value = match[1];
		if (!value) return null;
		value = value.replace(/^\$HOME\b/, home).replace(/^~(?=\/|$)/, home);
		return value || null;
	}
	return null;
}

/** Expand `%VAR%` references in a Windows path using `env`. */
export function expandWindowsEnv(value: string, env: NodeJS.ProcessEnv): string {
	return value.replace(/%([^%]+)%/g, (whole, name: string) => env[name] ?? whole);
}

/**
 * Pull a value out of `reg query` output. Lines look like:
 * `    {374DE290-…}    REG_EXPAND_SZ    %USERPROFILE%\Downloads`
 */
export function parseRegQueryOutput(output: string, valueName: string): string | null {
	for (const line of output.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed.startsWith(valueName)) continue;
		const match = trimmed.match(/\bREG_(?:EXPAND_)?SZ\b\s+(.+)$/);
		if (match) return match[1].trim() || null;
	}
	return null;
}

function detectWindows(home: string | null, diagnostics: string[]): string[] {
	const candidates: string[] = [];
	const output = runSync("reg", [
		"query",
		"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders",
		"/v",
		WINDOWS_DOWNLOADS_GUID,
	]);
	if (output) {
		const raw = parseRegQueryOutput(output, WINDOWS_DOWNLOADS_GUID);
		if (raw) {
			const expanded = expandWindowsEnv(raw, process.env);
			diagnostics.push(`registry: ${raw} -> ${expanded}`);
			candidates.push(expanded);
		} else {
			diagnostics.push("registry: value not found in output");
		}
	} else {
		diagnostics.push("registry: reg query did not run");
	}
	const profile = process.env.USERPROFILE || home;
	if (profile) candidates.push(`${profile}\\Downloads`);
	return candidates;
}

function detectLinux(home: string | null, diagnostics: string[]): string[] {
	const candidates: string[] = [];
	if (home) {
		const configHome = process.env.XDG_CONFIG_HOME || `${home}/.config`;
		const contents = readFileText(`${configHome}/user-dirs.dirs`);
		if (contents) {
			const fromXdg = parseXdgUserDirs(contents, home);
			if (fromXdg) {
				diagnostics.push(`user-dirs.dirs: ${fromXdg}`);
				candidates.push(fromXdg);
			} else {
				diagnostics.push("user-dirs.dirs: no XDG_DOWNLOAD_DIR entry");
			}
		} else {
			diagnostics.push("user-dirs.dirs: not readable");
		}
		candidates.push(`${home}/Downloads`);
	}
	return candidates;
}

/** Best guess at the user's Downloads folder, verified to exist. */
export function detectDownloadsDir(): DownloadsProbe {
	const diagnostics: string[] = [];
	const home = homeDir();
	diagnostics.push(`platform=${process.platform}, home=${home ?? "(unknown)"}`);

	let candidates: string[];
	if (Platform.isWin) {
		candidates = detectWindows(home, diagnostics);
	} else if (Platform.isMacOS) {
		candidates = home ? [`${home}/Downloads`] : [];
	} else {
		candidates = detectLinux(home, diagnostics);
	}

	const seen = new Set<string>();
	for (const candidate of candidates) {
		if (!candidate || seen.has(candidate)) continue;
		seen.add(candidate);
		if (directoryExists(candidate)) {
			diagnostics.push(`match: ${candidate}`);
			return { path: candidate, diagnostics };
		}
		diagnostics.push(`not a directory: ${candidate}`);
	}
	return { path: null, diagnostics };
}
