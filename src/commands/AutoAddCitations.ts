import { App, TFile, normalizePath } from "obsidian";
import { SimpleCitationsSettings } from "../settings/settings";

export function autoAddCitations(app: App, settings: SimpleCitationsSettings, file: TFile) {
	if (settings.autoAddCitations) {
		const normalizedJsonPath = normalizePath(settings.jsonPath);
		if (file instanceof TFile && file.path === normalizedJsonPath) {
			if (settings.jsonUpdatedTime === new Date(file.stat.mtime).getTime()) {
				return;
			}
			(app as any).commands.executeCommandById('simple-citations:add-citations');
		}
	}
}