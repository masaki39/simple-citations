import {
	buildPath,
	detectBinary,
	extraBinDirs,
	isAbsolutePath,
	probeBinary,
} from "../utils/binaryPath";
import { requireNode, tryRequireNode } from "../utils/nodeModules";

describe("isAbsolutePath", () => {
	it("recognises posix and Windows absolute paths", () => {
		expect(isAbsolutePath("/usr/bin/pandoc")).toBe(true);
		expect(isAbsolutePath("C:\\Pandoc\\pandoc.exe")).toBe(true);
		expect(isAbsolutePath("pandoc")).toBe(false);
		expect(isAbsolutePath("./pandoc")).toBe(false);
	});
});

describe("nodeModules", () => {
	it("requireNode loads a built-in", () => {
		expect(typeof requireNode<typeof import("path")>("path").join).toBe("function");
	});
	it("tryRequireNode reports a failure instead of throwing", () => {
		const result = tryRequireNode("this-module-does-not-exist");
		expect(result.ok).toBe(false);
	});
});

describe("buildPath", () => {
	it("appends known install dirs without dropping the existing PATH (posix)", () => {
		const result = buildPath("/usr/sbin:/opt/homebrew/bin", false).split(":");
		expect(result[0]).toBe("/usr/sbin");
		expect(result).toContain("/opt/homebrew/bin");
		expect(result).toContain("/usr/local/bin");
	});

	it("does not duplicate a dir already on PATH", () => {
		const result = buildPath("/usr/local/bin", false).split(":");
		expect(result.filter((d) => d === "/usr/local/bin")).toHaveLength(1);
	});

	it("handles an empty PATH", () => {
		expect(buildPath("", false).length).toBeGreaterThan(0);
	});

	it("uses ';' as the separator on Windows", () => {
		const prev = process.env.ProgramFiles;
		process.env.ProgramFiles = "C:\\Program Files";
		try {
			const result = buildPath("C:\\Windows", true);
			expect(result.startsWith("C:\\Windows;")).toBe(true);
			expect(result).toContain("C:\\Program Files\\Pandoc");
		} finally {
			if (prev === undefined) delete process.env.ProgramFiles;
			else process.env.ProgramFiles = prev;
		}
	});
});

describe("extraBinDirs", () => {
	it("includes Homebrew locations on posix", () => {
		expect(extraBinDirs(false)).toContain("/opt/homebrew/bin");
	});
});

// These shell out; skipped on Windows where the fixtures differ.
const posixOnly = process.platform === "win32" ? describe.skip : describe;

posixOnly("detectBinary / probeBinary (integration)", () => {
	const NODE = { name: "node", versionArgs: ["--version"] };
	const BOGUS = { name: "simple-citations-no-such-bin", versionArgs: ["--version"] };

	it("finds an installed binary and returns an absolute path", async () => {
		const result = await detectBinary(NODE, "");
		expect(result.path).toBeTruthy();
		expect(result.version).toBeTruthy();
	}, 25000);

	it("resolves to null for a missing binary without hanging", async () => {
		const start = Date.now();
		const result = await detectBinary(BOGUS, "");
		expect(result.path).toBeNull();
		expect(Date.now() - start).toBeLessThan(21000);
	}, 25000);

	it("probeBinary validates a bare name via PATH", async () => {
		expect(await probeBinary("", NODE)).toBe(true);
		expect(await probeBinary("/definitely/not/here/node", NODE)).toBe(false);
	}, 25000);
});
