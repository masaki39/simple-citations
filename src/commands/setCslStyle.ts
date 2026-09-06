import { App, FuzzySuggestModal, Notice, Plugin } from 'obsidian';
import { CslStyle, loadCslStyles } from '../utils/loadCslStyles';

class CslStyleSuggestModal extends FuzzySuggestModal<CslStyle> {
	private styles: CslStyle[];
	private onChoose: (style: CslStyle) => void;

	constructor(app: App, styles: CslStyle[], onChoose: (style: CslStyle) => void) {
		super(app);
		this.styles = styles;
		this.onChoose = onChoose;
		this.setPlaceholder('Search citation styles from the Zotero repository');
	}

	getItems(): CslStyle[] {
		return this.styles;
	}

	getItemText(style: CslStyle): string {
		return style.titleShort && style.titleShort !== style.title
			? `${style.title} (${style.titleShort})`
			: style.title;
	}

	onChooseItem(style: CslStyle): void {
		this.onChoose(style);
	}
}

export function registerSetCslStyleCommand(plugin: Plugin, app: App) {
	plugin.addCommand({
		id: 'set-csl-style',
		name: 'Set citation style (CSL property)',
		callback: async () => {
			const activeFile = app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice('No active file.');
				return;
			}

			let styles: CslStyle[];
			try {
				styles = await loadCslStyles();
			} catch (error) {
				new Notice(`Failed to load citation styles: ${(error as Error).message}`);
				return;
			}

			new CslStyleSuggestModal(app, styles, (style) => {
				void (async () => {
					try {
						await app.fileManager.processFrontMatter(activeFile, (fm) => {
							fm.csl = style.href;
						});
						new Notice(`Set csl: ${style.title}`);
					} catch (error) {
						new Notice(`Failed to update frontmatter: ${(error as Error).message}`);
					}
				})();
			}).open();
		},
	});
}
