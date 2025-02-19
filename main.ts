import {App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, normalizePath } from 'obsidian';

interface SimpleCitationsSettings {
	jsonPath: string;
	folderPath: string;
	includeAuthorTag: boolean;
	includeJournalTag: boolean;
}

const DEFAULT_SETTINGS: SimpleCitationsSettings = {
	jsonPath: "",
	folderPath: "",
	includeAuthorTag: false,
	includeJournalTag: false,
}

export default class SimpleCitations extends Plugin {
	settings: SimpleCitationsSettings;
	
	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'update-citations',
			name: 'Update literature notes',
			callback: async () => {
				// normalize path
				const normalizedJsonPath = normalizePath(this.settings.jsonPath);
				const normalizedFolderPath = normalizePath(this.settings.folderPath);

				// get json and folder existing check
				const jsonFile = this.app.vault.getFileByPath(`${normalizedJsonPath}`);
				const folder = this.app.vault.getAbstractFileByPath(`${normalizedFolderPath}`);
				if (!jsonFile || !(folder instanceof TFolder)) {
					new Notice('Something wrong with the settings.');
					return; 
				}

				// parse json Data and files
				const jsonContents = await this.app.vault.cachedRead(jsonFile);
				const jsonData = JSON.parse(jsonContents);
				const files = folder.children;
				let fileCount: number = 0;
				
				// check json file
				for (let i = 0; i < jsonData.length; i++) {
					const citekey = jsonData[i]['citation-key'];
					const targetFileName = "@" + citekey + ".md";
					const targetFile = files.find(file => file.name === targetFileName);

					// update frontmatter
					if (targetFile && targetFile instanceof TFile) {
						await this.updateFrontMatter(targetFile,jsonData[i]);
						fileCount++;
					}
				}
				new Notice(`${fileCount} file(s) updated.`);
			}
		});

		this.addCommand({
			id: 'add-citations',
			name: 'Add literature notes',
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
				
				// parse json Data and files
				const jsonContents = await this.app.vault.cachedRead(jsonFile);
				const jsonData = JSON.parse(jsonContents);
				const files = folder.children;
				let fileCount:number = 0; // check new file num
				// console.log(jsonData);
				
				// check json file
				for (let i = 0; i < jsonData.length; i++) {
					const citekey = jsonData[i]['citation-key'];
					const targetFileName = "@" + citekey + ".md";
					const targetFile = files.find(file => file.name === targetFileName);

					// if nonexisting, create file
					if (!targetFile){
						const newFile = await this.app.vault.create(`${normalizedFolderPath}/${targetFileName}`,"");
						await this.updateFrontMatter(newFile,jsonData[i]);
						fileCount ++;
					}
				}
				if (fileCount == 0 ) {
					new Notice("No additional file(s).");
				} else {
					new Notice(`${fileCount} file(s) added.`);
				}
				
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
				let authorsSet = new Set<string>(); 
				item['author'].forEach((author: { given?: string; family?: string; literal?: string }) => {
					let authorName = author.literal || `${author.given} ${author.family}`;
					authorsSet.add(authorName.trim());
				});
				let authorsList = Array.from(authorsSet);
				fm.authors = authorsList;
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
			.setName('Include Author Tag')
			.setDesc('When enabled, adds a tag with the first author\'s name.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeAuthorTag)
				.onChange(async (value) => {
					this.plugin.settings.includeAuthorTag = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Include Journal Tag')
			.setDesc('When enabled, adds a tag with the journal name.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeJournalTag)
				.onChange(async (value) => {
					this.plugin.settings.includeJournalTag = value;
					await this.plugin.saveSettings();
				}));
	}
}
