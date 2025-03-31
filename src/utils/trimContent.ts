import { parseFrontmatter } from "./parseFrontmatter";

export function trimContent(fileContent: string) {
    const parsed = parseFrontmatter(fileContent);
    return parsed.frontmatter + parsed.content.trim();
}