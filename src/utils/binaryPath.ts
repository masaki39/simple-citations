import { Platform } from "obsidian";
import { tryRequireNode } from "./nodeModules";

/**
 * Resolving external CLI tools (pandoc, pdfimages) is awkward on desktop
 * because Obsidian launched from Finder/Dock/GNOME does not inherit the login
 * shell's PATH — Homebrew, MacPorts, conda and `~/.local/bin` installs are
 * invisible to `spawn()`. These helpers widen PATH with the usual install
 * locations, and ask the user's login shell where the tool is, so the settings
 * tab can fill the path in automatically while the manual field stays as an
 * override.
 */

/** Common directories that hold user-installed CLI tools, by platform. */
export function extraBinDirs(isWin = Platform.isWin): string[] {
	if (isWin) {
		const dirs: string[] = [];
		const pf = process.env.ProgramFiles;
		const pf86 = process.env["ProgramFiles(x86)"];
		const local = process.env.LOCALAPPDATA;
		if (pf) dirs.push(`${pf}\\Pandoc`, `${pf}\\poppler\\Library\\bin`);
		if (pf86) dirs.push(`${pf86}\\Pandoc`);
		if (local) dirs.push(`${local}\\Pandoc`, `${local}\\Programs\\Pandoc`);
		return dirs;
	}
	const home = process.env.HOME ?? "";
	const dirs = [
		"/opt/homebrew/bin",
		"/usr/local/bin",
		"/opt/local/bin",
		"/usr/bin",
		"/bin",
		"/snap/bin",
		"/home/linuxbrew/.linuxbrew/bin",
		"/nix/var/nix/profiles/default/bin",
	];
	if (home) {
		dirs.push(
			`${home}/.local/bin`,
			`${home}/bin`,
			`${home}/.nix-profile/bin`,
			`${home}/.cargo/bin`,
			// conda / mamba distributions bundle pandoc
			`${home}/miniconda3/bin`,
			`${home}/anaconda3/bin`,
			`${home}/miniforge3/bin`,
			`${home}/mambaforge/bin`,
			`${home}/.pixi/bin`
		);
	}
	return dirs;
}

/** Merge {@link extraBinDirs} into the current PATH without dropping anything. */
export function buildPath(currentPath: string, isWin = Platform.isWin): string {
	const sep = isWin ? ";" : ":";
	const existing = currentPath ? currentPath.split(sep) : [];
	const seen = new Set(existing);
	const merged = [...existing];
	for (const dir of extraBinDirs(isWin)) {
		if (!seen.has(dir)) {
			seen.add(dir);
			merged.push(dir);
		}
	}
	return merged.join(sep);
}

/** `process.env` with PATH widened for child processes that call external tools. */
export function augmentedEnv(): NodeJS.ProcessEnv {
	return { ...process.env, PATH: buildPath(process.env.PATH ?? "") };
}

export interface BinarySpec {
	/** Executable name without extension, e.g. `"pandoc"`. */
	name: string;
	/** Arguments that make it print its version, e.g. `["--version"]`. */
	versionArgs: string[];
}

export interface BinaryProbe {
	/** Absolute path (or bare name) that ran successfully, or `null`. */
	path: string | null;
	/** First line of the version output, when available. */
	version: string | null;
	/** Human-readable trace of what was attempted (for troubleshooting). */
	diagnostics: string[];
}

const PROBE_TIMEOUT_MS = 4000;
const SHELL_TIMEOUT_MS = 6000;
const DETECT_TIMEOUT_MS = 25000;

/** Resolve `promise`, or `fallback` if it does not settle within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
	return new Promise<T>((resolve) => {
		let done = false;
		const timer = window.setTimeout(() => {
			if (!done) {
				done = true;
				resolve(fallback);
			}
		}, ms);
		promise
			.then((value) => {
				if (!done) {
					done = true;
					window.clearTimeout(timer);
					resolve(value);
				}
			})
			.catch(() => {
				if (!done) {
					done = true;
					window.clearTimeout(timer);
					resolve(fallback);
				}
			});
	});
}

type ChildProcess = typeof import("child_process");
type FsModule = typeof import("fs");

/** Reason the last Node built-in failed to load, surfaced in diagnostics. */
let moduleLoadError: string | null = null;

function getSpawn(): ChildProcess["spawn"] | null {
	const result = tryRequireNode<ChildProcess>("child_process");
	if (!result.ok) {
		moduleLoadError = `child_process: ${result.error}`;
		return null;
	}
	return result.module.spawn;
}

interface RunResult {
	/** Combined stdout + stderr. */
	output: string;
	/** `true` if the process started (regardless of exit code). */
	started: boolean;
	/** Why the process did not start, when applicable. */
	error?: string;
}

