import { App, Notice, Plugin, MarkdownView, Editor, Platform } from 'obsidian';
import { SimpleCitationsSettings } from '../settings/settings';
import { spawn } from 'child_process';
import { copyFile } from 'fs/promises';
import { basename, join } from 'path';

function resolvePdfPaths(app: App, view: MarkdownView): string[] | null {
	const file = view.file;
	if (!file) return null;
	const pdf = app.metadataCache.getFileCache(file)?.frontmatter?.pdf;
	if (!pdf) {
		new Notice('No PDF path specified in frontmatter.');
		return null;
	}
	return Array.isArray(pdf) ? pdf : [pdf];
}

export function registerPdfCommands(
	plugin: Plugin,
	app: App,
	getSettings: () => SimpleCitationsSettings
) {
	if (!Platform.isDesktop) return;

	plugin.addCommand({
		id: 'export-pdf',
		name: 'Export PDF',
		editorCallback: async (_editor: Editor, view: MarkdownView) => {
			const settings = getSettings();
			if (!settings.pandocOutputPath) {
				new Notice('Export folder is not set.');
				return;
			}
			const pdfPaths = resolvePdfPaths(app, view);
			if (!pdfPaths) return;
			try {
				for (const src of pdfPaths) {
					await copyFile(src, join(settings.pandocOutputPath, basename(src)));
				}
				new Notice('PDF export completed.');
			} catch (error) {
				new Notice('PDF export failed: ' + error.message);
			}
		}
	});

	plugin.addCommand({
		id: 'export-pdf-images',
		name: 'Export PDF images',
		editorCallback: async (_editor: Editor, view: MarkdownView) => {
			const settings = getSettings();
			if (!settings.pandocOutputPath) {
				new Notice('Export folder is not set.');
				return;
			}
			const pdfPaths = resolvePdfPaths(app, view);
			if (!pdfPaths) return;
			const pdfimagesPath = settings.pdfimagesPath || 'pdfimages';
			try {
				for (let i = 0; i < pdfPaths.length; i++) {
					const prefix = join(settings.pandocOutputPath, `pdf${i + 1}`);
					await new Promise<void>((resolve, reject) => {
						const proc = spawn(pdfimagesPath, ['-png', pdfPaths[i], prefix], { env: process.env });
						proc.on('close', (code) => {
							if (code === 0) resolve();
							else reject(new Error(`pdfimages exited with code ${code}`));
						});
						proc.on('error', reject);
					});
				}
				new Notice('PDF image export completed.');
			} catch (error) {
				new Notice('PDF image export failed: ' + error.message);
			}
		}
	});
}
