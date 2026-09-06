import { App, TFile } from "obsidian";
import { replaceCommentTags } from "./replaceCommentTags";

export async function updateContent(app: App, targetFile: TFile, template: string, abstract: string) {
    const normalizedAbstract = typeof abstract === "string" ? abstract : "";
    const trimmedAbstract = normalizedAbstract.split("\n").map(line => line.trim()).join("\n").replace(/\n{2,}/g, "\n");
    await app.vault.process(targetFile, (fileContent: string) => {
        fileContent = replaceCommentTags(fileContent, "<!-- START_TEMPLATE -->", "<!-- END_TEMPLATE -->", template);
        fileContent = replaceCommentTags(fileContent, "<!-- START_ABSTRACT -->", "<!-- END_ABSTRACT -->", trimmedAbstract);
        // The abstract and template blocks are inserted after the frontmatter on
        // separate passes, which can leave two blank lines between them. Keep one.
        fileContent = fileContent.replace(
            /<!-- END_ABSTRACT -->\n{3,}<!-- START_TEMPLATE -->/,
            "<!-- END_ABSTRACT -->\n\n<!-- START_TEMPLATE -->"
        );
        return fileContent;
    });
}