/** Spawn `command args`, collecting output. Never rejects. */
async function run(
	command: string,
	args: string[],
	options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}
): Promise<RunResult> {
	const spawn = getSpawn();
	if (!spawn) {
		return { output: "", started: false, error: moduleLoadError ?? "child_process unavailable" };
	}
	const timeoutMs = options.timeoutMs ?? PROBE_TIMEOUT_MS;
	return new Promise<RunResult>((resolve) => {
		let settled = false;
		let timer: number | undefined;
		const finish = (result: RunResult) => {
			if (settled) return;
			settled = true;
			if (timer) window.clearTimeout(timer);
			resolve(result);
		};
		try {
			const proc = spawn(command, args, {
				env: options.env ?? augmentedEnv(),
				stdio: ["ignore", "pipe", "pipe"],
			});
			let output = "";
			proc.stdout?.on("data", (chunk) => (output += chunk.toString()));
			proc.stderr?.on("data", (chunk) => (output += chunk.toString()));
			proc.on("error", (err: Error & { code?: string }) =>
				finish({ output, started: false, error: err.code ?? err.message })
			);
			proc.on("close", () => finish({ output, started: true }));
			timer = window.setTimeout(() => {
				try {
					proc.kill();
				} catch {
					/* already gone */
				}
				finish({ output, started: false, error: "timed out" });
			}, timeoutMs);
		} catch (error) {
			finish({ output: "", started: false, error: (error as Error).message });
		}
	});
}

/** Run `command versionArgs`; return its first output line, or `null` if it did not start. */
async function runVersion(command: string, args: string[]): Promise<string | null> {
	const { output, started } = await run(command, args);
	if (!started) return null;
	const firstLine = output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
	return firstLine ?? "found";
}

/** Candidate login shells to interrogate, most-specific first. */
function candidateShells(): string[] {
	const shells = [process.env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"];
	return [...new Set(shells.filter((s): s is string => !!s))];
}

/**
 * Ask the user's login shell where `name` lives and what its PATH is. An
 * interactive login shell (`-i -l`) is used so `.zshrc` / `.bashrc` — where most
 * people add conda, mise, asdf and Homebrew to PATH — are sourced. `stdin` and
 * `stderr` are detached so the shell neither blocks on input nor hangs on job
 * control when there is no controlling terminal.
 */
async function resolveViaLoginShell(name: string): Promise<{ paths: string[]; note: string }> {
	if (Platform.isWin) return { paths: [], note: "" };
	const script = `command -v ${name} 2>/dev/null; which ${name} 2>/dev/null; printf '%s\\n' "$PATH"`;
	const failures: string[] = [];
	for (const shell of candidateShells()) {
		// Try an interactive login shell first (sources .zshrc / .bashrc, where
		// conda / mise / Homebrew usually live), then a plain one as a fallback.
		let result = await run(shell, ["-i", "-l", "-c", script], {
			env: process.env,
			timeoutMs: SHELL_TIMEOUT_MS,
		});
		if (!result.started) {
			result = await run(shell, ["-l", "-c", script], {
				env: process.env,
				timeoutMs: SHELL_TIMEOUT_MS,
			});
		}
		const { output, started, error } = result;
		if (!started) {
			failures.push(`${shell} (${error ?? "no output"})`);
			continue;
		}

		const lines = output
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean);
		const paths: string[] = [];
		const addPath = (p: string) => {
			if (p.startsWith("/") && !paths.includes(p)) paths.push(p);
		};
		for (const line of lines) {
			// A PATH value: "dir:dir:dir" (bash/zsh) or "dir dir dir" (fish).
			const looksLikePathList = line.includes(":") || /^\/\S*(\s+\/\S+)+/.test(line);
			if (looksLikePathList) {
				for (const dir of line.split(/[:\s]+/)) {
					if (dir.startsWith("/")) addPath(`${dir.replace(/\/+$/, "")}/${name}`);
				}
			} else if (line.startsWith("/")) {
				// A command path from `command -v` / `which`.
				addPath(line);
			}
		}
		return {
			paths,
			note: `login shell ${shell}: ${paths.length ? `${paths.length} candidate(s)` : "no match"}`,
		};
	}
	return {
		paths: [],
		note: `no usable login shell — ${failures.join(", ") || "none tried"}`,
	};
}

/** Windows: ask `where.exe` (uses the widened PATH) for the executable. */
async function resolveViaWhere(exe: string): Promise<{ paths: string[]; note: string }> {
	const { output, started, error } = await run("where", [exe], { timeoutMs: PROBE_TIMEOUT_MS });
	if (!started) return { paths: [], note: `where.exe: ${error ?? "failed"}` };
	const paths = output
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => /^[A-Za-z]:[\\/]/.test(l));
	return { paths, note: `where.exe: ${paths.length ? `${paths.length} candidate(s)` : "no match"}` };
}

