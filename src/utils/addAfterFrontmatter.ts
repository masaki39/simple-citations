// example:
// ```
// ---
// title: Example
// ---
// content
// ```
//
// will be transformed to:
// ```
// ---
// title: Example
// ---
// new content
//
// content
// ```
import { parseFrontmatter } from "./parseFrontmatter";

export function addAfterFrontmatter(fileContent: string, newContent: string): string {
    const { frontmatter, content } = parseFrontmatter(fileContent);
    return frontmatter + newContent + '\n\n' + content;
}
