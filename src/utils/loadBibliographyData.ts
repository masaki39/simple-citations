import { App, TFile, normalizePath } from "obsidian";

interface BbtCollection {
	name: string;
	items?: string[];
	collections?: string[];
}

interface BbtJson {
	config: { label: string };
	collections?: Record<string, BbtCollection>;
	items: BbtItem[];
}

interface BbtItem {
	key?: string;
	citationKey?: string;
	creators?: Array<{ firstName?: string; lastName?: string; name?: string; creatorType?: string }>;
	date?: string;
	publicationTitle?: string;
	DOI?: string;
	select?: string;
	attachments?: Array<{ path?: string }>;
	abstractNote?: string;
	[key: string]: unknown;
}

export interface BibliographyResult {
	jsonFiles: TFile[];
	mergedData: any[];
}

export function isBetterBibTeXFormat(data: unknown): data is BbtJson {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
	const d = data as Record<string, unknown>;
	return (
		typeof d.config === 'object' &&
		d.config !== null &&
		(d.config as Record<string, unknown>).label === 'BetterBibTeX JSON' &&
		Array.isArray(d.items)
	);
}

export function normalizeBbtEntry(
	item: BbtItem,
	collectionNames: Map<string, string[]>
): Record<string, unknown> {
	const normalized: Record<string, unknown> = { ...item };
	normalized['citation-key'] = item.citationKey;
	normalized['_bbt'] = true;

	if (item.abstractNote !== undefined) normalized['abstract'] = item.abstractNote;

	if (Array.isArray(item.attachments)) {
		const pdfs = item.attachments
			.map(a => a.path ?? '')
			.filter(p => p.toLowerCase().endsWith('.pdf'));
		if (pdfs.length > 0) normalized['pdf'] = pdfs.length === 1 ? pdfs[0] : pdfs;
	}

	if (item.key) {
		const cols = collectionNames.get(item.key);
		if (cols && cols.length > 0) normalized['collections'] = cols;
	}

	return normalized;
}

/**
 * Load bibliography data from multiple JSON files.
 * Earlier files in the list have higher priority for deduplication.
 * Entries are deduplicated by citation-key.
 * Duplicate entries are stored in _duplicates for downstream merge.
 */
export async function loadBibliographyData(
	app: App,
	jsonPaths: string[],
	jsonNames: string[]
): Promise<BibliographyResult> {
	const jsonFiles: TFile[] = [];
	const mergedData: any[] = [];
	const seenKeys = new Map<string, any>();

	for (let i = 0; i < jsonPaths.length; i++) {
		const path = jsonPaths[i];
		if (!path) continue;
		const normalizedPath = normalizePath(path);
		const file = app.vault.getFileByPath(normalizedPath);
		if (!file || file.extension !== 'json') continue;

		const bibName = jsonNames[i]?.trim() || file.basename;

		jsonFiles.push(file);
		const contents = await app.vault.cachedRead(file);
		let data: unknown;
		try {
			data = JSON.parse(contents);
		} catch {
			continue;
		}

		let entries: Record<string, unknown>[];

		if (Array.isArray(data)) {
			entries = data;
		} else if (isBetterBibTeXFormat(data)) {
			const collectionNames = new Map<string, string[]>();
			if (data.collections) {
				for (const col of Object.values(data.collections)) {
					if (!col.name || !Array.isArray(col.items)) continue;
					for (const itemKey of col.items) {
						if (!collectionNames.has(itemKey)) collectionNames.set(itemKey, []);
						collectionNames.get(itemKey)!.push(col.name);
					}
				}
			}
			entries = data.items.map(item => normalizeBbtEntry(item, collectionNames));
		} else {
			continue;
		}

		for (const entry of entries) {
			const key = entry?.['citation-key'] as string | undefined;
			if (!key) continue;

			const existing = seenKeys.get(key);
			if (!existing) {
				entry['_source_files'] = [bibName];
				entry['_duplicates'] = [];
				seenKeys.set(key, entry);
				mergedData.push(entry);
			} else {
				existing['_source_files'].push(bibName);
				existing['_duplicates'].push(entry);
			}
		}
	}

	return { jsonFiles, mergedData };
}
