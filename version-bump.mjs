import { readFileSync, writeFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const targetVersion = process.env.npm_package_version ?? pkg.version;

if (!targetVersion) {
	throw new Error("Unable to determine the target version for manifest bump.");
}

// read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// update versions.json with target version and minAppVersion from manifest.json
let versions = {};
try {
	versions = JSON.parse(readFileSync("versions.json", "utf8"));
} catch (error) {
	if (error.code !== "ENOENT") {
		throw error;
	}
}
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
