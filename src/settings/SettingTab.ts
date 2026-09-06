import {
	App,
	Notice,
	Platform,
	PluginSettingTab,
	Setting,
	SettingDefinitionEmpty,
	SettingDefinitionItem,
	normalizePath,
} from "obsidian";
import SimpleCitations from "../main";
import {
	updateSettingJsonStatus,
	updateSettingFolderStatus,
	updateSettingTemplateStatus,
} from "../utils/fileStatus";
import { JsonFileSuggest, FolderSuggest } from "./FileSuggest";
import { getStrategy, getDefaultStrategy } from "../utils/mergeStrategies";
import { BASE_PROPERTIES } from "../utils/updateFrontMatter";
import { isBetterBibTeXFormat } from "../utils/loadBibliographyData";

export class SimpleCitationsSettingTab extends PluginSettingTab {
	plugin: SimpleCitations;
	private hasBbtFiles = false;
	private bbtSignature: string | null = null;

	constructor(app: App, plugin: SimpleCitations) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getControlValue(key: string): unknown {
		return (this.plugin.settings as unknown as Record<string, unknown>)[key];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		await this.plugin.saveSettings();
		// Toggling this shows/hides the base-property rows.
		if (key === "showBaseProperties") {
			this.update();
		}
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		// Refresh BetterBibTeX detection in the background; re-renders if it changes.
		void this.refreshBbtDetection();

		const settings = this.plugin.settings;
		const paths = settings.jsonPaths;
		const names = settings.jsonNames;

		const optionalFields = settings.optionalFields
			.split("\n")
			.map((f) => f.trim())
			.filter(Boolean);
		const baseSet = new Set<string>(BASE_PROPERTIES);
		const customMergeProperties = optionalFields.filter((f) => !baseSet.has(f));

		return [
			{
				type: "list",
				heading: "Bibliography files",
				emptyState:
					"No bibliography files added yet. Add a Better CSL JSON or BetterBibTeX JSON file exported from Zotero.",
				addItem: {
					name: "Add bibliography file",
					action: () => {
						paths.push("");
						names.push("");
						void this.plugin.saveSettings().then(() => this.update());
					},
				},
				onReorder: (oldIndex, newIndex) => {
					moveItem(paths, oldIndex, newIndex);
					moveItem(names, oldIndex, newIndex);
					void this.plugin.saveSettings().then(() => this.update());
				},
				onDelete: (index) => {
					paths.splice(index, 1);
					names.splice(index, 1);
					void this.plugin.saveSettings().then(() => this.update());
				},
				items: paths.map((_, index) => ({
					name: this.displayName(index) || "(unnamed)",
					desc:
						"Earlier entries have higher priority when the same citation key exists in multiple files.",
					render: (setting: Setting) => this.renderBibRow(setting, index),
				})),
			},
			{
				type: "group",
				heading: "General",
				items: [
					{
						name: "Literature note folder",
						desc: "Folder to save literature notes. Default: vault root.",
						render: (setting: Setting) => this.renderFolderPath(setting),
					},
					{
						name: "Auto add citations",
						desc: "When enabled, run add commands automatically when any bibliography file is updated.",
						control: { type: "toggle", key: "autoAddCitations" },
					},
					{
						name: "Auto sync citations",
						desc: "When enabled, automatically add and update all literature notes when any bibliography file is updated.",
						control: { type: "toggle", key: "autoSyncCitations" },
					},
					{
						name: "Auto update citations",
						desc: "When enabled, automatically update a literature note when it is opened.",
						control: { type: "toggle", key: "autoUpdateCitations" },
					},
				],
			},
			{
				type: "group",
				heading: "Additional properties",
				items: [
					{
						name: "Include author tag",
						desc: "When enabled, add a tag with the first author's name.",
						control: { type: "toggle", key: "includeAuthorTag" },
					},
					{
						name: "Include journal tag",
						desc: "When enabled, add a tag with the journal name.",
						control: { type: "toggle", key: "includeJournalTag" },
					},
					{
						name: "Include bibliography",
						desc: 'When enabled, add a "bibliography" property listing which bibliography file(s) the citation was found in (e.g. ["My Library"]).',
						control: { type: "toggle", key: "includeBibliography" },
					},
					{
						name: "Include PDF paths (BetterBibTeX JSON)",
						desc: 'Automatically add a "pdf" property with local PDF paths extracted from attachments.',
						visible: () => this.hasBbtFiles,
						control: { type: "toggle", key: "includeBbtPdf" },
					},
					{
						name: "Include collections (BetterBibTeX JSON)",
						desc: 'Automatically add a "collections" property with the Zotero collection names the item belongs to.',
						visible: () => this.hasBbtFiles,
						control: { type: "toggle", key: "includeBbtCollections" },
					},
					{
						name: "Optional fields",
						desc: "Extra fields to copy from the bibliography JSON. One per line, top level only.",
						render: (setting: Setting) => this.renderOptionalFields(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Merge strategies",
				cls: "simple-citations-merge-list",
				visible: () => this.plugin.settings.jsonPaths.filter((p) => p).length > 1,
				items: [
					{
						name: "Duplicate handling",
						desc: "When the same citation key appears in multiple bibliography files, choose how each property is combined.",
					} as SettingDefinitionEmpty,
					...customMergeProperties.map((prop) => ({
						name: prop,
						render: (setting: Setting) => this.renderMergeStrategy(setting, prop),
					})),
					{
						name: "Show base properties",
						desc: "Built-in properties managed by the plugin. Defaults: collections → Merge, others → Priority.",
						control: { type: "toggle", key: "showBaseProperties" },
					},
					...BASE_PROPERTIES.map((prop) => ({
						name: prop,
						visible: () => this.plugin.settings.showBaseProperties,
						render: (setting: Setting) => this.renderMergeStrategy(setting, prop),
					})),
				],
			},
			{
				type: "group",
				heading: "Additional content",
				items: [
					{
						name: "Include abstract",
						desc: "When enabled, add the abstract to the top of each literature note.",
						control: { type: "toggle", key: "includeAbstract" },
					},
					{
						name: "Template file",
						desc: "When set, add this template to the top of each literature note. Intended for dynamic templates such as Dataview.",
						render: (setting: Setting) => this.renderTemplatePath(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Pandoc",
				items: [
					{
						name: "Pandoc is only available on desktop.",
						visible: () => Platform.isMobile,
					} as SettingDefinitionEmpty,
					{
						name: "Pandoc path",
						desc: createFragment((f) => {
							f.createEl("a", { text: "Pandoc", href: "https://pandoc.org" });
							f.appendText(
								" must be installed. Mac/Linux: `which pandoc`, Windows: `where pandoc`."
							);
						}),
						control: { type: "text", key: "inputPandocPath", placeholder: "pandoc" },
					},
					{
						name: "Export folder",
						desc: "Absolute path to an export folder. Leave empty to export next to the source note.",
						control: {
							type: "text",
							key: "pandocOutputPath",
							placeholder: "Same as source note",
						},
					},
					{
						name: "Extra Pandoc arguments",
						desc: "Extra command line arguments for Pandoc. Absolute paths only. New lines are turned into spaces. Citeproc and bibliography are added automatically.",
						control: {
							type: "textarea",
							key: "pandocArgs",
							rows: 6,
							placeholder: "Example: -f markdown+hard_line_breaks",
						},
					},
				],
			},
			{
				type: "group",
				heading: "Poppler",
				items: [
					{
						name: "Poppler is only available on desktop.",
						visible: () => Platform.isMobile,
					} as SettingDefinitionEmpty,
					{
						name: "pdfimages path",
						desc: createFragment((f) => {
							f.createEl("a", {
								text: "Poppler",
								href: "https://poppler.freedesktop.org",
							});
							f.appendText(
								" must be installed. Mac/Linux: `which pdfimages`, Windows: `where pdfimages`."
							);
						}),
						control: { type: "text", key: "pdfimagesPath", placeholder: "pdfimages" },
					},
				],
			},
		];
	}

	private displayName(index: number): string {
		const path = this.plugin.settings.jsonPaths[index] ?? "";
		const defaultName = path.split("/").pop()?.replace(/\.json$/, "") || "";
		return this.plugin.settings.jsonNames[index]?.trim() || defaultName;
	}

	private renderBibRow(setting: Setting, index: number): void {
		const paths = this.plugin.settings.jsonPaths;
		const names = this.plugin.settings.jsonNames;

		setting.setName(this.displayName(index) || "(unnamed)");
		setting.setDesc(
			"Earlier entries have higher priority when the same citation key exists in multiple files."
		);
		const statusEl = createSpan();
		updateSettingJsonStatus(this.app, statusEl, paths[index] ?? "");
		setting.nameEl.prepend(statusEl);

		const defaultName = (paths[index] ?? "").split("/").pop()?.replace(/\.json$/, "") || "";

		setting.addText((text) =>
			text
				.setPlaceholder(
					defaultName ? `Display name (default: ${defaultName})` : "Display name"
				)
				.setValue(names[index] ?? "")
				.onChange(async (value) => {
					names[index] = value;
					await this.plugin.saveSettings();
				})
		);

		setting.addText((text) => {
			text
				.setPlaceholder("path/to/references.json")
				.setValue(paths[index] ?? "")
				.onChange(async (value) => {
					const duplicate = paths.some((p, i) => i !== index && p && p === value);
					if (duplicate) {
						new Notice("This bibliography file has already been added.");
						text.setValue(paths[index] ?? "");
						return;
					}
					paths[index] = value;
					await this.plugin.saveSettings();
					updateSettingJsonStatus(this.app, statusEl, value);
				});
			new JsonFileSuggest(this.app, text.inputEl, () =>
				paths.filter((_, i) => i !== index)
			);
		});
	}

	private renderFolderPath(setting: Setting): void {
		setting.setName("Literature note folder");
		setting.setDesc("Folder to save literature notes. Default: vault root.");
		setting.addText((text) => {
			const statusEl = createSpan();
			updateSettingFolderStatus(this.app, statusEl, this.plugin.settings.folderPath);
			setting.controlEl.insertBefore(statusEl, text.inputEl);
			new FolderSuggest(this.app, text.inputEl);
			text
				.setPlaceholder("Enter a folder path")
				.setValue(this.plugin.settings.folderPath)
				.onChange(async (value) => {
					this.plugin.settings.folderPath = value;
					await this.plugin.saveSettings();
					updateSettingFolderStatus(this.app, statusEl, value);
				});
		});
	}

	private renderTemplatePath(setting: Setting): void {
		setting.setName("Template file");
		setting.setDesc(
			"When set, add this template to the top of each literature note. Intended for dynamic templates such as Dataview."
		);
		setting.addText((text) => {
			const statusEl = createSpan();
			updateSettingTemplateStatus(this.app, statusEl, this.plugin.settings.templatePath);
			setting.controlEl.insertBefore(statusEl, text.inputEl);
			text
				.setPlaceholder("Enter a note path")
				.setValue(this.plugin.settings.templatePath)
				.onChange(async (value) => {
					this.plugin.settings.templatePath = value;
					await this.plugin.saveSettings();
					updateSettingTemplateStatus(this.app, statusEl, value);
				});
		});
	}

	private renderOptionalFields(setting: Setting): void {
		setting.setName("Optional fields");
		setting.setDesc(
			"Extra fields to copy from the bibliography JSON. One per line, top level only."
		);
		let lastValue = this.plugin.settings.optionalFields;
		setting.addTextArea((textArea) => {
			textArea
				.setPlaceholder("key\npdf")
				.setValue(this.plugin.settings.optionalFields)
				.onChange(async (value) => {
					this.plugin.settings.optionalFields = value;
					await this.plugin.saveSettings();
				});
			// Custom merge-strategy rows derive from this value. Rebuild them
			// when editing finishes rather than on every keystroke.
			textArea.inputEl.addEventListener("blur", () => {
				if (this.plugin.settings.optionalFields !== lastValue) {
					lastValue = this.plugin.settings.optionalFields;
					this.update();
				}
			});
		});
	}

	private renderMergeStrategy(setting: Setting, prop: string): void {
		const defaultStrategy = getDefaultStrategy(prop);
		const strategies = this.plugin.settings.mergeStrategies;
		setting.setName(prop);
		const describe = () =>
			setting.setDesc(strategies[prop] !== undefined ? `Default: ${defaultStrategy}` : "");
		describe();
		setting.addDropdown((dropdown) =>
			dropdown
				.addOption("priority", "Priority")
				.addOption("merge", "Merge")
				.setValue(getStrategy(strategies, prop))
				.onChange(async (value) => {
					if (value === defaultStrategy) {
						delete strategies[prop];
					} else {
						strategies[prop] = value;
					}
					await this.plugin.saveSettings();
					describe();
				})
		);
	}

	private async refreshBbtDetection(): Promise<void> {
		// Re-scan only when the resolved files or their contents changed, so
		// routine re-renders don't re-parse bibliography JSON needlessly.
		const signature = this.plugin.settings.jsonPaths
			.map((path) => {
				if (!path) return "";
				const file = this.app.vault.getFileByPath(normalizePath(path));
				return file ? `${file.path}@${file.stat.mtime}` : "missing";
			})
			.join(" ");
		if (signature === this.bbtSignature) return;
		this.bbtSignature = signature;

		const detected = await this.detectBbtFiles();
		if (detected !== this.hasBbtFiles) {
			this.hasBbtFiles = detected;
			this.update();
		}
	}

	private async detectBbtFiles(): Promise<boolean> {
		for (const path of this.plugin.settings.jsonPaths) {
			if (!path) continue;
			const file = this.app.vault.getFileByPath(normalizePath(path));
			if (!file) continue;
			try {
				const contents = await this.app.vault.cachedRead(file);
				const data = JSON.parse(contents);
				if (isBetterBibTeXFormat(data)) return true;
			} catch {
				/* ignore parse errors */
			}
		}
		return false;
	}
}

function moveItem<T>(arr: T[], from: number, to: number): void {
	if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
	const [item] = arr.splice(from, 1);
	arr.splice(to, 0, item);
}
