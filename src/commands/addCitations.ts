import { App, Notice, Plugin } from 'obsidian';
import { SimpleCitationsSettings } from '../settings/settings';
import { updateContent } from '../utils/updateContent';
import { updateFrontMatter } from '../utils/updateFrontMatter';
import { checkRequiredFiles } from '../utils/checkRequiredFiles';
import { validateCitekey } from '../utils/validateCitekey';
import { loadBibliographyData } from '../utils/loadBibliographyData';

export class AddCitations {
	private app: App;
	private settings: SimpleCitationsSettings;
	private saveSettings: () => Promise<void>;

	constructor(
		app: App,
		settings: SimpleCitationsSettings,
		saveSettings: () => Promise<void>
	) {
		this.app = app;
		this.settings = settings;
		this.saveSettings = saveSettings;
	}

	registerCommands(plugin: Plugin) {
		plugin.addCommand({
			id: 'add-citations',
			name: 'Add literature notes',
			callback: () => this.runAddCitations()
		});
	}

	async runAddCitations() {
		const startTime = performance.now();

		const { jsonFiles, folder, templateFile } = checkRequiredFiles(this.app, this.settings);
		if (jsonFiles.length === 0 || !folder) return;

		// load and merge bibliography data
		const { mergedData } = await loadBibliographyData(this.app, this.settings.jsonPaths, this.settings.jsonNames);
		const files = new Map(folder.children.map(file => [file.name, file]));
		let templateContent = templateFile ? await this.app.vault.cachedRead(templateFile) : "";
		let fileCount: number = 0;

		let notice: Notice | null = null;
		let intervalId: NodeJS.Timeout | null = null;

		// check json file
		for (let i = 0; i < mergedData.length; i++) {
			const citekey = mergedData[i]?.['citation-key'];
			if (!validateCitekey(citekey)) continue;
			const targetFileName = "@" + citekey + ".md";
			const targetFile = files.get(targetFileName);

			// if nonexisting, create file
			if (!targetFile){
				const newFile = await this.app.vault.create(`${folder.path}/${targetFileName}`,"");
				await updateFrontMatter(this.app, this.settings, newFile, mergedData[i]);
				await updateContent(
					this.app,
					newFile,
					templateContent,
					this.settings.includeAbstract ? mergedData[i]['abstract'] : ""
				);
				fileCount ++;
				if (fileCount === 1) {
					notice = new Notice(`${fileCount} file(s) added.`, 0);
					intervalId = setInterval(() => {
						notice?.setMessage(`${fileCount} file(s) added.`);
					}, 200);
				}
			}
		}
		if (intervalId) {
			clearInterval(intervalId);
		}
		if (notice) {
			const endTime = performance.now();
			const elapsedTime = ((endTime - startTime) / 1000).toFixed(1);
			notice.setMessage(`${fileCount} file(s) added.\nTime taken: ${elapsedTime} seconds`);
			setTimeout(() => {
				notice?.hide();
			}, 3000);
		}

		// update json updated times for all files
		for (const jsonFile of jsonFiles) {
			this.settings.jsonUpdatedTimes[jsonFile.path] = new Date(jsonFile.stat.mtime).getTime();
		}
		await this.saveSettings();
		console.log("Add literature notes completed.");
	}
}
