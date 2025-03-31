import { parseFrontmatter } from "./parseFrontmatter";

export function addAfterFrontmatter(fileContent: string, newContent: string): string {
    const { frontmatter, content } = parseFrontmatter(fileContent);
    return frontmatter + newContent + '\n\n' + content;
}
