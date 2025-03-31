export interface SimpleCitationsSettings {
	jsonPath: string;
	folderPath: string;
	includeAuthorTag: boolean;
	includeJournalTag: boolean;
	includeAbstract: boolean;
	templatePath: string;
	autoAddCitations: boolean;
	jsonUpdatedTime: number;
	inputPandocPath: string;
	pandocOutputPath: string;
	pandocArgs: string;
}

export const DEFAULT_SETTINGS: SimpleCitationsSettings = {
	jsonPath: "",
	folderPath: "",
	includeAuthorTag: false,
	includeJournalTag: false,
	includeAbstract: false,
	templatePath: "",
	autoAddCitations: false,
	jsonUpdatedTime: new Date().getTime(),
	inputPandocPath: "",
	pandocOutputPath: "",
	pandocArgs: "-f markdown+hard_line_breaks"
}