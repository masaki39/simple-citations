import {
	detectDownloadsDir,
	expandWindowsEnv,
	parseRegQueryOutput,
	parseXdgUserDirs,
} from "../utils/downloadsDir";

describe("parseXdgUserDirs", () => {
	it("expands $HOME in the value", () => {
		const contents = [
			"# This file is written by xdg-user-dirs-update",
			'XDG_DESKTOP_DIR="$HOME/Desktop"',
			'XDG_DOWNLOAD_DIR="$HOME/Downloads"',
		].join("\n");
		expect(parseXdgUserDirs(contents, "/home/ada")).toBe("/home/ada/Downloads");
	});

	it("handles a relocated absolute path", () => {
		const contents = 'XDG_DOWNLOAD_DIR="/mnt/data/dl"';
		expect(parseXdgUserDirs(contents, "/home/ada")).toBe("/mnt/data/dl");
	});

	it("ignores commented-out entries", () => {
		const contents = '#XDG_DOWNLOAD_DIR="$HOME/Downloads"';
		expect(parseXdgUserDirs(contents, "/home/ada")).toBeNull();
	});

	it("returns null when the entry is empty", () => {
		expect(parseXdgUserDirs('XDG_DOWNLOAD_DIR=""', "/home/ada")).toBeNull();
	});
});

describe("expandWindowsEnv", () => {
	it("substitutes known variables and leaves unknown ones intact", () => {
		const env = { USERPROFILE: "C:\\Users\\Ada" } as NodeJS.ProcessEnv;
		expect(expandWindowsEnv("%USERPROFILE%\\Downloads", env)).toBe("C:\\Users\\Ada\\Downloads");
		expect(expandWindowsEnv("%NOPE%\\Downloads", env)).toBe("%NOPE%\\Downloads");
	});
});

describe("parseRegQueryOutput", () => {
	const guid = "{374DE290-123F-4565-9164-39C4925E467B}";

	it("reads a REG_EXPAND_SZ value", () => {
		const output = [
			"",
			"HKEY_CURRENT_USER\\...\\User Shell Folders",
			`    ${guid}    REG_EXPAND_SZ    %USERPROFILE%\\Downloads`,
			"",
		].join("\r\n");
		expect(parseRegQueryOutput(output, guid)).toBe("%USERPROFILE%\\Downloads");
	});

	it("reads a plain REG_SZ value with spaces", () => {
		const output = `    ${guid}    REG_SZ    D:\\My Downloads`;
		expect(parseRegQueryOutput(output, guid)).toBe("D:\\My Downloads");
	});

	it("returns null when the value is absent", () => {
		expect(parseRegQueryOutput("no match here", guid)).toBeNull();
	});
});

describe("detectDownloadsDir (integration)", () => {
	it("resolves an existing Downloads folder on this machine, or null", () => {
		const result = detectDownloadsDir();
		expect(Array.isArray(result.diagnostics)).toBe(true);
		if (result.path) {
			expect(result.path).toMatch(/Downloads$/i);
		}
	});
});
