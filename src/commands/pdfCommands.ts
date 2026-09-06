import { App, Notice, Plugin, MarkdownView, Editor, Platform } from 'obsidian';
import { SimpleCitationsSettings } from '../settings/settings';
import { augmentedEnv } from '../utils/binaryPath';
import { requireNode } from '../utils/nodeModules';

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
			if (!settings.exportFolderPath) {
				new Notice('Export folder is not set.');
				return;
			}
			const pdfPaths = resolvePdfPaths(app, view);
			if (!pdfPaths) return;
			try {
				const fs = requireNode<typeof import('fs/promises')>('fs/promises');
				const path = requireNode<typeof import('path')>('path');
				for (const src of pdfPaths) {
					await fs.copyFile(src, path.join(settings.exportFolderPath, path.basename(src)));
				}
				new Notice('PDF export completed.');
			} catch (error) {
				new Notice('PDF export failed: ' + (error as Error).message);
			}
		}
	});

	plugin.addCommand({
		id: 'export-pdf-images',
		name: 'Export PDF images',
		editorCallback: async (_editor: Editor, view: MarkdownView) => {
			const settings = getSettings();
			if (!settings.exportFolderPath) {
				new Notice('Export folder is not set.');
				return;
			}
			const pdfPaths = resolvePdfPaths(app, view);
			if (!pdfPaths) return;
			const pdfimagesPath = settings.pdfimagesPath || 'pdfimages';
			try {
				const { spawn } = requireNode<typeof import('child_process')>('child_process');
				const path = requireNode<typeof import('path')>('path');
				for (let i = 0; i < pdfPaths.length; i++) {
					const prefix = path.join(settings.exportFolderPath, `pdf${i + 1}`);
					await new Promise<void>((resolve, reject) => {
						const proc = spawn(pdfimagesPath, ['-png', pdfPaths[i], prefix], { env: augmentedEnv() });
						proc.on('close', (code) => {
							if (code === 0) resolve();
							else reject(new Error(`pdfimages exited with code ${code}`));
						});
						proc.on('error', reject);
					});
				}
				new Notice('PDF image export completed.');
			} catch (error) {
				new Notice('PDF image export failed: ' + (error as Error).message);
			}
		}
	});
}
