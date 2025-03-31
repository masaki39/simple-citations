import { trimContent } from "./trimContent";
import { addAfterFrontmatter } from "./addAfterFrontmatter";

export function replaceCommentTags(content: string, startTag: string, endTag: string, replacement: string) {
	const tagRegex = new RegExp(`${startTag}[\\s\\S]*?${endTag}`);
    const replacementContent = replacement ? `${startTag}\n${replacement}\n${endTag}` : '';
    return tagRegex.test(content) ?
        trimContent(content.replace(tagRegex, replacementContent)) : // 置換してからトリム
        replacement ?  addAfterFrontmatter(trimContent(content), replacementContent) : trimContent(content); // ない場合はそのまま返す
}