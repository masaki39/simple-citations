import { Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { spawn } from 'child_process';
import { DEFAULT_SETTINGS, SimpleCitationsSettings } from './settings/settings';
import { SimpleCitationsSettingTab } from './settings/SettingTab';
import { autoAddCitations } from './commands/AutoAddCitations';
import { updateContent } from './utils/updateContent';
import { checkRequiredFiles } from './utils/checkRequiredFiles';

export default class SimpleCitations extends Plugin {
	settings: SimpleCitationsSettings;
	
	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'update-citations',
			name: 'Update literature notes',
			callback: async () => {
				const startTime = performance.now(); // start time

				const { jsonFile, folder, templateFile } = checkRequiredFiles(this.app, this.settings);
				if (!jsonFile || !folder) return;

				// parse json Data and files
				const jsonContents = await this.app.vault.cachedRead(jsonFile);
				const jsonData = JSON.parse(jsonContents);
				const files = new Map(folder.children.map(file => [file.name, file])); // マップ化
				let templateContent = templateFile ? await this.app.vault.cachedRead(templateFile) : "";
				let fileCount: number = 0;

				// progress notice
				let notice = new Notice(`0 file(s) updated.`, 0);
				const intervalId = setInterval(() => {
					notice.setMessage(`${fileCount} file(s) updated.`);
				}, 200);

				// check json file
				for (let i = 0; i < jsonData.length; i++) {
					const citekey = jsonData[i]?.['citation-key'];
					if (!citekey) continue; // `citation-key` がないデータはスキップ
					const targetFileName = "@" + citekey + ".md";
					const targetFile = files.get(targetFileName); // O(1) の高速検索

					// update frontmatter
					if (targetFile && targetFile instanceof TFile) {
						await this.updateFrontMatter(targetFile,jsonData[i]);
						await updateContent(
							this.app,
							targetFile,
							templateContent,
							this.settings.includeAbstract ? jsonData[i]['abstract'] : ""
						);
						fileCount++;
					}
				}
				// stop timer
				clearInterval(intervalId);
				const endTime = performance.now(); // end time
				const elapsedTime = ((endTime - startTime) / 1000).toFixed(1);
				notice.setMessage(`${fileCount} file(s) updated.\nTime taken: ${elapsedTime} seconds`);
				// hide notice after 3 seconds
				setTimeout(() => {
					notice.hide();
				}, 3000);
			}
		});

		this.addCommand({
			id: 'add-citations',
			name: 'Add literature notes',
			callback: async () => {
				const startTime = performance.now(); // start time

				const { jsonFile, folder, templateFile } = checkRequiredFiles(this.app, this.settings);
				if (!jsonFile || !folder) return;
				
				// parse json Data and files
				const jsonContents = await this.app.vault.cachedRead(jsonFile);
				const jsonData = JSON.parse(jsonContents);
				const files = new Map(folder.children.map(file => [file.name, file])); // マップ化
				let templateContent = templateFile ? await this.app.vault.cachedRead(templateFile) : "";
				let fileCount: number = 0;
				
				let notice = new Notice(`0 file(s) added.`, 0);
				const intervalId = setInterval(() => {
					notice.setMessage(`${fileCount} file(s) added.`);
				}, 200);
				
				// check json file
				for (let i = 0; i < jsonData.length; i++) {
					const citekey = jsonData[i]?.['citation-key'];
					if (!citekey) continue; // `citation-key` がないデータはスキップ
					const targetFileName = "@" + citekey + ".md";
					const targetFile = files.get(targetFileName); // O(1) の高速検索

					// if nonexisting, create file
					if (!targetFile){
						const newFile = await this.app.vault.create(`${folder.path}/${targetFileName}`,"");
						await this.updateFrontMatter(newFile,jsonData[i]);
						await updateContent(
							this.app,
							newFile,
							templateContent,
							this.settings.includeAbstract ? jsonData[i]['abstract'] : ""
						);
						fileCount ++;
					}
				}
				// stop timer
				clearInterval(intervalId);
				const endTime = performance.now(); // end time
				const elapsedTime = ((endTime - startTime) / 1000).toFixed(1);
				notice.setMessage(`${fileCount} file(s) added.\nTime taken: ${elapsedTime} seconds`);
				// hide notice after 3 seconds
				setTimeout(() => {
					notice.hide();
				}, 3000);

				// update json updated time
				this.settings.jsonUpdatedTime = new Date(jsonFile.stat.mtime).getTime();
				this.saveSettings();
			}
		});

		this.addCommand({
			id: 'execute-pandoc',
			name: 'Pandoc Citeproc Execution (docx)',
			callback: async () => {
				// get file
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice('No active file.');
				return;
				}
				const content = await this.app.vault.read(activeFile);

				// replace
				let newContent = await content.replace(/\[\[(.*?)\|.*?\]\]/g, "[[$1]]"); // fix aliases 
				newContent = newContent.replace(/\[\[@(.*?)\]\]/g, "[@$1]"); // convert to pandoc style
				newContent = newContent.replace(/\](\s*?)\[@/g, ";@"); // connect citations
				newContent = newContent.replace(/(\.)\s*?(\[@.*?\])/g, "$2$1 "); // insert before period

				// modify file content
				await this.app.vault.modify(activeFile, newContent);

				// pandoc settings
				const BasePath = (this.app.vault.adapter as any).getBasePath(); // get base path
				const PandocPath = normalizePath(this.settings.inputPandocPath) || "pandoc"; // pandoc path
				const CurrentFilePath = normalizePath(activeFile.path); // current file path
				const CurrentFileFolder = CurrentFilePath.split("/").slice(0, -1).join("/"); // current file folder
				const CurrentFileName = CurrentFilePath.split("/").pop(); // current file name
				const PandocInputFile = BasePath + "/" + CurrentFilePath; // input file
				const PandocOutputPath = this.settings.pandocOutputPath ? normalizePath(this.settings.pandocOutputPath) : BasePath + "/" + CurrentFileFolder; // output path
				const PandocOutputFile = PandocOutputPath + "/" + CurrentFileName?.replace(/\.md$/, ".docx"); // output file
				const PandocExtraArgs = this.settings.pandocArgs ? this.settings.pandocArgs.split(/[\s\n]+/) : [];
				const PandocArgs = [
					"--citeproc",
					"--bibliography",
					BasePath + "/" + normalizePath(this.settings.jsonPath),
					...PandocExtraArgs
				];

				// execute pandoc
				try {
					const pandocProcess = spawn(PandocPath, 
						[PandocInputFile, "-o", PandocOutputFile, ...PandocArgs], 
						{env: process.env});

					// error handling
					pandocProcess.on('error', (err) => {
						new Notice(`Pandoc execution failed: ${err.message}`);
					});

					// close handling
					pandocProcess.on('close', async (code) => {
						if (code === 0) {
							new Notice('Pandoc execution completed successfully.');
						} else {
							new Notice(`Pandoc execution failed with code: ${code}`);
						}
						// Ensure the file content is always restored after pandoc process is closed
						await this.app.vault.modify(activeFile, content);
					});
				} catch (error) {
					new Notice(`An error occurred: ${error.message}`);
					// Ensure the file content is always restored after pandoc process is closed
					await this.app.vault.modify(activeFile, content);
				}
			}
		});

		this.addCommand({
			id: 'copy-missing-note-links',
			name: 'Copy missing note links not included in json file',
			callback: async () => {

				const { jsonFile, folder } = checkRequiredFiles(this.app, this.settings);
				if (!jsonFile || !folder) return;

				// parse json Data and file names
				const jsonContents = await this.app.vault.cachedRead(jsonFile);
				const jsonData = JSON.parse(jsonContents);
				const files = folder.children.filter(file => file instanceof TFile);
				const fileNames = files.map(file => file.name.replace(/\.md$/, ""));
				// get citation keys
				const citationKeys = new Set(jsonData.map((entry: { [x: string]: any; }) => entry["citation-key"]));
				// get missing files
				const missingFiles = fileNames.filter(fileName => !citationKeys.has(fileName.slice(1)));
				if (missingFiles.length === 0) {
					new Notice("No missing notes found.");
					return;
				}		
				// copy missing links
				const missingLinks = missingFiles.map(fileName => `[[${fileName}]]`).join("\n");
				await navigator.clipboard.writeText(missingLinks);
				new Notice("Copied missing note links to clipboard!");
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SimpleCitationsSettingTab(this.app, this));
		
		// watch json file
		this.registerEvent(this.app.vault.on('modify', file => {
			autoAddCitations(this.app, this.settings, file as TFile);
		}));

		// auto execute add citations command at start
		this.app.workspace.onLayoutReady(() => {
			autoAddCitations(this.app, this.settings, this.app.vault.getFileByPath(normalizePath(this.settings.jsonPath)) as TFile);
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async updateFrontMatter(targetFile: TFile, item: any) {
		await this.app.fileManager.processFrontMatter(targetFile, (fm) => {
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
				if (this.settings.includeAuthorTag) {
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
				if (this.settings.includeJournalTag) {
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
		});
	}
}