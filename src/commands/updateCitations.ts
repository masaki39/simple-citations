import { App, Notice, TFile, Plugin } from 'obsidian';
import { SimpleCitationsSettings } from '../settings/settings';
import { updateContent } from '../utils/updateContent';
import { updateFrontMatter } from '../utils/updateFrontMatter';
import { checkRequiredFiles } from '../utils/checkRequiredFiles';
import { validateCitekey } from '../utils/validateCitekey';

export class UpdateCitations {
	private app: App;
	private settings: SimpleCitationsSettings;

	constructor(
		app: App,
		settings: SimpleCitationsSettings
	) {
		this.app = app;
		this.settings = settings;
	}

	registerCommands(plugin: Plugin) {
		plugin.addCommand({
			id: 'update-citations',
			name: 'Update literature notes',
			callback: async () => {
				await this.updateCitations();
			}
		});

		plugin.addCommand({
			id: 'update-citations-active',
			name: 'Update literature note (active file)',
			callback: async () => {
				await this.updateCitationsActive();
			}
		});
	}

	private async updateCitations() {
		const startTime = performance.now();

		const { jsonFile, folder, templateFile } = checkRequiredFiles(this.app, this.settings);
		if (!jsonFile || !folder) return;

		// parse json Data and files
		const jsonContents = await this.app.vault.cachedRead(jsonFile);
		const jsonData = JSON.parse(jsonContents);
		const files = new Map(folder.children.map(file => [file.name, file]));
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
			if (!validateCitekey(citekey)) continue;
			const targetFileName = "@" + citekey + ".md";
			const targetFile = files.get(targetFileName);

			// update frontmatter
			if (targetFile && targetFile instanceof TFile) {
				await updateFrontMatter(this.app, this.settings, targetFile, jsonData[i]);
				await updateContent(
					this.app,
					targetFile,
					templateContent,
					this.settings.includeAbstract ? jsonData[i]['abstract'] : ""
				);
				fileCount++;
			}
		}
		// stop timer
		clearInterval(intervalId);
		const endTime = performance.now();
		const elapsedTime = ((endTime - startTime) / 1000).toFixed(1);
		notice.setMessage(`${fileCount} file(s) updated.\nTime taken: ${elapsedTime} seconds`);
		// hide notice after 3 seconds
		setTimeout(() => {
			notice.hide();
		}, 3000);
	}

	private async updateCitationsActive() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file.');
			return;
		}

		// Check if the active file is a citation note
		if (!activeFile.name.startsWith('@') || !activeFile.name.endsWith('.md')) {
			new Notice('Active file is not a citation note.');
			return;
		}

		const { jsonFile, folder, templateFile } = checkRequiredFiles(this.app, this.settings);
		if (!jsonFile || !folder) return;

		// Check if the file is in the configured folder
		if (activeFile.parent !== folder) {
			new Notice('Active file is not in the configured literature notes folder.');
			return;
		}

		// Extract citation key from filename
		const citekey = activeFile.name.slice(1, -3);

		// Parse JSON data
		const jsonContents = await this.app.vault.cachedRead(jsonFile);
		const jsonData = JSON.parse(jsonContents);
		let templateContent = templateFile ? await this.app.vault.cachedRead(templateFile) : "";

		// Find the matching entry in JSON data
		const matchingEntry = jsonData.find((item: any) => item?.['citation-key'] === citekey);
		
		if (!matchingEntry) {
			new Notice(`No citation data found for "${citekey}" in JSON file.`);
			return;
		}

		if (!validateCitekey(matchingEntry['citation-key'])) {
			new Notice(`Invalid citation key: "${matchingEntry['citation-key']}"`);
			return;
		}

		// Update the active file
		await updateFrontMatter(this.app, this.settings, activeFile, matchingEntry);
		await updateContent(
			this.app,
			activeFile,
			templateContent,
			this.settings.includeAbstract ? matchingEntry['abstract'] : ""
		);

		new Notice('Active file updated.');
	}

	async autoUpdateCitations(file: TFile | null) {
		if (!file) return;

		// Check if auto update is enabled
		if (!this.settings.autoUpdateCitations) return;

		// Check if the file is a citation note
		if (!file.name.startsWith('@') || !file.name.endsWith('.md')) {
			return;
		}

		const { jsonFile, folder, templateFile } = checkRequiredFiles(this.app, this.settings);
		if (!jsonFile || !folder) return;

		// Check if the file is in the configured folder
		if (file.parent !== folder) {
			return;
		}

		// Extract citation key from filename
		const citekey = file.name.slice(1, -3);

		// Parse JSON data
		const jsonContents = await this.app.vault.cachedRead(jsonFile);
		const jsonData = JSON.parse(jsonContents);
		let templateContent = templateFile ? await this.app.vault.cachedRead(templateFile) : "";

		// Find the matching entry in JSON data
		const matchingEntry = jsonData.find((item: any) => item?.['citation-key'] === citekey);
		
		if (!matchingEntry) {
			return;
		}

		if (!validateCitekey(matchingEntry['citation-key'])) {
			return;
		}

		// Update the file silently
		await updateFrontMatter(this.app, this.settings, file, matchingEntry);
		await updateContent(
			this.app,
			file,
			templateContent,
			this.settings.includeAbstract ? matchingEntry['abstract'] : ""
		);

		console.log(`Auto update citations completed for: ${file.name}`);
	}
}