import { App, normalizePath, TFolder } from "obsidian";

export function updateSettingJsonStatus(app: App, statusSpan: HTMLElement, path: string) {
    const normalizedPath = normalizePath(path);
    const file = app.vault.getFileByPath(normalizedPath);
    if (!file) {
        statusSpan.textContent = '❌';
        return;
    }
    const isJsonFile = file.extension === 'json';
    statusSpan.textContent = isJsonFile ? '✅' : '❌';
}

export function updateSettingFolderStatus(app: App, statusSpan: HTMLElement, path: string) {
	const normalizedPath = normalizePath(path);
	const folder = app.vault.getAbstractFileByPath(normalizedPath);
	folder && folder instanceof TFolder ?
		statusSpan.textContent = '✅' :
		statusSpan.textContent = '❌';
} 


export function updateSettingTemplateStatus(app: App, statusSpan: HTMLElement, path: string) {
    if (!path) {statusSpan.textContent = ''; return; }
    const normalizedPath = normalizePath(path + ".md");
	const file = app.vault.getFileByPath(normalizedPath);
	file ?
		statusSpan.textContent = '✅' :
		statusSpan.textContent = '❌';
}
