import { replaceCommentTags } from '../replaceCommentTags';

const START = '<!-- START -->';
const END = '<!-- END -->';

describe('replaceCommentTags', () => {
	it('replaces content between existing tags', () => {
		const input = `---\ntitle: Test\n---\n${START}\nold\n${END}\nAfter.`;
		const result = replaceCommentTags(input, START, END, 'new');
		expect(result).toContain(`${START}\nnew\n${END}`);
		expect(result).not.toContain('old');
	});

	it('removes tags when replacement is empty', () => {
		const input = `---\ntitle: Test\n---\n${START}\nold\n${END}\nAfter.`;
		const result = replaceCommentTags(input, START, END, '');
		expect(result).not.toContain(START);
		expect(result).not.toContain(END);
		expect(result).not.toContain('old');
	});

	it('adds content after frontmatter when tags are absent', () => {
		const input = '---\ntitle: Test\n---\nContent.';
		const result = replaceCommentTags(input, START, END, 'inserted');
		expect(result).toContain(`${START}\ninserted\n${END}`);
		expect(result).toContain('Content.');
	});

	it('returns trimmed content when tags are absent and replacement is empty', () => {
		const input = '---\ntitle: Test\n---\n\nContent.\n\n';
		const result = replaceCommentTags(input, START, END, '');
		expect(result).not.toContain(START);
		expect(result.trim()).toBe(result.trim());
	});
});
