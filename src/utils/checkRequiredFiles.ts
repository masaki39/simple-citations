import { App, Notice, TFile, TFolder, normalizePath } from 'obsidian';
import { SimpleCitationsSettings } from '../settings/settings';

export interface FileCheckResult {
    jsonFile: TFile | null;
    folder: TFolder | null;
    templateFile: TFile | null;
    error?: string;
}

export function checkRequiredFiles(app: App, settings: SimpleCitationsSettings): FileCheckResult {
    // normalize path
    const normalizedJsonPath = normalizePath(settings.jsonPath);
    const normalizedFolderPath = normalizePath(settings.folderPath);
    const normalizedTemplatePath = normalizePath(settings.templatePath + ".md");

    // get json and folder existing check
    const jsonFile = app.vault.getFileByPath(`${normalizedJsonPath}`);
    const folder = app.vault.getAbstractFileByPath(`${normalizedFolderPath}`);
    const templateFile = app.vault.getFileByPath(`${normalizedTemplatePath}`);

    // Individual error checks
    if (!jsonFile) {
        new Notice(`JSON file not found: ${normalizedJsonPath}`);
        return {
            jsonFile: null,
            folder: null,
            templateFile: null,
            error: `JSON file not found: ${normalizedJsonPath}`
        };
    }

    if (!folder || !(folder instanceof TFolder)) {
        new Notice(`Folder not found: ${normalizedFolderPath}`);
        return {
            jsonFile: null,
            folder: null,
            templateFile: null,
            error: `Folder not found: ${normalizedFolderPath}`
        };
    }

    return {
        jsonFile,
        folder,
        templateFile
    };
} 