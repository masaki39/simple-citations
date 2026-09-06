import { App, TFile } from "obsidian";
import { SimpleCitationsSettings } from "../settings/settings";

/**
 * Built-in "additional content" templates.
 *
 * Writing Bases (or Dataview) queries by hand is the hard part of setting up a
 * dynamic template, so a few ready-made ones are offered in settings instead.
 * The selected sample is inserted at the top of each literature note (between
 * the START_TEMPLATE / END_TEMPLATE comment tags), exactly like a template
 * file — but with nothing to create or maintain.
 *
 * Each sample is an embedded Obsidian Bases block. Inside an embedded block
 * `this` refers to the note the block renders in, so the views list the other
 * literature notes that share the current note's first author or journal.
 * Requires Bases (Obsidian 1.9+). A configured template file always takes
 * precedence over the sample.
 */

const SAME_FIRST_AUTHOR = [
	"**Same first author**",
	"",
	"```base",
	"filters:",
	"  and:",
	"    - authors[0] == this.authors[0]",
	"    - file.path != this.file.path",
	"formulas:",
	"  Link: 'link(file.name, \"link\")'",
	"views:",
	"  - type: table",
	"    name: Same first author",
	"    order:",
	"      - formula.Link",
	"      - year",
	"      - journal",
	"      - title",
	"    sort:",
	"      - property: year",
	"        direction: DESC",
	"    limit: 20",
	"```",
].join("\n");

const SAME_JOURNAL = [
	"**Same journal**",
	"",
	"```base",
	"filters:",
	"  and:",
	"    - journal == this.journal",
	"    - file.path != this.file.path",
	"formulas:",
	"  Link: 'link(file.name, \"link\")'",
	"  FirstAuthor: authors[0]",
	"views:",
	"  - type: table",
	"    name: Same journal",
	"    order:",
	"      - formula.Link",
	"      - formula.FirstAuthor",
	"      - year",
	"      - title",
	"    sort:",
	"      - property: year",
	"        direction: DESC",
	"    limit: 20",
	"```",
].join("\n");

/**
 * Sample key -> dropdown label and template content. The keys are stored in
 * settings, so keep them stable.
 */
export const TEMPLATE_SAMPLES: Record<string, { label: string; content: string }> = {
	"": { label: "None", content: "" },
	"first-author": {
		label: "Same first author (Bases)",
		content: SAME_FIRST_AUTHOR,
	},
	journal: {
		label: "Same journal (Bases)",
		content: SAME_JOURNAL,
	},
	"first-author-journal": {
		label: "Same first author and journal (Bases)",
		content: `${SAME_FIRST_AUTHOR}\n\n${SAME_JOURNAL}`,
	},
};

/** Dropdown options in the shape the declarative settings API expects. */
export function templateSampleOptions(): Record<string, string> {
	return Object.fromEntries(
		Object.entries(TEMPLATE_SAMPLES).map(([key, { label }]) => [key, label])
	);
}

/** Content for a sample key, or an empty string for an unknown key. */
export function getTemplateSample(key: string): string {
	return TEMPLATE_SAMPLES[key]?.content ?? "";
}

/**
 * The template content to insert into a literature note: the configured
 * template file if there is one, otherwise the selected built-in sample.
 */
export async function resolveTemplateContent(
	app: App,
	settings: SimpleCitationsSettings,
	templateFile: TFile | null
): Promise<string> {
	if (templateFile) return app.vault.cachedRead(templateFile);
	return getTemplateSample(settings.templateSample);
}
