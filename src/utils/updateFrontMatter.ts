import { App, TFile } from 'obsidian';
import { SimpleCitationsSettings } from '../settings/settings';
import { getStrategy, mergeValues } from './mergeStrategies';

/** Base frontmatter properties managed by the plugin. */
export const BASE_PROPERTIES: readonly string[] = [
	'title',
	'authors',
	'year',
	'journal',
	'doi',
	'pdf',
	'collections',
];

function extractValuesCsl(item: any): Record<string, any> {
	const vals: Record<string, any> = {};
	vals.title = item['title'];
	if (item['author'] && Array.isArray(item['author'])) {
		vals.authors = Array.from(new Set(
			item['author'].map((a: any) =>
				(a.literal || `${a.given ?? ""} ${a.family ?? ""}`).trim()
			)
		));
	}
	if (item['issued'] && Array.isArray(item['issued']['date-parts']) && item['issued']['date-parts'][0] && !isNaN(item['issued']['date-parts'][0][0])) {
		vals.year = Number(item['issued']['date-parts'][0][0]);
	}
	vals.journal = item['container-title'];
	if (item['DOI']) vals.doi = `https://doi.org/${item['DOI']}`;
	return vals;
}

export function parseBbtYear(date: string): number | undefined {
	const trimmed = date.trim();
	const isoMatch = trimmed.match(/^(\d{4})/);
	const slashMatch = !isoMatch ? trimmed.match(/^\d{1,2}\/(\d{4})/) : null;
	const yearStr = isoMatch?.[1] ?? slashMatch?.[1];
	const year = yearStr ? parseInt(yearStr, 10) : NaN;
	return isNaN(year) ? undefined : year;
}

function extractValuesBbt(item: any): Record<string, any> {
	const vals: Record<string, any> = {};
	vals.title = item['title'];
	if (Array.isArray(item['creators'])) {
		const authors = item['creators']
			.filter((c: any) => c.creatorType === 'author')
			.map((c: any) => (c.name?.trim() || `${c.firstName ?? ""} ${c.lastName ?? ""}`).trim())
			.filter(Boolean);
		if (authors.length > 0) vals.authors = Array.from(new Set(authors));
	}
	if (typeof item['date'] === 'string') {
		const year = parseBbtYear(item['date']);
		if (year !== undefined) vals.year = year;
	}
	vals.journal = item['publicationTitle'];
	if (item['DOI']) vals.doi = `https://doi.org/${item['DOI']}`;
	return vals;
}

function extractValues(item: any): Record<string, any> {
	return item['_bbt'] ? extractValuesBbt(item) : extractValuesCsl(item);
}

