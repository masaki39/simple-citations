import { Notice, Plugin, TFile, normalizePath } from 'obsidian';
import { spawn } from 'child_process';
import { DEFAULT_SETTINGS, SimpleCitationsSettings } from './settings/settings';
import { SimpleCitationsSettingTab } from './settings/SettingTab';
import { autoAddCitations } from './commands/AutoAddCitations';
import { UpdateCitations } from './commands/updateCitations';
import { updateContent } from './utils/updateContent';
import { updateFrontMatter } from './utils/updateFrontMatter';
import { checkRequiredFiles } from './utils/checkRequiredFiles';
import { validateCitekey } from './utils/validateCitekey';

export default class SimpleCitations extends Plugin {
	settings: SimpleCitationsSettings;
	private updateCitations: UpdateCitations;
	
	async onload() {
		await this.loadSettings();

		// Initialize update citations class
		this.updateCitations = new UpdateCitations(
			this.app,
			this.settings
		);

		// Register update commands
		this.updateCitations.registerCommands(this);

		this.addCommand({
			id: 'add-citations',
			name: 'Add literature notes',
			callback: async () => {
				const startTime = performance.now(); // start time

				const { jsonFile, folder, templateFile } = checkRequiredFiles(this.app, this.settings);
				if (!jsonFile || !folder) return;
				
				// parse json Data and files
				const jsonContents = await this.app.vault.cachedRead(jsonFile);
				const jsonData = JSON.parse(jsonContents);
				const files = new Map(folder.children.map(file => [file.name, file])); // マップ化
				let templateContent = templateFile ? await this.app.vault.cachedRead(templateFile) : "";
				let fileCount: number = 0;
				
				let notice: Notice | null = null;
				let intervalId: NodeJS.Timeout | null = null;

				// check json file
				for (let i = 0; i < jsonData.length; i++) {
					const citekey = jsonData[i]?.['citation-key'];
					if (!validateCitekey(citekey)) continue; // `citation-key` がないデータはスキップ
					const targetFileName = "@" + citekey + ".md";
					const targetFile = files.get(targetFileName); // O(1) の高速検索

					// if nonexisting, create file
					if (!targetFile){
						const newFile = await this.app.vault.create(`${folder.path}/${targetFileName}`,"");
						await updateFrontMatter(this.app, this.settings, newFile, jsonData[i]);
						await updateContent(
							this.app,
							newFile,
							templateContent,
							this.settings.includeAbstract ? jsonData[i]['abstract'] : ""
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
				// stop timer
				if (intervalId) {
					clearInterval(intervalId);
				}
				if (notice) {
					const endTime = performance.now(); // end time
					const elapsedTime = ((endTime - startTime) / 1000).toFixed(1);
					notice.setMessage(`${fileCount} file(s) added.\nTime taken: ${elapsedTime} seconds`);
					// hide notice after 3 seconds
					setTimeout(() => {
						notice?.hide();
					}, 3000);
				}

				// update json updated time
				this.settings.jsonUpdatedTime = new Date(jsonFile.stat.mtime).getTime();
				this.saveSettings();
				console.log("Add literature notes completed.");
			}
		});

		this.addCommand({
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
				let newContent = await content.replace(/\[\[(.*?)\|.*?\]\]/g, "[[$1]]"); // fix aliases 
				newContent = newContent.replace(/\[\[@(.*?)\]\]/g, "[@$1]"); // convert to pandoc style
				newContent = newContent.replace(/\](\s*?)\[@/g, ";@"); // connect citations
				newContent = newContent.replace(/(\.)\s*?(\[@.*?\])/g, "$2$1 "); // insert before period

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
				const PandocArgs = [
					"--citeproc",
					"--bibliography",
					BasePath + "/" + normalizePath(this.settings.jsonPath),
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
			id: 'copy-missing-note-links',
			name: 'Copy missing note links not included in json file',
			callback: async () => {

				const { jsonFile, folder } = checkRequiredFiles(this.app, this.settings);
				if (!jsonFile || !folder) return;

				// parse json Data and file names
				const jsonContents = await this.app.vault.cachedRead(jsonFile);
				const jsonData = JSON.parse(jsonContents);
				const files = folder.children.filter(file => file instanceof TFile);
				const fileNames = files.map(file => file.name.replace(/\.md$/, ""));
				// get citation keys
				const citationKeys = new Set(jsonData.map((entry: { [x: string]: any; }) => entry["citation-key"]));
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
		
		// watch json file
		this.registerEvent(this.app.vault.on('modify', file => {
			autoAddCitations(this.app, this.settings, file as TFile);
		}));

		// auto update citations on file open
		this.registerEvent(this.app.workspace.on('file-open', file => {
			this.updateCitations.autoUpdateCitations(file);
		}));

		// auto execute add citations command at start
		this.app.workspace.onLayoutReady(() => {
			autoAddCitations(this.app, this.settings, this.app.vault.getFileByPath(normalizePath(this.settings.jsonPath)) as TFile);
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}