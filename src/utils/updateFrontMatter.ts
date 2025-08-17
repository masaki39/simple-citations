import { App, TFile } from 'obsidian';
import { SimpleCitationsSettings } from '../settings/settings';

export async function updateFrontMatter(
	app: App,
	settings: SimpleCitationsSettings,
	targetFile: TFile,
	item: any
) {
	await app.fileManager.processFrontMatter(targetFile, (fm) => {
		fm.aliases = [];
		if (!Array.isArray(fm.tags)) {
			fm.tags = fm.tags ? [fm.tags] : [];
		}			
		fm.title = item['title'];
		if (item['author'] && Array.isArray(item['author'])) {
			fm.authors = Array.from(new Set(
				item['author'].map(author =>
					(author.literal || `${author.given ?? ""} ${author.family ?? ""}`).trim()
				)
			));				
		}
		if (item['issued'] && Array.isArray(item['issued']['date-parts']) && item['issued']['date-parts'][0] && !isNaN(item['issued']['date-parts'][0][0])) {
			fm.year = Number(item['issued']['date-parts'][0][0]);
		}
		fm.journal = item['container-title'];
		fm.doi = item['DOI'] ? `https://doi.org/${item['DOI']}` : "";
		fm.zotero = "zotero://select/items/@" + item['id'];
		if (fm.authors && fm.authors.length > 0 && fm.journal && fm.year) {
			fm.aliases.push(`${fm.authors[0]}. ${fm.journal}. ${fm.year}`);
		}
		fm.aliases.push(item['title']);
		// add or remove author tag
		if (fm.authors && fm.authors.length > 0) {
			let authorTag = fm.authors[0]
				.replace(/[&:;,'"\\?!<>|()\[\]{}\.\s]/g, '_') // スペース & 記号をすべてアンダースコアに
				.replace(/_+/g, '_')  // 連続するアンダースコアを1つに圧縮
				.replace(/^_+|_+$/g, ''); // 先頭・末尾のアンダースコアを削除
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
				.replace(/[&:;,'"\\?!<>|()\[\]{}\.\s]/g, '_') // スペース & 記号をすべてアンダースコアに
				.replace(/_+/g, '_')  // 連続するアンダースコアを1つに圧縮
				.replace(/^_+|_+$/g, ''); // 先頭・末尾のアンダースコアを削除
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

		// add optional fields
		if (settings.optionalFields) {
			const optionalFields = settings.optionalFields
				.split("\n")
				.map(f => f.trim())
				.filter(Boolean);
			for (const field of optionalFields) {
				if (item[field] !== undefined) {
					const value = item[field];
					if (
						typeof value === "string" ||
						typeof value === "number" ||
						(Array.isArray(value) && value.every(v =>
							typeof v === "string" || typeof v === "number"
						))
					) {
						fm[field] = value;
					}
					// それ以外（オブジェクト等）は無視
				}
			}
		}
	});
}