export async function updateFrontMatter(
	app: App,
	settings: SimpleCitationsSettings,
	targetFile: TFile,
	item: any,
	fullSync: boolean = false
) {
	await app.fileManager.processFrontMatter(targetFile, (fm) => {
		if (fullSync) {
			for (const key of Object.keys(fm)) {
				delete fm[key];
			}
		}
		fm.aliases = [];
		if (!Array.isArray(fm.tags)) {
			fm.tags = fm.tags ? [fm.tags] : [];
		}

		if (item['_bbt']) {
			const vals = extractValuesBbt(item);
			fm.title = vals.title;
			if (vals.authors) fm.authors = vals.authors;
			if (vals.year !== undefined) fm.year = vals.year;
			fm.journal = vals.journal;
			fm.doi = vals.doi ?? "";
			fm.zotero = item['select'] ?? "";
			if (settings.includeBbtPdf && item['pdf'] !== undefined) {
				fm.pdf = item['pdf'];
			} else {
				delete fm.pdf;
			}
			if (settings.includeBbtCollections && item['collections'] !== undefined) {
				fm.collections = item['collections'];
			} else {
				delete fm.collections;
			}
		} else {
			fm.title = item['title'];
			if (item['author'] && Array.isArray(item['author'])) {
				fm.authors = Array.from(new Set(
					item['author'].map((author: any) =>
						(author.literal || `${author.given ?? ""} ${author.family ?? ""}`).trim()
					)
				));
			}
			if (item['issued'] && Array.isArray(item['issued']['date-parts']) && item['issued']['date-parts'][0] && !isNaN(item['issued']['date-parts'][0][0])) {
				fm.year = Number(item['issued']['date-parts'][0][0]);
			}
			fm.journal = item['container-title'];
			fm.doi = item['DOI'] ? `https://doi.org/${item['DOI']}` : "";
			const groupMatch = item['zotero_uri']?.match(/\/groups\/(\d+)/);
			fm.zotero = groupMatch
				? `zotero://select/groups/${groupMatch[1]}/items/@${item['id']}`
				: `zotero://select/items/@${item['id']}`;
		}

		if (settings.includeBibliography && item['_source_files'] && Array.isArray(item['_source_files'])) {
			fm.bibliography = item['_source_files'];
		} else {
			delete fm.bibliography;
		}

		if (fm.authors && fm.authors.length > 0 && fm.journal && fm.year) {
			fm.aliases.push(`${fm.authors[0]}. ${fm.journal}. ${fm.year}`);
		}
		fm.aliases.push(item['title']);
		// add or remove author tag
		if (fm.authors && fm.authors.length > 0) {
			let authorTag = fm.authors[0]
				.replace(/[&:;,'"\\?!<>|()\[\]{}\.\s]/g, '_')
				.replace(/_+/g, '_')
				.replace(/^_+|_+$/g, '');
			authorTag = `author/${authorTag}`;
			if (settings.includeAuthorTag) {
				if (!fm.tags.includes(authorTag)) {
					fm.tags.push(authorTag);
				}
			} else {
				const index = fm.tags.indexOf(authorTag);
				if (index > -1) {
					fm.tags.splice(index, 1);
				}
			}
		}
		// add or remove journal tag
		if (fm.journal) {
			let journalTag = fm.journal
				.replace(/[&:;,'"\\?!<>|()\[\]{}\.\s]/g, '_')
				.replace(/_+/g, '_')
				.replace(/^_+|_+$/g, '');
			journalTag = `journal/${journalTag}`;
			if (settings.includeJournalTag) {
				if (!fm.tags.includes(journalTag)) {
					fm.tags.push(journalTag);
				}
			} else {
				const index = fm.tags.indexOf(journalTag);
				if (index > -1) {
					fm.tags.splice(index, 1);
				}
			}
		}

		// add optional fields from priority entry
		const optionalFields = settings.optionalFields
			? settings.optionalFields.split("\n").map(f => f.trim()).filter(Boolean)
			: [];
		for (const field of optionalFields) {
			if (item[field] !== undefined) {
				const value = item[field];
				if (
					typeof value === "string" ||
					typeof value === "number" ||
					(Array.isArray(value) && value.every((v: any) =>
						typeof v === "string" || typeof v === "number"
					))
				) {
					fm[field] = value;
				}
			}
		}

		// Merge from duplicate entries (after all priority values are set)
		const duplicates: any[] = item['_duplicates'] || [];
		for (const dup of duplicates) {
			// Base properties
			const dupVals = extractValues(dup);
			for (const [key, val] of Object.entries(dupVals)) {
				if (val === undefined) continue;
				if (getStrategy(settings.mergeStrategies, key) === 'merge') {
					fm[key] = mergeValues(fm[key], val);
				}
			}
			// Optional fields
			for (const field of optionalFields) {
				if (dup[field] === undefined) continue;
				if (getStrategy(settings.mergeStrategies, field) === 'merge') {
					const value = dup[field];
					if (
						typeof value === "string" ||
						typeof value === "number" ||
						(Array.isArray(value) && value.every((v: any) =>
							typeof v === "string" || typeof v === "number"
						))
					) {
						fm[field] = mergeValues(fm[field], value);
					}
				}
			}
			// BBT-specific base fields
			if (dup['_bbt']) {
				if (settings.includeBbtPdf && dup['pdf'] !== undefined && getStrategy(settings.mergeStrategies, 'pdf') === 'merge') {
					fm.pdf = mergeValues(fm.pdf, dup['pdf']);
				}
				if (settings.includeBbtCollections && dup['collections'] !== undefined && getStrategy(settings.mergeStrategies, 'collections') === 'merge') {
					fm.collections = mergeValues(fm.collections, dup['collections']);
				}
			}
		}
	});
}
