export interface SimpleCitationsSettings {
	jsonPaths: string[];
	jsonNames: string[];
	folderPath: string;
	includeAuthorTag: boolean;
	includeJournalTag: boolean;
	includeCollections: boolean;
	optionalFields: string;
	includeAbstract: boolean;
	templatePath: string;
	autoAddCitations: boolean;
	autoUpdateCitations: boolean;
	jsonUpdatedTimes: Record<string, number>;
	inputPandocPath: string;
	pandocOutputPath: string;
	pandocArgs: string;
}

export const DEFAULT_SETTINGS: SimpleCitationsSettings = {
	jsonPaths: [],
	jsonNames: [],
	folderPath: "",
	includeAuthorTag: false,
	includeJournalTag: false,
	includeCollections: false,
	optionalFields: "",
	includeAbstract: false,
	templatePath: "",
	autoAddCitations: false,
	autoUpdateCitations: false,
	jsonUpdatedTimes: {},
	inputPandocPath: "",
	pandocOutputPath: "",
	pandocArgs: "-f markdown+hard_line_breaks"
}