/**
 * Verify that a specific command (an absolute path, or a bare name resolved via
 * the widened PATH) can be executed.
 */
export async function probeBinary(command: string, spec: BinarySpec): Promise<boolean> {
	const target = command || spec.name;
	if (isAbsolutePath(target) && !fileExists(target)) return false;
	const version = await withTimeout(runVersion(target, spec.versionArgs), DETECT_TIMEOUT_MS, null);
	return version !== null;
}

/**
 * Locate a working executable. Probes the current value and the known install
 * directories in parallel, then the login shell's `command -v` / PATH, then the
 * bare name. Always resolves within {@link DETECT_TIMEOUT_MS}.
 */
export async function detectBinary(spec: BinarySpec, currentValue: string): Promise<BinaryProbe> {
	return withTimeout(detectBinaryInner(spec, currentValue), DETECT_TIMEOUT_MS, {
		path: null,
		version: null,
		diagnostics: ["detection timed out"],
	});
}

async function detectBinaryInner(spec: BinarySpec, currentValue: string): Promise<BinaryProbe> {
	const diagnostics: string[] = [];
	diagnostics.push(
		`platform=${process.platform}, SHELL=${process.env.SHELL ?? "(unset)"}, ` +
			`PATH=${process.env.PATH ?? "(unset)"}`
	);
	const exe = Platform.isWin ? `${spec.name}.exe` : spec.name;
	const sep = Platform.isWin ? "\\" : "/";
	const seen = new Set<string>();
	const add = (list: string[], value: string) => {
		if (value && !seen.has(value)) {
			seen.add(value);
			list.push(value);
		}
	};

	const staticCandidates: string[] = [];
	if (currentValue) add(staticCandidates, currentValue);
	for (const dir of extraBinDirs()) add(staticCandidates, `${dir.replace(/[\\/]+$/, "")}${sep}${exe}`);

	const hit = await probeAll(staticCandidates, spec, diagnostics, "known location");
	if (hit) return { ...hit, diagnostics };

	const shellResult = Platform.isWin
		? await resolveViaWhere(exe)
		: await resolveViaLoginShell(spec.name);
	diagnostics.push(shellResult.note || "shell lookup: skipped");
	const shellCandidates: string[] = [];
	for (const p of shellResult.paths) add(shellCandidates, p);
	const shellHit = await probeAll(shellCandidates, spec, diagnostics, "shell lookup");
	if (shellHit) return { ...shellHit, diagnostics };

	// Last resort: the widened PATH may already resolve the bare name.
	const bareVersion = await runVersion(spec.name, spec.versionArgs);
	if (bareVersion) {
		diagnostics.push(`bare "${spec.name}" via PATH: ok`);
		return { path: spec.name, version: bareVersion, diagnostics };
	}
	diagnostics.push(`bare "${spec.name}" via PATH: not found`);
	if (moduleLoadError) diagnostics.push(`node module load error: ${moduleLoadError}`);

	return { path: null, version: null, diagnostics };
}

/** Probe a list of candidate paths concurrently; return the highest-priority hit. */
async function probeAll(
	candidates: string[],
	spec: BinarySpec,
	diagnostics: string[],
	label: string
): Promise<{ path: string; version: string | null } | null> {
	if (candidates.length === 0) return null;
	const present = candidates.filter((c) => !isAbsolutePath(c) || fileExists(c));

	if (present.length === 0) {
		diagnostics.push(`${label}: none of ${candidates.length} path(s) exist`);
		return null;
	}

	const probed = await Promise.all(
		present.map(async (c) => ({ path: c, version: await runVersion(c, spec.versionArgs) }))
	);
	const hit = probed.find((r) => r.version);
	if (hit) {
		diagnostics.push(`${label}: ${hit.path} → ${hit.version ?? "ok"}`);
		return hit;
	}
	diagnostics.push(`${label}: ${present.length} path(s) exist but none ran`);
	return null;
}

export function isAbsolutePath(value: string): boolean {
	return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function fileExists(target: string): boolean {
	const result = tryRequireNode<FsModule>("fs");
	if (!result.ok) {
		moduleLoadError = `fs: ${result.error}`;
		return false;
	}
	try {
		return result.module.existsSync(target);
	} catch {
		return false;
	}
}

export const PANDOC_SPEC: BinarySpec = { name: "pandoc", versionArgs: ["--version"] };
export const PDFIMAGES_SPEC: BinarySpec = { name: "pdfimages", versionArgs: ["-v"] };
