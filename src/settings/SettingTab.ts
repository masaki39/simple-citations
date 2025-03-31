import { App, PluginSettingTab, Setting } from "obsidian";
import SimpleCitations from "../main";

export class SimpleCitationsSettingTab extends PluginSettingTab {
	plugin: SimpleCitations;

	constructor(app: App, plugin: SimpleCitations) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Basic Settings' });
		new Setting(containerEl)
			.setName('Set bibliography file path')
			.setDesc('Better CSL JSON')
			.addText(text => text
				.setPlaceholder('Enter Relative Path')
				.setValue(this.plugin.settings.jsonPath)
				.onChange(async (value) => {
					this.plugin.settings.jsonPath = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Set literature note folder path')
			.setDesc('Folder to save literature notes. Default: root folder.')
			.addText(text => text
				.setPlaceholder('Enter Relative Path')
				.setValue(this.plugin.settings.folderPath)
				.onChange(async (value) => {
					this.plugin.settings.folderPath = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Auto add citations')
			.setDesc('When enabled, execute add commands automatically when the bibliography file is updated.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoAddCitations)
				.onChange(async (value) => {
					this.plugin.settings.autoAddCitations = value;
					await this.plugin.saveSettings();
				}));
		containerEl.createEl('h2', { text: 'Additional Properties' });
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
		containerEl.createEl('h2', { text: 'Additional Content'});
		new Setting(containerEl)
			.setName('Include abstract to content')
			.setDesc('When enabled, adds the abstract to the top of each literature note.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeAbstract)
				.onChange(async (value) => {
					this.plugin.settings.includeAbstract = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Set template file path')
			.setDesc('When setting this, adds the template to the top of each literature note. (Intended for use with dynamic templates such as Dataview.)')
			.addText(text => text
				.setPlaceholder('Enter Relative Path')
				.setValue(this.plugin.settings.templatePath)
				.onChange(async (value) => {
					this.plugin.settings.templatePath = value;
					await this.plugin.saveSettings();
				}));
		containerEl.createEl('h2', { text: 'Pandoc Settings' });
		new Setting(containerEl)
			.setName('Pandoc path')
			.setDesc('On Mac/Linux use the output of `which pandoc` in terminal; on Windows use the output of `where pandoc` in cmd.')
			.addText(text => text
				.setPlaceholder('pandoc')
				.setValue(this.plugin.settings.inputPandocPath)
				.onChange(async (value) => {
					this.plugin.settings.inputPandocPath = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Export folder')
			.setDesc('Absolute path to an export folder.')
			.addText(text => text
				.setPlaceholder('Same as target')
				.setValue(this.plugin.settings.pandocOutputPath)
				.onChange(async (value) => {
					this.plugin.settings.pandocOutputPath = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Extra Pandoc arguments')
			.setDesc('Add extra command line arguments for pandoc. Absolute path only. New lines are turned into spaces. Citeproc and bibliography are automatically added.')
			.addTextArea(textArea => {
				textArea
					.setPlaceholder('Example: -f markdown+hard_line_breaks')
					.setValue(this.plugin.settings.pandocArgs)
					.onChange(async (value) => {
						this.plugin.settings.pandocArgs = value;
						await this.plugin.saveSettings();
					});
				textArea.inputEl.style.height = '200px';
				textArea.inputEl.style.width = '200px';
			});
				
	}
}