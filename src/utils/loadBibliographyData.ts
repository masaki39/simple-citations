import { App, TFile, normalizePath } from "obsidian";
import { getStrategy, mergeValues } from "./mergeStrategies";

export interface BibliographyResult {
	jsonFiles: TFile[];
	mergedData: any[];
}

/**
 * Load and merge bibliography data from multiple JSON files.
 * Earlier files in the list have higher priority for deduplication.
 * Entries are deduplicated by citation-key.
 * Properties are merged according to per-property merge strategies.
 */
export async function loadBibliographyData(
	app: App,
	jsonPaths: string[],
	jsonNames: string[],
	mergeStrategies: Record<string, string> = {}
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

		// Use custom name if set, otherwise use filename without extension
		const bibName = jsonNames[i]?.trim() || file.basename;

		jsonFiles.push(file);
		const contents = await app.vault.cachedRead(file);
		const data = JSON.parse(contents);

		if (!Array.isArray(data)) continue;

		for (const entry of data) {
			const key = entry?.['citation-key'];
			if (!key) continue;

			const existing = seenKeys.get(key);
			if (!existing) {
				// First occurrence — use this entry's data (higher priority)
				entry['_source_files'] = [bibName];
				seenKeys.set(key, entry);
				mergedData.push(entry);
			} else {
				// Duplicate — append bibliography name and merge properties
				existing['_source_files'].push(bibName);
				for (const [prop, value] of Object.entries(entry)) {
					if (prop === 'citation-key' || prop === '_source_files') continue;
					const strategy = getStrategy(mergeStrategies, prop);
					if (strategy === 'merge') {
						existing[prop] = mergeValues(existing[prop], value);
					}
					// 'priority' — keep existing value (higher priority file)
				}
			}
		}
	}

	return { jsonFiles, mergedData };
}
