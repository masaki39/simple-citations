import { App, normalizePath, TFolder, setIcon } from "obsidian";

function setStatusIcon(el: HTMLElement, valid: boolean) {
    el.empty();
    el.addClass('simple-citations-status');
    el.removeClass('is-valid', 'is-invalid');
    el.addClass(valid ? 'is-valid' : 'is-invalid');
    setIcon(el, valid ? 'check-circle' : 'x-circle');
}

export function updateSettingJsonStatus(app: App, statusSpan: HTMLElement, path: string) {
    if (!path) { statusSpan.empty(); return; }
    const normalizedPath = normalizePath(path);
    const file = app.vault.getFileByPath(normalizedPath);
    setStatusIcon(statusSpan, !!(file && file.extension === 'json'));
}

export function updateSettingFolderStatus(app: App, statusSpan: HTMLElement, path: string) {
    if (!path) { statusSpan.empty(); return; }
    const normalizedPath = normalizePath(path);
    const folder = app.vault.getAbstractFileByPath(normalizedPath);
    setStatusIcon(statusSpan, !!(folder && folder instanceof TFolder));
}

export function updateSettingTemplateStatus(app: App, statusSpan: HTMLElement, path: string) {
    if (!path) { statusSpan.empty(); return; }
    const normalizedPath = normalizePath(path + ".md");
    const file = app.vault.getFileByPath(normalizedPath);
    setStatusIcon(statusSpan, !!file);
}
