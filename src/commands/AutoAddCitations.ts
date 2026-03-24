// ファイルが設定されたjsonファイルと同じ場合、add-citationsコマンドを実行する
// その時に、jsonファイルの更新時間が変更されているかどうかを確認する

import { App, TFile, normalizePath } from "obsidian";
import { SimpleCitationsSettings } from "../settings/settings";

export function autoAddCitations(app: App, settings: SimpleCitationsSettings, file: TFile) {
	if (!settings.autoAddCitations) return;
	if (!(file instanceof TFile)) return;

	// Check if the modified file matches any of the configured json paths
	for (const path of settings.jsonPaths) {
		if (!path) continue;
		const normalizedPath = normalizePath(path);
		if (file.path === normalizedPath) {
			const lastKnownTime = settings.jsonUpdatedTimes[file.path] ?? 0;
			if (lastKnownTime === new Date(file.stat.mtime).getTime()) {
				return;
			}
			(app as any).commands.executeCommandById('simple-citations:add-citations');
			return;
		}
	}
}
