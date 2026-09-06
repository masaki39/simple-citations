import { requestUrl } from 'obsidian';

const STYLES_JSON_URL = 'https://www.zotero.org/styles-files/styles.json';

export interface CslStyle {
	title: string;
	titleShort?: string;
	name: string;
	href: string;
}

type RawStyleEntry = { title: string; name: string } & Record<string, unknown>;

function isStyleEntry(entry: unknown): entry is RawStyleEntry {
	if (!entry || typeof entry !== 'object') return false;
	const record = entry as Record<string, unknown>;
	return typeof record.name === 'string' && typeof record.title === 'string';
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
		.filter(isStyleEntry)
		.map((entry) => ({
			title: entry.title,
			titleShort: typeof entry.titleShort === 'string' ? entry.titleShort : undefined,
			name: entry.name,
			href: typeof entry.href === 'string'
				? entry.href
				: `https://www.zotero.org/styles/${entry.name}`,
		}));

	cache = styles;
	return styles;
}
