import { App, Notice, TFile, TFolder, normalizePath } from 'obsidian';
import { SimpleCitationsSettings } from '../settings/settings';

export interface FileCheckResult {
    jsonFiles: TFile[];
    folder: TFolder | null;
    templateFile: TFile | null;
    error?: string;
}

export function checkRequiredFiles(app: App, settings: SimpleCitationsSettings): FileCheckResult {
    // resolve json files
    const jsonFiles: TFile[] = [];
    for (const path of settings.jsonPaths) {
        if (!path) continue;
        const normalizedPath = normalizePath(path);
        const file = app.vault.getFileByPath(normalizedPath);
        if (file && file.extension === 'json') {
            jsonFiles.push(file);
        }
    }

    if (jsonFiles.length === 0) {
        new Notice(`No valid JSON files found. Please check bibliography file paths in settings.`);
        return {
            jsonFiles: [],
            folder: null,
            templateFile: null,
            error: `No valid JSON files found`
        };
    }

    // normalize folder path
    const normalizedFolderPath = normalizePath(settings.folderPath);
    const folder = app.vault.getAbstractFileByPath(normalizedFolderPath);
    const isFolder = folder && folder instanceof TFolder;

    if (!isFolder) {
        new Notice(`Folder not found: ${normalizedFolderPath}`);
        return {
            jsonFiles: [],
            folder: null,
            templateFile: null,
            error: `Folder not found: ${normalizedFolderPath}`
        };
    }

    // template file
    const normalizedTemplatePath = normalizePath(settings.templatePath + ".md");
    const templateFile = app.vault.getFileByPath(normalizedTemplatePath);

    return {
        jsonFiles,
        folder,
        templateFile
    };
}
