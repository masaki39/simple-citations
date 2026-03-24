import { App, TFile, normalizePath } from "obsidian";

export interface BibliographyResult {
	jsonFiles: TFile[];
	mergedData: any[];
}

/**
 * Load and merge bibliography data from multiple JSON files.
 * Earlier files in the list have higher priority for deduplication.
 * Entries are deduplicated by citation-key.
 */
export async function loadBibliographyData(app: App, jsonPaths: string[], jsonNames: string[]): Promise<BibliographyResult> {
	const jsonFiles: TFile[] = [];
	const mergedData: any[] = [];
	const seenKeys = new Map<string, any>();

	for (let i = 0; i < jsonPaths.length; i++) {
		const path = jsonPaths[i];
		if (!path) continue;
		const normalizedPath = normalizePath(path);
		const file = app.vault.getFileByPath(normalizedPath);
		if (!file || file.extension !== 'json') continue;

		// Use custom name if set, otherwise use filename without extension
		const bibName = jsonNames[i]?.trim() || file.basename;

		jsonFiles.push(file);
		const contents = await app.vault.cachedRead(file);
		const data = JSON.parse(contents);

		if (!Array.isArray(data)) continue;

		for (const entry of data) {
			const key = entry?.['citation-key'];
			if (!key) continue;

			// Prefix collections with bibliography name; if no collections, use bibName alone
			const rawCollections = Array.isArray(entry['collections'])
				? entry['collections'].filter((c: string) => c)
				: [];
			const prefixedCollections = rawCollections.length > 0
				? rawCollections.map((c: string) => `${bibName}: ${c}`)
				: [bibName];

			const existing = seenKeys.get(key);
			if (!existing) {
				// First occurrence — use this entry's data (higher priority)
				entry['_source_files'] = [bibName];
				entry['_collections'] = [...prefixedCollections];
				seenKeys.set(key, entry);
				mergedData.push(entry);
			} else {
				// Duplicate — append bibliography name and merge collections
				existing['_source_files'].push(bibName);
				const existingSet = new Set(existing['_collections'] || []);
				for (const c of prefixedCollections) {
					if (!existingSet.has(c)) {
						existing['_collections'].push(c);
					}
				}
			}
		}
	}

	return { jsonFiles, mergedData };
}
