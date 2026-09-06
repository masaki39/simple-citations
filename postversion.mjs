import { execFileSync } from "child_process";

// `pnpm version` hardcodes a leading "v" on the git tag it creates and ignores
// the `tag-version-prefix` npm setting. Obsidian releases must be tagged as a
// bare `x.y.z` (the release workflow and community catalog expect no "v"), so
// this postversion hook rewrites the tag pnpm just made.

const version = process.env.npm_package_version;
if (!version) {
	throw new Error("npm_package_version is not set; run this via `pnpm version`.");
}

const prefixed = `v${version}`;
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const tagExists = (name) => {
	try {
		git(["rev-parse", "-q", "--verify", `refs/tags/${name}`]);
		return true;
	} catch {
		return false;
	}
};

if (!tagExists(prefixed)) {
	// No prefixed tag (e.g. run with --no-git-tag-version) — nothing to fix.
	process.exit(0);
}

git(["tag", "-d", prefixed]);
git(["tag", version]);
console.log(`Retagged ${prefixed} -> ${version}`);
