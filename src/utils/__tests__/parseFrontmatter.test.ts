import { parseFrontmatter } from '../parseFrontmatter';

describe('parseFrontmatter', () => {
	it('splits frontmatter and content correctly', () => {
		const input = '---\ntitle: Hello\n---\nContent here.';
		const { frontmatter, content } = parseFrontmatter(input);
		expect(frontmatter).toBe('---\ntitle: Hello\n---\n');
		expect(content).toBe('Content here.');
	});

	it('returns empty frontmatter when no frontmatter present', () => {
		const input = 'Just content.';
		const { frontmatter, content } = parseFrontmatter(input);
		expect(frontmatter).toBe('');
		expect(content).toBe('Just content.');
	});

	it('returns empty frontmatter when closing delimiter is missing', () => {
		const input = '---\ntitle: Hello\nno closing delimiter';
		const { frontmatter, content } = parseFrontmatter(input);
		expect(frontmatter).toBe('');
		expect(content).toBe(input);
	});

	it('frontmatter + content reconstructs original input', () => {
		const input = '---\ntitle: Test\n---\nBody text.';
		const { frontmatter, content } = parseFrontmatter(input);
		expect(frontmatter + content).toBe(input);
	});
});
