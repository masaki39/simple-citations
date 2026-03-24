import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import SimpleCitations from "../main";
import { updateSettingJsonStatus, updateSettingFolderStatus, updateSettingTemplateStatus } from "../utils/fileStatus";
import { JsonFileSuggest } from "./FileSuggest";

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

		// Bibliography file paths — single setting block
		const bibSetting = new Setting(containerEl)
			.setName('Bibliography file paths')
			.setDesc('Better CSL JSON files. Earlier entries have higher priority when duplicate citation keys exist.')
			.addButton(button => button
				.setButtonText('+ Add file')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.jsonPaths.push('');
					this.plugin.settings.jsonNames.push('');
					await this.plugin.saveSettings();
					this.display();
				}));

		bibSetting.settingEl.addClass('simple-citations-bib-setting');
		const bibListEl = bibSetting.settingEl.createDiv({ cls: 'simple-citations-bib-list' });
		const paths = this.plugin.settings.jsonPaths;

		if (paths.length === 0) {
			bibListEl.createEl('p', {
				text: 'No bibliography files added yet.',
				cls: 'simple-citations-bib-empty',
			});
		}

		for (let i = 0; i < paths.length; i++) {
			const idx = i;
			const rowEl = bibListEl.createDiv({ cls: 'simple-citations-bib-row' });

			// Left: info
			const infoEl = rowEl.createDiv({ cls: 'simple-citations-bib-info' });

			const defaultName = paths[idx]?.split('/').pop()?.replace(/\.json$/, '') || '';
			const displayName = this.plugin.settings.jsonNames[idx]?.trim() || defaultName;

			const showDisplay = () => {
				infoEl.empty();
				// Main name (large)
				const nameRow = infoEl.createDiv({ cls: 'simple-citations-bib-name' });
				const statusSpan = nameRow.createSpan();
				updateSettingJsonStatus(this.app, statusSpan, paths[idx]);
				nameRow.createSpan({ text: displayName || '(unnamed)' });
				// Path as subtitle
				infoEl.createDiv({
					text: paths[idx] || '(empty path)',
					cls: 'simple-citations-bib-path',
				});
			};

			const showEditor = () => {
				infoEl.empty();
				// Name input
				const nameInput = infoEl.createEl('input', { type: 'text', cls: 'simple-citations-bib-input' });
				nameInput.value = this.plugin.settings.jsonNames[idx] || '';
				nameInput.placeholder = `Display name (default: ${defaultName})`;

				// Path input with file suggest
				const pathInput = infoEl.createEl('input', { type: 'text', cls: 'simple-citations-bib-input simple-citations-bib-input-path' });
				pathInput.value = paths[idx];
				pathInput.placeholder = 'Search for a .json file';
				new JsonFileSuggest(this.app, pathInput);

				// Focus the first non-empty field, or path if new
				if (!paths[idx]) {
					pathInput.focus();
				} else {
					nameInput.focus();
				}

				const save = async () => {
					// Delay to let the other input's blur not race
					await new Promise(r => setTimeout(r, 100));
					if (!pathInput.value && !document.activeElement?.closest('.simple-citations-bib-row')) {
						// Remove if path is empty and focus left the row
						this.plugin.settings.jsonPaths.splice(idx, 1);
						this.plugin.settings.jsonNames.splice(idx, 1);
						await this.plugin.saveSettings();
						this.display();
						return;
					}
					this.plugin.settings.jsonPaths[idx] = pathInput.value;
					this.plugin.settings.jsonNames[idx] = nameInput.value;
					await this.plugin.saveSettings();
					// Only re-render if focus left this row entirely
					if (!document.activeElement?.closest('.simple-citations-bib-row')) {
						this.display();
					}
				};

				nameInput.addEventListener('blur', save);
				pathInput.addEventListener('blur', save);
				nameInput.addEventListener('keydown', (e) => {
					if (e.key === 'Enter') { pathInput.focus(); }
				});
				pathInput.addEventListener('keydown', (e) => {
					if (e.key === 'Enter') { pathInput.blur(); }
				});
			};

			// Auto-open editor for empty paths, otherwise show display
			if (!paths[i]) {
				showEditor();
			} else {
				showDisplay();
			}

			// Right: buttons
			const btnGroup = rowEl.createDiv({ cls: 'simple-citations-bib-buttons' });

			// Move up
			if (i > 0) {
				const upBtn = btnGroup.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Move up' } });
				setIcon(upBtn, 'arrow-up');
				upBtn.addEventListener('click', async () => {
					const names = this.plugin.settings.jsonNames;
					[paths[idx - 1], paths[idx]] = [paths[idx], paths[idx - 1]];
					[names[idx - 1], names[idx]] = [names[idx], names[idx - 1]];
					await this.plugin.saveSettings();
					this.display();
				});
			}

			// Move down
			if (i < paths.length - 1) {
				const downBtn = btnGroup.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Move down' } });
				setIcon(downBtn, 'arrow-down');
				downBtn.addEventListener('click', async () => {
					const names = this.plugin.settings.jsonNames;
					[paths[idx], paths[idx + 1]] = [paths[idx + 1], paths[idx]];
					[names[idx], names[idx + 1]] = [names[idx + 1], names[idx]];
					await this.plugin.saveSettings();
					this.display();
				});
			}

			// Edit
			const editBtn = btnGroup.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Edit path' } });
			setIcon(editBtn, 'pencil');
			editBtn.addEventListener('click', () => showEditor());

			// Delete
			const delBtn = btnGroup.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Remove' } });
			setIcon(delBtn, 'x');
			delBtn.addEventListener('click', async () => {
				this.plugin.settings.jsonPaths.splice(idx, 1);
				this.plugin.settings.jsonNames.splice(idx, 1);
				await this.plugin.saveSettings();
				this.display();
			});
		}

		new Setting(containerEl)
			.setName('Set literature note folder path')
			.setDesc('Folder to save literature notes. Default: root folder.')
			.addText(text => {
				const container = text.inputEl.parentElement;
				let statusSpan: HTMLElement | null = null;
				if (container) {
					statusSpan = container.insertBefore(document.createElement('span'), text.inputEl);

					updateSettingFolderStatus(this.app, statusSpan, this.plugin.settings.folderPath);
				}
				return text
					.setPlaceholder('Enter Relative Path')
					.setValue(this.plugin.settings.folderPath)
					.onChange(async (value) => {
						this.plugin.settings.folderPath = value;
						await this.plugin.saveSettings();
						if (container && statusSpan) {
							updateSettingFolderStatus(this.app, statusSpan, value);
						}
					});
			});
		new Setting(containerEl)
			.setName('Auto add citations')
			.setDesc('When enabled, execute add commands automatically when any bibliography file is updated.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoAddCitations)
				.onChange(async (value) => {
					this.plugin.settings.autoAddCitations = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Auto update citations')
			.setDesc('When enabled, automatically updates citation notes when opened.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoUpdateCitations)
				.onChange(async (value) => {
					this.plugin.settings.autoUpdateCitations = value;
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
		new Setting(containerEl)
			.setName('Include collections')
			.setDesc('When enabled, adds collections to the "collections" property. Each collection is prefixed with its bibliography name (e.g. "My Library: Folder"). Entries in multiple files have their collections merged and deduplicated. Entries without collections show the bibliography name alone.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeCollections)
				.onChange(async (value) => {
					this.plugin.settings.includeCollections = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Optional fields')
			.setDesc('Set optional fields from JSON. (Separate by line breaks, 1st level only)')
			.addTextArea(textArea => textArea
				.setPlaceholder('key\npdf')
				.setValue(this.plugin.settings.optionalFields)
				.onChange(async (value) => {
					this.plugin.settings.optionalFields = value;
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
			.addText(text => {
				const container = text.inputEl.parentElement;
				let statusSpan: HTMLElement | null = null;
				if (container) {
					statusSpan = container.insertBefore(document.createElement('span'), text.inputEl);

					updateSettingTemplateStatus(this.app, statusSpan, this.plugin.settings.templatePath);
				}
				return text
					.setPlaceholder('Enter Relative Path')
					.setValue(this.plugin.settings.templatePath)
					.onChange(async (value) => {
						this.plugin.settings.templatePath = value;
						await this.plugin.saveSettings();
						if (container && statusSpan) {
							updateSettingTemplateStatus(this.app, statusSpan, value);
						}
					});
			});
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
