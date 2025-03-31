import { App, TFile } from "obsidian";
import { replaceCommentTags } from "./replaceCommentTags";

export async function updateContent(app: App, targetFile: TFile, template: string, abstract: string) {
    await app.vault.process(targetFile, (fileContent: string) => {
        fileContent = replaceCommentTags(fileContent, "<!-- START_TEMPLATE -->", "<!-- END_TEMPLATE -->", template);
        fileContent = replaceCommentTags(fileContent, "<!-- START_ABSTRACT -->", "<!-- END_ABSTRACT -->", abstract);
        return fileContent;
    });
}