import { requestUrl } from 'obsidian';

const STYLES_JSON_URL = 'https://www.zotero.org/styles-files/styles.json';

export interface CslStyle {
	title: string;
	titleShort?: string;
	name: string;
	href: string;
}

let cache: CslStyle[] | null = null;

/**
 * Fetch the list of CSL styles from the Zotero style repository.
 * The result is cached in memory for the rest of the session.
 */
export async function loadCslStyles(forceRefresh = false): Promise<CslStyle[]> {
	if (cache && !forceRefresh) return cache;

	const response = await requestUrl({ url: STYLES_JSON_URL });
	const data = response.json as unknown;
	if (!Array.isArray(data)) {
		throw new Error('Unexpected response from the Zotero style repository.');
	}

	const styles = data
		.filter((entry): entry is Record<string, unknown> =>
			!!entry && typeof entry === 'object' &&
			typeof (entry as Record<string, unknown>).name === 'string' &&
			typeof (entry as Record<string, unknown>).title === 'string'
		)
		.map((entry) => ({
			title: entry.title as string,
			titleShort: typeof entry.titleShort === 'string' ? entry.titleShort : undefined,
			name: entry.name as string,
			href: typeof entry.href === 'string'
				? (entry.href as string)
				: `https://www.zotero.org/styles/${entry.name as string}`,
		}));

	cache = styles;
	return styles;
}
