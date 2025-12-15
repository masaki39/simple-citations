import { App, TFile } from "obsidian";
import { replaceCommentTags } from "./replaceCommentTags";

export async function updateContent(app: App, targetFile: TFile, template: string, abstract: string) {
    const trimmedAbstract = abstract.split("\n").map(line => line.trim()).join("\n").replace(/\n{2,}/g, "\n");
    await app.vault.process(targetFile, (fileContent: string) => {
        fileContent = replaceCommentTags(fileContent, "<!-- START_TEMPLATE -->", "<!-- END_TEMPLATE -->", template);
        fileContent = replaceCommentTags(fileContent, "<!-- START_ABSTRACT -->", "<!-- END_ABSTRACT -->", trimmedAbstract);
        return fileContent;
    });
}