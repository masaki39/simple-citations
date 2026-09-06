import {
	App,
	Notice,
	Platform,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
	normalizePath,
} from "obsidian";
import SimpleCitations from "../main";
import {
	updateSettingJsonStatus,
	updateSettingFolderStatus,
	updateSettingTemplateStatus,
	setStatusIcon,
} from "../utils/fileStatus";
import {
	BinarySpec,
	detectBinary,
	fileExists,
	isAbsolutePath,
	probeBinary,
	PANDOC_SPEC,
	PDFIMAGES_SPEC,
} from "../utils/binaryPath";
import { detectDownloadsDir, directoryExists } from "../utils/downloadsDir";
import { JsonFileSuggest, FolderSuggest, BibFieldSuggest } from "./FileSuggest";
import { getStrategy, getDefaultStrategy } from "../utils/mergeStrategies";
import { BASE_PROPERTIES } from "../utils/updateFrontMatter";
import { isBetterBibTeXFormat, loadBibliographyData } from "../utils/loadBibliographyData";
import { templateSampleOptions } from "../utils/templateSamples";

const OPTIONAL_FIELDS_HELP_URL =
	"https://github.com/masaki39/simple-citations#-optional-fields";

export class SimpleCitationsSettingTab extends PluginSettingTab {
	plugin: SimpleCitations;
	private hasBbtFiles = false;
	private bbtSignature: string | null = null;
	private bibFieldNames: string[] = [];
	private bibFieldSignature: string | null = null;

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
		// Toggling this only flips the `visible` predicate on the base-property
		// rows, which already exist in the definitions. Re-evaluate predicates in
		// place rather than calling update(), which would re-render from the tab
		// root and drop the user out of this sub-page.
		if (key === "showBaseProperties") {
			this.refreshDomState();
		}
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		// Refresh BetterBibTeX detection in the background; re-renders if it changes.
		void this.refreshBbtDetection();
		// Refresh the optional-field candidate list in the background. The
		// suggestion popover reads it lazily, so no re-render is needed.
		void this.refreshBibFieldNames();

		const settings = this.plugin.settings;
		const paths = settings.jsonPaths;
		const names = settings.jsonNames;

		// Guard against pre-migration data (a newline-separated string) so the
		// whole tab still renders if getSettingDefinitions() runs first.
		if (!Array.isArray(settings.optionalFields)) {
			settings.optionalFields =
				typeof settings.optionalFields === "string"
					? (settings.optionalFields as string)
							.split("\n")
							.map((f) => f.trim())
							.filter(Boolean)
					: [];
		}

