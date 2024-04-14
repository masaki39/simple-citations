import {App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';


// Remember to rename these classes and interfaces!

interface SimpleCitationsSettings {
	jsonPath: string;
	folderPath: string;
}

const DEFAULT_SETTINGS: SimpleCitationsSettings = {
	jsonPath: 'MyLibrary.json',
	folderPath: "Literatures",
}

export default class SimpleCitations extends Plugin {
	settings: SimpleCitationsSettings;
	
	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'update-citations',
			name: 'Update Literature Notes',
			callback: async () => {

				// get json and folder exsistiing check
				const jsonFile = this.app.vault.getFileByPath("mylibrary.json");
				const folder = this.app.vault.getAbstractFileByPath("Literatures");
				if (!jsonFile || !(folder instanceof TFolder)) {
					new Notice('Something wrong with the settings.');
					return; 
				}
				
				// parse json Data and files
				const jsonContents = await this.app.vault.cachedRead(jsonFile);
				const jsonData = JSON.parse(jsonContents);
				const files = folder.children;
				
				// check json file
				for (let i = 0; i < jsonData.length; i++) {
					const citekey = jsonData[i]['citation-key'];
					const targetFileName = "@" + citekey + ".md";
					let targetFile = files.find(file => file.name === targetFileName);

					// if nonexisting, create file
					if (!targetFile){
						await this.app.vault.create(`Literatures/${targetFileName}`,"");
						targetFile = await this.app.vault.getFileByPath(`Literatures/${targetFileName}`) as TFile;
					}
					// update frontmatter
					if (targetFile && targetFile instanceof TFile) {
						await this.updateFrontMatter(targetFile,jsonData[i]);
						
					}
				}
			}
		});

		this.addCommand({
			id: 'add-citations',
			name: 'Add Literature Notes',
			callback: async () => {

				// get json and folder exsistiing check
				const jsonFile = this.app.vault.getFileByPath("mylibrary.json");
				const folder = this.app.vault.getAbstractFileByPath("Literatures");
				if (!jsonFile || !(folder instanceof TFolder)) {
					new Notice('Something wrong with the settings.');
					return; 
				}
				
				// parse json Data and files
				const jsonContents = await this.app.vault.cachedRead(jsonFile);
				const jsonData = JSON.parse(jsonContents);
				const files = folder.children;
				
				// check json file
				for (let i = 0; i < jsonData.length; i++) {
					const citekey = jsonData[i]['citation-key'];
					const targetFileName = "@" + citekey + ".md";
					let targetFile = files.find(file => file.name === targetFileName);

					// if nonexisting, create file
					if (!targetFile){
						await this.app.vault.create(`Literatures/${targetFileName}`,"");
						targetFile = await this.app.vault.getFileByPath(`Literatures/${targetFileName}`) as TFile;
						if (targetFile && targetFile instanceof TFile){
							await this.updateFrontMatter(targetFile,jsonData[i]);
						}
					}
				}
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
			fm.aliases = item['title'];
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
			fm.doi = "https://doi.org/" + item['DOI'];
			fm.zotero = "zotero://select/items/@" + item['id'];
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
			.setName('Set Json File Path')
			.addText(text => text
				.setPlaceholder('Enter path')
				.setValue(this.plugin.settings.jsonPath)
				.onChange(async (value) => {
					this.plugin.settings.jsonPath = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Set Literature Note Folder Path')
			.addText(text => text
				.setPlaceholder('Enter path')
				.setValue(this.plugin.settings.folderPath)
				.onChange(async (value) => {
					this.plugin.settings.folderPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
