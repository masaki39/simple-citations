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
				// console.log(jsonData);
				
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
				new Notice(fileCount ? `${fileCount} file(s) added.` : "No additional file(s).");
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
			const parts = content.split("<!-- START_TEMPLATE -->", 2);
			if (parts.length > 1) {
				const afterTag = parts[1].split("<!-- END_TEMPLATE -->", 2);
				if (afterTag.length < 2) {
					return content;
				}
				return template
					? `${parts[0]}<!-- START_TEMPLATE -->\n${template}\n<!-- END_TEMPLATE -->${afterTag.length > 1 ? afterTag[1] : ""}`
					: `${parts[0]}${afterTag.length > 1 ? afterTag[1] : ""}`;
			}
			return template ? content + `\n\n<!-- START_TEMPLATE -->\n${template}\n<!-- END_TEMPLATE -->` : content;
		});
	}
	

	async applyAbstract(targetFile: TFile, abstract: string) {
		await this.app.vault.process(targetFile, (content: string) => {
			if (abstract) {
				abstract = abstract
				.replace(/[ \t]+/g, " ") // 連続するスペース・タブを1つに統一
				.replace(/\n+/g, "\n") // 連続する改行を1つに統一
				.trim(); // 先頭・末尾の不要な空白を削除
			}
			const parts = content.split("<!-- START_ABSTRACT -->", 2);
			if (parts.length > 1) {
				const afterTag = parts[1].split("<!-- END_ABSTRACT -->", 2);
				if (afterTag.length < 2) {
					return content;
				}
				return abstract
					? `${parts[0]}<!-- START_ABSTRACT -->\n${abstract}\n<!-- END_ABSTRACT -->${afterTag.length > 1 ? afterTag[1] : ""}`
					: `${parts[0]}${afterTag.length > 1 ? afterTag[1] : ""}`;
			}
			return abstract ? content + `\n\n<!-- START_ABSTRACT -->\n${abstract}\n<!-- END_ABSTRACT -->` : content;
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
