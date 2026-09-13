import { App, ButtonComponent, Modal, Notice, Plugin, Setting, TFile, TFolder } from 'obsidian';
import { SimpleCitationsSettings } from '../settings/settings';
import { checkRequiredFiles } from '../utils/checkRequiredFiles';
import { PROTECTED_PROPERTIES, parseFieldNames, splitProtectedFields, countFieldMatches } from '../utils/removeFields';

export class RemoveFields {
	private app: App;
	private settings: SimpleCitationsSettings;

	constructor(app: App, settings: SimpleCitationsSettings) {
		this.app = app;
		this.settings = settings;
	}

	registerCommands(plugin: Plugin) {
		plugin.addCommand({
			id: 'remove-properties-from-notes',
			name: 'Remove properties from literature notes',
			callback: () => this.openModal()
		});
	}

	private getCitationFiles(folder: TFolder): TFile[] {
		return folder.children.filter((file): file is TFile =>
			file instanceof TFile && file.name.startsWith('@') && file.name.endsWith('.md')
		);
	}

	private openModal() {
		const { folder } = checkRequiredFiles(this.app, this.settings);
		if (!folder) return;
		const files = this.getCitationFiles(folder);

		const modal = new Modal(this.app);
		modal.setTitle('Remove properties from literature notes');
		modal.contentEl.createEl('p', {
			text: 'Enter one or more property names (comma-separated) to delete from every literature note in the configured folder. Use this after renaming or removing an optional field so the old property does not linger.',
		});
		modal.contentEl.createEl('p', {
			text: `Properties managed by the plugin cannot be removed here: ${PROTECTED_PROPERTIES.join(', ')}.`,
			cls: 'setting-item-description',
		});

		const previewEl = modal.contentEl.createEl('p', { cls: 'setting-item-description' });
		let removable: string[] = [];
		let confirmBtn: ButtonComponent;

		const updatePreview = (fields: string[]) => {
			const split = splitProtectedFields(fields);
			removable = split.removable;

			if (removable.length === 0) {
				previewEl.setText(split.protectedFields.length > 0
					? `These properties are managed by the plugin and cannot be removed here: ${split.protectedFields.join(', ')}.`
					: '');
				confirmBtn.setDisabled(true);
				return;
			}

			const frontmatters = files.map(f => this.app.metadataCache.getFileCache(f)?.frontmatter);
			const counts = countFieldMatches(frontmatters, removable);
			const parts = removable.map(f => {
				const n = counts.get(f) ?? 0;
				return `${f} (${n} note${n === 1 ? '' : 's'})`;
			});
			let text = `Will remove: ${parts.join(', ')}.`;
			if (split.protectedFields.length > 0) {
				text += ` Ignoring managed propert${split.protectedFields.length > 1 ? 'ies' : 'y'}: ${split.protectedFields.join(', ')}.`;
			}
			previewEl.setText(text);
			confirmBtn.setDisabled(false);
		};

		new Setting(modal.contentEl)
			.setName('Property names')
			.addText(text => {
				text.setPlaceholder('Field name(s), comma-separated');
				text.onChange(value => updatePreview(parseFieldNames(value)));
			});

		new Setting(modal.contentEl)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => modal.close()))
			.addButton(btn => {
				confirmBtn = btn;
				btn.setButtonText('Remove')
					.setDestructive()
					.setCta()
					.setDisabled(true)
					.onClick(async () => {
						if (removable.length === 0) return;
						modal.close();
						await this.removeFields(files, removable);
					});
			});

		modal.open();
	}

	private async removeFields(files: TFile[], fields: string[]) {
		let fileCount = 0;
		for (const file of files) {
			const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!fm || !fields.some(f => Object.prototype.hasOwnProperty.call(fm, f))) continue;

			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				for (const field of fields) {
					delete frontmatter[field];
				}
			});
			fileCount++;
		}
		new Notice(`Removed properties from ${fileCount} file(s).`);
	}
}
