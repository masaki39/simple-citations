import { App, Modal, Setting, Plugin } from 'obsidian';
import { AddCitations } from './addCitations';
import { UpdateCitations } from './updateCitations';

export class SyncCitations {
	private app: App;
	private addCitations: AddCitations;
	private updateCitations: UpdateCitations;

	constructor(
		app: App,
		addCitations: AddCitations,
		updateCitations: UpdateCitations
	) {
		this.app = app;
		this.addCitations = addCitations;
		this.updateCitations = updateCitations;
	}

	registerCommands(plugin: Plugin) {
		plugin.addCommand({
			id: 'sync-citations',
			name: 'Sync literature notes',
			callback: async () => {
				await this.addCitations.runAddCitations();
				await this.updateCitations.updateCitations();
			}
		});

		plugin.addCommand({
			id: 'full-sync-citations',
			name: 'Full sync literature notes (reset all properties)',
			callback: async () => {
				const modal = new Modal(this.app);
				modal.setTitle('Full sync literature notes');
				modal.contentEl.createEl('p', {
					text: 'This will clear ALL existing properties in each literature note and rebuild them entirely from the bibliography JSON and current settings. Any manually added properties will be lost.',
				});
				modal.contentEl.createEl('p', {
					text: 'This is useful when settings or bibliography structure have changed and you want a clean sync. Use normal "Sync literature notes" if you only want to add and update.',
					cls: 'mod-warning',
				});
				new Setting(modal.contentEl)
					.addButton(btn => btn
						.setButtonText('Cancel')
						.onClick(() => modal.close()))
					.addButton(btn => btn
						.setButtonText('Full sync')
						.setWarning()
						.onClick(async () => {
							modal.close();
							await this.addCitations.runAddCitations();
							await this.updateCitations.updateCitations(true);
						}));
				modal.open();
			}
		});
	}
}
