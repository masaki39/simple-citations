import { addAfterFrontmatter } from '../addAfterFrontmatter';

describe('addAfterFrontmatter', () => {
	it('inserts new content after frontmatter', () => {
		const input = '---\ntitle: Test\n---\nOriginal content.';
		const result = addAfterFrontmatter(input, 'New content');
		expect(result).toBe('---\ntitle: Test\n---\nNew content\n\nOriginal content.');
	});

	it('inserts at beginning when no frontmatter', () => {
		const result = addAfterFrontmatter('Original content.', 'New content');
		expect(result).toBe('New content\n\nOriginal content.');
	});
});
