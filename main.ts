import {App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, normalizePath } from 'obsidian';

interface SimpleCitationsSettings {
	jsonPath: string;
	folderPath: string;
	includeAuthorTag: boolean;
	includeJournalTag: boolean;
	includeAbstract: boolean;
	templatePath: string;
}

const DEFAULT_SETTINGS: SimpleCitationsSettings = {
	jsonPath: "",
	folderPath: "",
	includeAuthorTag: false,
	includeJournalTag: false,
	includeAbstract: false,
	templatePath: "",
}

export default class SimpleCitations extends Plugin {
	settings: SimpleCitationsSettings;
	
	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'update-citations',
			name: 'Update literature notes',
			callback: async () => {
				const startTime = performance.now(); // start time
				// normalize path
				const normalizedJsonPath = normalizePath(this.settings.jsonPath);
				const normalizedFolderPath = normalizePath(this.settings.folderPath);
				const normalizedTemplatePath = normalizePath(this.settings.templatePath + ".md");

				// get json and folder existing check
				const jsonFile = this.app.vault.getFileByPath(`${normalizedJsonPath}`);
				const folder = this.app.vault.getAbstractFileByPath(`${normalizedFolderPath}`);
				const templateFile = this.app.vault.getFileByPath(`${normalizedTemplatePath}`);
				if (!jsonFile || !(folder instanceof TFolder)) {
					new Notice('Something wrong with the settings.');
					return; 
				}

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
						await this.applyTemplate(targetFile, templateContent);
						await this.applyAbstract(targetFile, this.settings.includeAbstract ? jsonData[i]['abstract'] : "");
						fileCount++;
					}
				}
				// stop timer
				clearInterval(intervalId);
				const endTime = performance.now(); // end time
				const elapsedTime = ((endTime - startTime) / 1000).toFixed(1);
				notice.setMessage(`${fileCount} file(s) updated.\nTime taken: ${elapsedTime} seconds`);
				// hide notice after 5 seconds
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
				// normalize path
				const normalizedJsonPath = normalizePath(this.settings.jsonPath);
				const normalizedFolderPath = normalizePath(this.settings.folderPath);
				const normalizedTemplatePath = normalizePath(this.settings.templatePath + ".md");

				// get json and folder exsistiing check
				const jsonFile = this.app.vault.getFileByPath(`${normalizedJsonPath}`);
				const folder = this.app.vault.getAbstractFileByPath(`${normalizedFolderPath}`);
				const templateFile = this.app.vault.getFileByPath(`${normalizedTemplatePath}`);
				if (!jsonFile || !(folder instanceof TFolder)) {
					new Notice('Something wrong with the settings.');
					return; 
				}
				
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
						const newFile = await this.app.vault.create(`${normalizedFolderPath}/${targetFileName}`,"");
						await this.updateFrontMatter(newFile,jsonData[i]);
						await this.applyTemplate(newFile, templateContent);
						if (this.settings.includeAbstract) {
							await this.applyAbstract(newFile, jsonData[i]['abstract']);
						} else {
							await this.applyAbstract(newFile, "");
						}
						fileCount ++;
					}
				}
				// stop timer
				clearInterval(intervalId);
				const endTime = performance.now(); // end time
				const elapsedTime = ((endTime - startTime) / 1000).toFixed(1);
				notice.setMessage(`${fileCount} file(s) added.\nTime taken: ${elapsedTime} seconds`);
				// hide notice after 5 seconds
				setTimeout(() => {
					notice.hide();
				}, 3000);
			}
		});

		this.addCommand({
			id: 'execute-pandoc',
			name: 'Modified export (docx)',
			callback: async () => {
				// get file
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice('No active file.');
				return;
				}
				const content = await this.app.vault.read(activeFile);

				// check if the command exists
				const commandId = "obsidian-pandoc:pandoc-export-docx";
				const commands = (this.app as any).commands;
				const commandExist = commands.listCommands().some((cmd: any) => cmd.id === commandId);
				if (!commandExist){
					new Notice("Install Pandoc Plugin");
				return;
				}

				// replace
				let newContent = await content.replace(/\[\[(.*?)\|.*?\]\]/g, "[[$1]]"); // fix aliases 
				newContent = newContent.replace(/\[\[@(.*?)\]\]/g, "[@$1]"); // convert to pandoc style
				newContent = newContent.replace(/\](\s*?)\[@/g, ";@"); // connect citations
				newContent = newContent.replace(/(\.)\s*?(\[@.*?\])/g, "$2$1 "); // insert before period

				// modify file
				await this.app.vault.modify(activeFile, newContent);

				// execute
				await commands.executeCommandById(commandId);
				new Notice ("Wait for 5 seconds.");

				// Delay for a specific time (5 seconds)
				await new Promise(resolve => setTimeout(resolve, 5000));

				// return
				await this.app.vault.modify(activeFile, content);
			}
		});

		this.addCommand({
			id: 'copy-missing-note-links',
			name: 'Copy missing note links not included in json file',
			callback: async () => {
				// normalize path
				const normalizedJsonPath = normalizePath(this.settings.jsonPath);
				const normalizedFolderPath = normalizePath(this.settings.folderPath);
				// get json and folder exsistiing check
				const jsonFile = this.app.vault.getFileByPath(`${normalizedJsonPath}`);
				const folder = this.app.vault.getAbstractFileByPath(`${normalizedFolderPath}`);
				if (!jsonFile || !(folder instanceof TFolder)) {
					new Notice('Something wrong with the settings.');
					return;
				}
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
		
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async updateFrontMatter(targetFile: TFile, item: any) {
		await this.app.fileManager.processFrontMatter(targetFile, (fm) => {
			fm.aliases = [];
			if (!Array.isArray(fm.tags)) { // check if tags is an array
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

	async applyTemplate(targetFile: TFile, template: string) {
		await this.app.vault.process(targetFile, (content: string) => {
			const startTag = "<!-- START_TEMPLATE -->";
			const endTag = "<!-- END_TEMPLATE -->";
			let startIndex = content.indexOf(startTag);
			let endIndex = content.indexOf(endTag);
			// `END_TEMPLATE` だけがある場合、削除する
			if (startIndex === -1 && endIndex !== -1) {
				content = content.slice(0, endIndex) + content.slice(endIndex + endTag.length);
				endIndex = -1; // 削除後、リセット
			}
			if (startIndex !== -1) {
				let beforeTag = content.slice(0, startIndex);
				let afterTag = endIndex !== -1 ? content.slice(endIndex + endTag.length) : "";
				return template
					? `${beforeTag}${startTag}\n${template}\n${endTag}${afterTag}`
					: `${beforeTag}${afterTag}`;
			}
			return template
				? `${content.trimEnd()}\n\n${startTag}\n${template}\n${endTag}`
				: content;
		});
	}
	
	async applyAbstract(targetFile: TFile, abstract: string) {
		await this.app.vault.process(targetFile, (content: string) => {
			if (abstract) {
				abstract = abstract.replace(/\s+/g, " ").trim();
			}
			const startTag = "<!-- START_ABSTRACT -->";
			const endTag = "<!-- END_ABSTRACT -->";
			let startIndex = content.indexOf(startTag);
			let endIndex = content.indexOf(endTag);
			// `END_ABSTRACT` だけがある場合、削除する
			if (startIndex === -1 && endIndex !== -1) {
				content = content.slice(0, endIndex) + content.slice(endIndex + endTag.length);
				endIndex = -1; // 削除後、リセット
			}
			if (startIndex !== -1) {
				let beforeTag = content.slice(0, startIndex);
				let afterTag = endIndex !== -1 ? content.slice(endIndex + endTag.length) : "";
	
				return abstract
					? `${beforeTag}${startTag}\n${abstract}\n${endTag}${afterTag}`
					: `${beforeTag}${afterTag}`;
			}
			return abstract
				? `${content.trimEnd()}\n\n${startTag}\n${abstract}\n${endTag}`
				: content;
		});
	}
	
}

class SimpleCitationsSettingTab extends PluginSettingTab {
	plugin: SimpleCitations;

	constructor(app: App, plugin: SimpleCitations) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Set json file path')
			.addText(text => text
				.setPlaceholder('Enter Relative Path')
				.setValue(this.plugin.settings.jsonPath)
				.onChange(async (value) => {
					this.plugin.settings.jsonPath = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Set literature note folder path')
			.addText(text => text
				.setPlaceholder('Enter Relative Path')
				.setValue(this.plugin.settings.folderPath)
				.onChange(async (value) => {
					this.plugin.settings.folderPath = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Include author tag')
			.setDesc('When enabled, adds a tag with the first author\'s name.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeAuthorTag)
				.onChange(async (value) => {
					this.plugin.settings.includeAuthorTag = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Include journal tag')
			.setDesc('When enabled, adds a tag with the journal name.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeJournalTag)
				.onChange(async (value) => {
					this.plugin.settings.includeJournalTag = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Include abstract to content')
			.setDesc('When enabled, adds the abstract to the content.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeAbstract)
				.onChange(async (value) => {
					this.plugin.settings.includeAbstract = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Set template file path')
			.addText(text => text
				.setPlaceholder('Enter Relative Path')
				.setValue(this.plugin.settings.templatePath)
				.onChange(async (value) => {
					this.plugin.settings.templatePath = value;
					await this.plugin.saveSettings();
				}));
	}
}