		const optionalFields = settings.optionalFields
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
				type: "page",
				name: "Note content",
				desc: "Extra properties and content added to each literature note.",
				items: [
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
						],
					},
					{
						type: "list",
						heading: "Optional fields",
						extraButtons: [
							(button) =>
								button
									.setIcon("help")
									.setTooltip("How to add fields in Zotero")
									.onClick(() =>
										window.open(OPTIONAL_FIELDS_HELP_URL, "_blank")
									),
						],
						emptyState: this.optionalFieldsDesc(
							"No optional fields yet. Add a top-level field from the bibliography JSON " +
								"(e.g. one added via a BetterBibTeX postscript) to copy it into each note. " +
								"Only text, number, and list values are copied. "
						),
						addItem: {
							name: "Add optional field",
							action: () => {
								settings.optionalFields.push("");
								void this.plugin.saveSettings().then(() => this.update());
							},
						},
						onDelete: (index) => {
							settings.optionalFields.splice(index, 1);
							void this.plugin.saveSettings().then(() => this.update());
						},
						items: settings.optionalFields.map((_, index) => ({
							name: "",
							render: (setting: Setting) =>
								this.renderOptionalFieldRow(setting, index),
						})),
					},
					{
						type: "group",
						heading: "Merge strategies",
						cls: "simple-citations-merge-list",
						visible: () =>
							this.plugin.settings.jsonPaths.filter((p) => p).length > 1,
						items: [
							{
								name: "Duplicate handling",
								desc: "When the same citation key appears in multiple bibliography files, choose how each property is combined.",
							},
							...customMergeProperties.map((prop) => ({
								name: prop,
								render: (setting: Setting) =>
									this.renderMergeStrategy(setting, prop),
							})),
							{
								name: "Show base properties",
								desc: "Built-in properties managed by the plugin. Defaults: collections → Merge, others → Priority.",
								control: { type: "toggle", key: "showBaseProperties" },
							},
							...BASE_PROPERTIES.map((prop) => ({
								name: prop,
								visible: () => this.plugin.settings.showBaseProperties,
								render: (setting: Setting) =>
									this.renderMergeStrategy(setting, prop),
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
								name: "Sample template",
								desc: "Insert a ready-made Bases view of related literature notes at the top of each note. Requires Bases (Obsidian 1.9+). Ignored when a template file is set below.",
								control: {
									type: "dropdown",
									key: "templateSample",
									options: templateSampleOptions(),
								},
							},
							{
								name: "Template file",
								desc: "When set, add this template to the top of each literature note. Takes precedence over the sample template. Intended for dynamic templates such as Dataview.",
								render: (setting: Setting) => this.renderTemplatePath(setting),
							},
						],
					},
				],
			},
			{
				type: "page",
				name: "Export",
				desc: "Export literature notes and PDFs with external tools. Desktop only.",
				items: [
					{
						name: "Export folder",
						render: (setting: Setting) => this.renderExportFolder(setting),
					},
					{
						type: "group",
						heading: "Pandoc",
						items: [
							{
								name: "Pandoc is only available on desktop.",
								visible: () => Platform.isMobile,
							},
							{
								name: "Pandoc path",
								visible: () => Platform.isDesktop,
								render: (setting: Setting) =>
									this.renderBinaryPath(setting, "inputPandocPath", PANDOC_SPEC, {
										toolName: "Pandoc",
										toolUrl: "https://pandoc.org",
										usedBy: "Pandoc citeproc execution (docx)",
									}),
							},
							{
								name: "Hard line breaks",
								desc: 'Add "-f markdown+hard_line_breaks" so single newlines in the note become line breaks in the exported docx.',
								visible: () => Platform.isDesktop,
								control: { type: "toggle", key: "pandocHardLineBreaks" },
							},
							{
								name: "Link citations",
								desc: 'Add "--metadata link-citations=true" so in-text citations link to the reference list in the exported docx.',
								visible: () => Platform.isDesktop,
								control: { type: "toggle", key: "pandocLinkCitations" },
							},
							{
								name: "Number sections",
								desc: 'Add "--number-sections" so headings are numbered in the exported docx.',
								visible: () => Platform.isDesktop,
								control: { type: "toggle", key: "pandocNumberSections" },
							},
							{
								name: "Reference document",
								visible: () => Platform.isDesktop,
								render: (setting: Setting) => this.renderReferenceDoc(setting),
							},
							{
								name: "Extra Pandoc arguments",
								desc: "Extra command line arguments for Pandoc. Absolute paths only. New lines are turned into spaces. Citeproc and bibliography are added automatically.",
								control: {
									type: "textarea",
									key: "pandocArgs",
									rows: 6,
									placeholder: "Example: --top-level-division=chapter",
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
							},
							{
								name: "pdfimages path",
								visible: () => Platform.isDesktop,
								render: (setting: Setting) =>
									this.renderBinaryPath(setting, "pdfimagesPath", PDFIMAGES_SPEC, {
										toolName: "Poppler",
										toolUrl: "https://poppler.freedesktop.org",
										usedBy: "Export PDF images",
									}),
							},
						],
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

		setting.setDesc(
			"Earlier entries have higher priority when the same citation key exists in multiple files."
		);

		const refreshName = () => {
			setting.nameEl.empty();
			const statusEl = setting.nameEl.createSpan();
			updateSettingJsonStatus(this.app, statusEl, paths[index] ?? "");
			setting.nameEl.createSpan({ text: this.displayName(index) || "(unnamed)" });
		};
		refreshName();

		// A full re-render corrects the row name, the merge-strategies group's
		// visibility, and BetterBibTeX detection — but would steal focus while
		// typing, so it only runs once the field is left with a changed value.
		let committedPath = paths[index] ?? "";
		const commitIfChanged = () => {
			if ((paths[index] ?? "") !== committedPath) {
				committedPath = paths[index] ?? "";
				this.update();
			}
		};

		setting.addText((text) => {
			text
				.setPlaceholder("Display name (defaults to the file name)")
				.setValue(names[index] ?? "")
				.onChange(async (value) => {
					names[index] = value;
					await this.plugin.saveSettings();
					refreshName();
				});
		});

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
					refreshName();
				});
			text.inputEl.addEventListener("blur", () => commitIfChanged());
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

	private renderExportFolder(setting: Setting): void {
		setting.setName("Export folder");
		setting.descEl.empty();
		setting.descEl.appendText(
			"Absolute path to an export folder, shared by the Pandoc and Poppler export commands. " +
				"Leave empty to export next to the source note. Select "
		);
		setting.descEl.createEl("strong", { text: "Detect" });
		setting.descEl.appendText(" to use your Downloads folder.");

		const statusEl = createSpan();
		const refreshStatus = () => {
			try {
				const value = this.plugin.settings.exportFolderPath;
				if (!value) {
					statusEl.empty();
					return;
				}
				setStatusIcon(statusEl, isAbsolutePath(value) && directoryExists(value));
			} catch {
				/* status is cosmetic */
			}
		};

		setting.addText((text) => {
			setting.controlEl.insertBefore(statusEl, text.inputEl);
			text
				.setPlaceholder("Same as source note")
				.setValue(this.plugin.settings.exportFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.exportFolderPath = value.trim();
					await this.plugin.saveSettings();
					refreshStatus();
				});

			if (Platform.isDesktop) {
				setting.addButton((button) => {
					button
						.setButtonText("Detect")
						.setTooltip("Find your Downloads folder")
						.onClick(async () => {
							button.setDisabled(true);
							try {
								const result = detectDownloadsDir();
								console.warn(
									"[simple-citations] detect Downloads folder:\n" +
										result.diagnostics.join("\n")
								);
								if (result.path) {
									this.plugin.settings.exportFolderPath = result.path;
									await this.plugin.saveSettings();
									text.setValue(result.path);
									refreshStatus();
									new Notice(`Export folder set to ${result.path}`);
								} else {
									new Notice(
										"Could not find your Downloads folder. Enter an absolute path, " +
											"or open the developer console (Ctrl/Cmd+Shift+I) for details."
									);
								}
							} finally {
								button.setDisabled(false);
							}
						});
				});
			}
		});

		refreshStatus();
	}

	private renderReferenceDoc(setting: Setting): void {
		setting.setName("Reference document");
		setting.descEl.empty();
		setting.descEl.appendText(
			"Absolute path to a Word document (.docx) whose styles Pandoc uses as the template. Leave empty for Pandoc's default. Adds "
		);
		setting.descEl.createEl("code", { text: "--reference-doc" });
		setting.descEl.appendText(".");

		const statusEl = createSpan();
		const refreshStatus = () => {
			try {
				const value = this.plugin.settings.pandocReferenceDoc;
				if (!value) {
					statusEl.empty();
					return;
				}
				setStatusIcon(statusEl, isAbsolutePath(value) && fileExists(value));
			} catch {
				/* status is cosmetic */
			}
		};

		setting.addText((text) => {
			setting.controlEl.insertBefore(statusEl, text.inputEl);
			text
				.setPlaceholder("Pandoc default")
				.setValue(this.plugin.settings.pandocReferenceDoc)
				.onChange(async (value) => {
					this.plugin.settings.pandocReferenceDoc = value.trim();
					await this.plugin.saveSettings();
					refreshStatus();
				});
		});

		refreshStatus();
	}

	private renderTemplatePath(setting: Setting): void {
		setting.setName("Template file");
		setting.setDesc(
			"When set, add this template to the top of each literature note. Takes precedence over the sample template. Intended for dynamic templates such as Dataview."
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

	private renderBinaryPath(
		setting: Setting,
		key: "inputPandocPath" | "pdfimagesPath",
		spec: BinarySpec,
		docs: { toolName: string; toolUrl: string; usedBy: string }
	): void {
		setting.setName(`${spec.name} path`);
		setting.descEl.empty();
		setting.descEl.appendText("Used by ");
		setting.descEl.createEl("strong", { text: docs.usedBy });
		setting.descEl.appendText(". Leave empty if the status is a green check; otherwise select ");
		setting.descEl.createEl("strong", { text: "Detect" });
		setting.descEl.appendText(" or enter an absolute path. Requires ");
		setting.descEl.createEl("a", { text: docs.toolName, href: docs.toolUrl });
		setting.descEl.appendText(".");

		const hintEl = setting.descEl.createDiv({ cls: "simple-citations-binary-hint" });
		const statusEl = createSpan();

		const showStatus = (
			state: "unknown" | "checking" | "auto" | "ok" | "missing"
		) => {
			try {
				statusEl.empty();
				hintEl.setText("");
				hintEl.removeClass("is-invalid");
				if (state === "checking") {
					statusEl.setText("…");
				} else if (state === "auto") {
					setStatusIcon(statusEl, true);
					hintEl.setText("Found automatically — no path needed.");
				} else if (state === "ok") {
					setStatusIcon(statusEl, true);
				} else if (state === "missing") {
					setStatusIcon(statusEl, false);
					hintEl.setText(`\`${spec.name}\` was not found. Select Detect, or enter an absolute path.`);
					hintEl.addClass("is-invalid");
				}
			} catch {
				/* status is cosmetic */
			}
		};

		const validate = async () => {
			const value = this.plugin.settings[key];
			try {
				showStatus("checking");
				const ok = await probeBinary(value, spec);
				showStatus(ok ? (value ? "ok" : "auto") : "missing");
			} catch {
				showStatus("missing");
			}
		};

		setting.addText((text) => {
			setting.controlEl.insertBefore(statusEl, text.inputEl);
			text
				.setPlaceholder(spec.name)
				.setValue(this.plugin.settings[key])
				.onChange(async (value) => {
					this.plugin.settings[key] = value.trim();
					await this.plugin.saveSettings();
					showStatus("unknown");
				});
			text.inputEl.addEventListener("blur", () => void validate());

			setting.addButton((button) => {
				button
					.setButtonText("Detect")
					.setTooltip(`Search common locations for ${spec.name}`)
					.onClick(async () => {
						button.setDisabled(true);
						try {
							showStatus("checking");
							const result = await detectBinary(spec, this.plugin.settings[key]);
							console.warn(
								`[simple-citations] detect ${spec.name}:\n` +
									result.diagnostics.join("\n")
							);
							if (result.path) {
								this.plugin.settings[key] = result.path;
								await this.plugin.saveSettings();
								text.setValue(result.path);
								showStatus("ok");
								new Notice(
									result.version
										? `Found ${spec.name}: ${result.version}`
										: `Found ${spec.name} at ${result.path}`
								);
							} else {
								showStatus("missing");
								new Notice(
									`Could not find ${spec.name}. Enter its absolute path, ` +
										`or open the developer console (Ctrl/Cmd+Shift+I) for details.`
								);
							}
						} catch (error) {
							showStatus("missing");
							new Notice(`Detection failed: ${(error as Error).message}`);
						} finally {
							button.setDisabled(false);
						}
					});
			});
		});

		void validate();
	}

	private optionalFieldsDesc(lead: string): DocumentFragment {
		return createFragment((frag) => {
			frag.appendText(lead);
			const link = frag.createEl("a", {
				text: "How to add fields in Zotero",
				href: OPTIONAL_FIELDS_HELP_URL,
			});
			link.setAttr("target", "_blank");
			link.setAttr("rel", "noopener");
		});
	}

	private renderOptionalFieldRow(setting: Setting, index: number): void {
		const fields = this.plugin.settings.optionalFields;
		setting.settingEl.addClass("simple-citations-optional-field");

		// The list owns the delete button; this row is only the field-name
		// input. The merge-strategy rows derive from these names, so a change
		// needs a full re-render — but that steals focus while typing, so it
		// only runs once the input is left with a changed value.
		let committed = fields[index] ?? "";
		const commitIfChanged = () => {
			if ((fields[index] ?? "") !== committed) {
				committed = fields[index] ?? "";
				this.update();
			}
		};

		setting.addText((text) => {
			text
				.setPlaceholder("Field name")
				.setValue(fields[index] ?? "")
				.onChange(async (value) => {
					fields[index] = value.trim();
					await this.plugin.saveSettings();
				});
			text.inputEl.addEventListener("blur", () => commitIfChanged());
			new BibFieldSuggest(this.app, text.inputEl, () =>
				this.optionalFieldCandidates(index)
			);
		});
	}

	/**
	 * Top-level field names found in the configured bibliography files, minus
	 * internal bookkeeping keys and fields already chosen in another row.
	 */
	private optionalFieldCandidates(currentIndex: number): string[] {
		const chosen = new Set(
			this.plugin.settings.optionalFields.filter((_, i) => i !== currentIndex)
		);
		return this.bibFieldNames.filter((name) => !chosen.has(name));
	}

	private async refreshBibFieldNames(): Promise<void> {
		const signature = this.plugin.settings.jsonPaths
			.map((path) => {
				if (!path) return "";
				const file = this.app.vault.getFileByPath(normalizePath(path));
				return file ? `${file.path}@${file.stat.mtime}` : "missing";
			})
			.join(" ");
		if (signature === this.bibFieldSignature) return;
		this.bibFieldSignature = signature;

		try {
			const { mergedData } = await loadBibliographyData(
				this.app,
				this.plugin.settings.jsonPaths,
				this.plugin.settings.jsonNames
			);
			const names = new Set<string>();
			for (const entry of mergedData) {
				for (const key of Object.keys(entry)) {
					// Skip the plugin's internal bookkeeping keys (_bbt,
					// _source_files, _duplicates, …).
					if (!key.startsWith("_")) names.add(key);
				}
			}
			this.bibFieldNames = [...names].sort((a, b) => a.localeCompare(b));
		} catch {
			// Leave the previous list in place and retry on the next render.
			this.bibFieldSignature = null;
		}
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

		const detected = await this.detectBbtFiles();
		// Inconclusive scan (a file could not be resolved, read, or parsed —
		// e.g. an early scan before the vault is ready, or a bibliography file
		// mid-rewrite by Zotero): keep the current flag and leave the cache
		// key unset so the next render retries instead of caching a false
		// negative that hides the BetterBibTeX toggles until the next mtime
		// change.
		if (detected === null) return;

		this.bbtSignature = signature;
		if (detected !== this.hasBbtFiles) {
			this.hasBbtFiles = detected;
			// The BetterBibTeX rows are always in the definitions; only their
			// `visible` predicate depends on this flag. Re-evaluate predicates in
			// place rather than calling update(), which would re-render from the
			// tab root and drop the user out of an open sub-page.
			this.refreshDomState();
		}
	}

	/**
	 * Returns true when any configured bibliography file is BetterBibTeX JSON,
	 * false when every file was read and none are, and null when at least one
	 * file could not be resolved, read, or parsed (so the answer is unknown).
	 */
	private async detectBbtFiles(): Promise<boolean | null> {
		let inconclusive = false;
		for (const path of this.plugin.settings.jsonPaths) {
			if (!path) continue;
			const file = this.app.vault.getFileByPath(normalizePath(path));
			if (!file) {
				inconclusive = true;
				continue;
			}
			try {
				const contents = await this.app.vault.cachedRead(file);
				const data = JSON.parse(contents);
				if (isBetterBibTeXFormat(data)) return true;
			} catch {
				inconclusive = true;
			}
		}
		return inconclusive ? null : false;
	}
}

function moveItem<T>(arr: T[], from: number, to: number): void {
	if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
	const [item] = arr.splice(from, 1);
	arr.splice(to, 0, item);
}
