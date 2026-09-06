export interface SimpleCitationsSettings {
	jsonPaths: string[];
	jsonNames: string[];
	folderPath: string;
	includeAuthorTag: boolean;
	includeJournalTag: boolean;
	includeBibliography: boolean;

	optionalFields: string;
	includeAbstract: boolean;
	templatePath: string;
	autoAddCitations: boolean;
	autoSyncCitations: boolean;
	autoUpdateCitations: boolean;
	mergeStrategies: Record<string, string>;
	showBaseProperties: boolean;
	jsonUpdatedTimes: Record<string, number>;
	inputPandocPath: string;
	pandocOutputPath: string;
	pandocLinkCitations: boolean;
	pandocNumberSections: boolean;
	pandocReferenceDoc: string;
	pandocArgs: string;
	includeBbtPdf: boolean;
	includeBbtCollections: boolean;
	pdfimagesPath: string;
}

export const DEFAULT_SETTINGS: SimpleCitationsSettings = {
	jsonPaths: [],
	jsonNames: [],
	folderPath: "",
	includeAuthorTag: false,
	includeJournalTag: false,
	includeBibliography: false,

	optionalFields: "",
	includeAbstract: false,
	templatePath: "",
	autoAddCitations: false,
	autoSyncCitations: false,
	autoUpdateCitations: false,
	mergeStrategies: {},
	showBaseProperties: false,
	jsonUpdatedTimes: {},
	inputPandocPath: "",
	pandocOutputPath: "",
	pandocLinkCitations: false,
	pandocNumberSections: false,
	pandocReferenceDoc: "",
	pandocArgs: "-f markdown+hard_line_breaks",
	includeBbtPdf: true,
	includeBbtCollections: true,
	pdfimagesPath: "",
}