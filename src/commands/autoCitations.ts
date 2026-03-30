// ファイルが設定されたjsonファイルと同じ場合、add-citationsコマンドを実行する
// その時に、jsonファイルの更新時間が変更されているかどうかを確認する

import { App, TFile, normalizePath } from "obsidian";
import { SimpleCitationsSettings } from "../settings/settings";

/**
 * Check if the modified file is a configured bibliography JSON file
 * and its modification time has changed.
 */
function isBibliographyUpdated(settings: SimpleCitationsSettings, file: TFile): boolean {
	if (!(file instanceof TFile)) return false;
	for (const path of settings.jsonPaths) {
		if (!path) continue;
		if (file.path === normalizePath(path)) {
			const lastKnownTime = settings.jsonUpdatedTimes[file.path] ?? 0;
			return lastKnownTime !== new Date(file.stat.mtime).getTime();
		}
	}
	return false;
}

export function autoAddCitations(app: App, settings: SimpleCitationsSettings, file: TFile) {
	if (!settings.autoAddCitations) return;
	if (!isBibliographyUpdated(settings, file)) return;
	(app as any).commands.executeCommandById('simple-citations:add-citations');
}

export function autoSyncCitations(app: App, settings: SimpleCitationsSettings, file: TFile) {
	if (!settings.autoSyncCitations) return;
	if (!isBibliographyUpdated(settings, file)) return;
	(app as any).commands.executeCommandById('simple-citations:sync-citations');
}
