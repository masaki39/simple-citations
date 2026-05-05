import { Notice, Plugin, TFile, normalizePath, Platform } from 'obsidian';
import { spawn } from 'child_process';
import { DEFAULT_SETTINGS, SimpleCitationsSettings } from './settings/settings';
import { SimpleCitationsSettingTab } from './settings/SettingTab';
import { autoAddCitations, autoSyncCitations } from './commands/autoCitations';
import { AddCitations } from './commands/addCitations';
import { UpdateCitations } from './commands/updateCitations';
import { SyncCitations } from './commands/syncCitations';
import { convertToPandocFormat } from './utils/convertToPandocFormat';
import { loadBibliographyData, isBetterBibTeXFormat } from './utils/loadBibliographyData';
import { checkRequiredFiles } from './utils/checkRequiredFiles';

export default class SimpleCitations extends Plugin {
	settings: SimpleCitationsSettings;
	private addCitations!: AddCitations;
	private updateCitations!: UpdateCitations;
	private syncCitations!: SyncCitations;

	async onload() {
		await this.loadSettings();

		this.addCitations = new AddCitations(this.app, this.settings, () => this.saveSettings());
		this.updateCitations = new UpdateCitations(this.app, this.settings);
		this.syncCitations = new SyncCitations(this.app, this.addCitations, this.updateCitations);

		this.addCitations.registerCommands(this);
		this.updateCitations.registerCommands(this);
		this.syncCitations.registerCommands(this);

		if (Platform.isDesktop) this.addCommand({
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
				const newContent = convertToPandocFormat(content);

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

				// build bibliography args — BBT JSON files are excluded (not supported by citeproc)
				const bibArgs: string[] = [];
				for (const path of this.settings.jsonPaths) {
					if (!path) continue;
					const normalizedPath = normalizePath(path);
					const bibFile = this.app.vault.getFileByPath(normalizedPath);
					if (!bibFile) continue;
					const bibContents = await this.app.vault.cachedRead(bibFile);
					let bibParsed: unknown;
					try { bibParsed = JSON.parse(bibContents); } catch { continue; }
					if (isBetterBibTeXFormat(bibParsed)) continue;
					bibArgs.push("--bibliography", BasePath + "/" + normalizedPath);
				}

				if (bibArgs.length === 0) {
					new Notice('Pandoc execution cancelled: no CSL JSON bibliography files found. BetterBibTeX JSON is not supported by citeproc.');
					await this.app.vault.modify(activeFile, content);
					return;
				}

				const PandocArgs = [
					"--citeproc",
					...bibArgs,
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
			id: 'convert-to-pandoc-format',
			name: 'Convert to Pandoc format',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice('No active file.');
					return;
				}
				const content = await this.app.vault.read(activeFile);
				const newContent = convertToPandocFormat(content);
				await this.app.vault.modify(activeFile, newContent);
				new Notice('Converted to Pandoc format.');
			}
		});

		this.addCommand({
			id: 'copy-missing-note-links',
			name: 'Copy missing note links not included in json file',
			callback: async () => {

				const { jsonFiles, folder } = checkRequiredFiles(this.app, this.settings);
				if (jsonFiles.length === 0 || !folder) return;

				// load and merge bibliography data
				const { mergedData } = await loadBibliographyData(this.app, this.settings.jsonPaths, this.settings.jsonNames);
				const files = folder.children.filter(file => file instanceof TFile);
				const fileNames = files.map(file => file.name.replace(/\.md$/, ""));
				// get citation keys
				const citationKeys = new Set(mergedData.map((entry: { [x: string]: any; }) => entry["citation-key"]));
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

		// watch json files for auto-add / auto-sync
		this.registerEvent(this.app.vault.on('modify', file => {
			autoAddCitations(this.app, this.settings, file as TFile);
			autoSyncCitations(this.app, this.settings, file as TFile);
		}));

		// auto update citations on file open
		this.registerEvent(this.app.workspace.on('file-open', file => {
			this.updateCitations.autoUpdateCitations(file);
		}));

		// auto execute add citations command at start
		this.app.workspace.onLayoutReady(() => {
			// trigger for first json file if it exists
			if (this.settings.jsonPaths.length > 0 && this.settings.jsonPaths[0]) {
				const firstFile = this.app.vault.getFileByPath(normalizePath(this.settings.jsonPaths[0]));
				if (firstFile) {
					autoAddCitations(this.app, this.settings, firstFile as TFile);
				}
			}
		});
	}

	onunload() {

	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

		let needsSave = false;

		// Migrate from old single jsonPath to jsonPaths array
		if (data && 'jsonPath' in data && typeof data.jsonPath === 'string' && data.jsonPath) {
			if (!this.settings.jsonPaths || this.settings.jsonPaths.length === 0) {
				this.settings.jsonPaths = [data.jsonPath];
			}
			delete (this.settings as any).jsonPath;
			needsSave = true;
		}

		// Migrate from old jsonUpdatedTime to jsonUpdatedTimes
		if (data && 'jsonUpdatedTime' in data && typeof data.jsonUpdatedTime === 'number') {
			if (!this.settings.jsonUpdatedTimes || Object.keys(this.settings.jsonUpdatedTimes).length === 0) {
				for (const path of this.settings.jsonPaths) {
					if (path) {
						this.settings.jsonUpdatedTimes[normalizePath(path)] = data.jsonUpdatedTime;
					}
				}
			}
			delete (this.settings as any).jsonUpdatedTime;
			needsSave = true;
		}

		// Ensure jsonPaths is always an array
		if (!Array.isArray(this.settings.jsonPaths)) {
			this.settings.jsonPaths = [];
		}

		// Ensure jsonNames is always an array matching jsonPaths length
		if (!Array.isArray(this.settings.jsonNames)) {
			this.settings.jsonNames = [];
		}
		while (this.settings.jsonNames.length < this.settings.jsonPaths.length) {
			this.settings.jsonNames.push('');
		}

		// Ensure jsonUpdatedTimes is always an object
		if (!this.settings.jsonUpdatedTimes || typeof this.settings.jsonUpdatedTimes !== 'object') {
			this.settings.jsonUpdatedTimes = {};
		}

		if (needsSave) {
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}
