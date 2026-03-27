import { App, Platform, PluginSettingTab, Setting, setIcon } from "obsidian";
import SimpleCitations from "../main";
import { updateSettingJsonStatus, updateSettingFolderStatus, updateSettingTemplateStatus } from "../utils/fileStatus";
import { JsonFileSuggest } from "./FileSuggest";
import { getStrategy, getDefaultStrategy } from "../utils/mergeStrategies";
import { BASE_PROPERTIES } from "../utils/updateFrontMatter";

export class SimpleCitationsSettingTab extends PluginSettingTab {
	plugin: SimpleCitations;
	private mergeContainer: HTMLElement | null = null;

	constructor(app: App, plugin: SimpleCitations) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl).setName('Basic Settings').setHeading();

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
				const pathDiv = infoEl.createDiv({ cls: 'simple-citations-bib-path' });
				pathDiv.createSpan({ text: 'File path: ', cls: 'simple-citations-bib-path-label' });
				pathDiv.createSpan({ text: paths[idx] || '(empty path)' });
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
			.setName('Auto sync citations')
			.setDesc('When enabled, automatically adds and updates all literature notes when any bibliography file is updated.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSyncCitations)
				.onChange(async (value) => {
					this.plugin.settings.autoSyncCitations = value;
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
		new Setting(containerEl).setName('Additional Properties').setHeading();
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
			.setName('Include bibliography')
			.setDesc('When enabled, adds a "bibliography" property to each literature note as a list, indicating which bibliography file(s) the citation was found in (e.g. ["My Library"]). If the entry appears in multiple files, all sources are listed.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeBibliography)
				.onChange(async (value) => {
					this.plugin.settings.includeBibliography = value;
					await this.plugin.saveSettings();
				}));
const optionalFieldsSetting = new Setting(containerEl)
			.setName('Optional fields')
			.setDesc('Set optional fields from JSON. (Separate by line breaks, 1st level only)')
			.addTextArea(textArea => textArea
				.setPlaceholder('key\npdf')
				.setValue(this.plugin.settings.optionalFields)
				.onChange(async (value) => {
					this.plugin.settings.optionalFields = value;
					await this.plugin.saveSettings();
					if (this.mergeContainer) {
						this.renderMergeStrategies(this.mergeContainer);
					}
				}));
		optionalFieldsSetting.settingEl.addClass('simple-citations-mobile-wrap');
		new Setting(containerEl)
			.setName('Merge strategies')
			.setDesc('When the same citation key appears in multiple bibliography files, choose how each property is handled.')
			.setHeading();
		this.mergeContainer = containerEl.createDiv({ cls: 'simple-citations-merge-list' });
		this.renderMergeStrategies(this.mergeContainer);
		new Setting(containerEl).setName('Additional Content').setHeading();
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
		const pandocHeading = new Setting(containerEl).setName('Pandoc Settings').setHeading();
		if (Platform.isMobile) {
			const descEl = pandocHeading.descEl;
			descEl.createSpan({ text: 'Note: ', cls: 'simple-citations-note-label' });
			descEl.appendText('Pandoc is only available on desktop.');
		}
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
		const pandocArgsSetting = new Setting(containerEl)
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
		pandocArgsSetting.settingEl.addClass('simple-citations-mobile-wrap');

	}

	private showBaseProperties = false;

	private renderMergeStrategies(container: HTMLElement) {
		container.empty();

		const optionalFields = this.plugin.settings.optionalFields
			.split('\n')
			.map(f => f.trim())
			.filter(Boolean);
		const baseSet = new Set(BASE_PROPERTIES);

		// Deduplicate: optional fields that overlap with base are shown in base section
		const customProperties = optionalFields.filter(f => !baseSet.has(f));

		const renderProperty = (parent: HTMLElement, prop: string) => {
			const defaultStrat = getDefaultStrategy(prop);
			const current = getStrategy(this.plugin.settings.mergeStrategies, prop);
			const isCustom = this.plugin.settings.mergeStrategies[prop] !== undefined;

			new Setting(parent)
				.setName(prop)
				.setDesc(isCustom ? `Default: ${defaultStrat}` : '')
				.addDropdown(dropdown => dropdown
					.addOption('priority', 'Priority')
					.addOption('merge', 'Merge')
					.setValue(current)
					.onChange(async (value) => {
						if (value === defaultStrat) {
							delete this.plugin.settings.mergeStrategies[prop];
						} else {
							this.plugin.settings.mergeStrategies[prop] = value;
						}
						await this.plugin.saveSettings();
						this.renderMergeStrategies(container);
					}));
		};

		// Custom properties (always visible)
		for (const prop of customProperties) {
			renderProperty(container, prop);
		}

		// Base properties (collapsible, content inside the same setting block)
		const baseSetting = new Setting(container)
			.setName('Base properties')
			.setDesc('Built-in properties managed by the plugin. All default to Priority.')
			.addToggle(t => t
				.setValue(this.showBaseProperties)
				.onChange((value) => {
					this.showBaseProperties = value;
					this.renderMergeStrategies(container);
				}));
		baseSetting.settingEl.addClass('simple-citations-base-props-setting');

		if (this.showBaseProperties) {
			const baseList = baseSetting.settingEl.createDiv({ cls: 'simple-citations-base-props-list' });
			for (const prop of BASE_PROPERTIES) {
				renderProperty(baseList, prop);
			}
		}
	}
}
