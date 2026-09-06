import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
	globalIgnores([
		"node_modules/",
		"dist/",
		"main.js",
		"esbuild.config.mjs",
		"version-bump.mjs",
		"postversion.mjs",
		"jest.config.cjs",
		"jest.setup.cjs",
		"versions.json",
		"src/__mocks__/",
	]),

	// ESLint core recommended + typescript-eslint type-checked + Obsidian rules.
	...obsidianmd.configs.recommended,

	{
		languageOptions: {
			// Renderer code is browser-context; desktop-only paths (guarded by
			// Platform.isDesktop) also touch Node globals like `process`/`require`.
			globals: {
				...globals.browser,
				...globals.node,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.mjs"],
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},

	{
		files: ["src/**/*.ts"],
		rules: {
			// TypeScript already resolves identifiers and types; `no-undef`
			// misfires on type-only references such as the `NodeJS` namespace.
			"no-undef": "off",

			// This plugin parses untyped external JSON (Zotero bibliography
			// exports), so `any` flows through data-shaping code by design. The
			// type-checked "unsafe" family flags that pervasively without
			// catching real bugs; re-enable if the bibliography data gets typed.
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/restrict-template-expressions": "off",
			"@typescript-eslint/no-base-to-string": "off",

			// Proper nouns and acronyms that keep their casing in UI copy.
			// "Downloads" is the OS folder name.
			"obsidianmd/ui/sentence-case": [
				"warn",
				{
					brands: [
						"Pandoc",
						"Zotero",
						"Dataview",
						"BetterBibTeX",
						"Poppler",
						"Obsidian",
						"Downloads",
					],
					acronyms: ["JSON", "CSL", "PDF", "DOI"],
				},
			],
		},
	},

	{
		// Jest test files run in Node with the Jest globals. Test doubles use
		// `any`, cast to Obsidian types, and pass mocked methods to `expect()`;
		// the corresponding type-aware rules don't apply to fixtures.
		files: ["src/**/__tests__/**/*.ts", "src/**/*.test.ts"],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.jest,
			},
		},
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/unbound-method": "off",
			"obsidianmd/no-tfile-tfolder-cast": "off",
		},
	},
]);
