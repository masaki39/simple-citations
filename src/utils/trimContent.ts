import { parseFrontmatter } from "./parseFrontmatter";

export function trimContent(fileContent: string) {
	const parsed = parseFrontmatter(fileContent);
	const lines = parsed.content.split('\n');

	while (lines.length && lines[0].trim() === '') {
		lines.shift();
	}

	while (lines.length && lines[lines.length - 1].trim() === '') {
		lines.pop();
	}

	const normalizedContent = lines.join('\n');
	const hasFrontmatter = parsed.frontmatter.length > 0;
	const hasContent = normalizedContent.length > 0;

	if (!hasFrontmatter) {
		return hasContent ? `${normalizedContent}\n` : '';
	}

	if (!hasContent) {
		return parsed.frontmatter;
	}

	return `${parsed.frontmatter}\n${normalizedContent}\n`;
}
