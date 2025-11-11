import { trimContent } from '../trimContent';

describe('trimContent', () => {
	it('removes surrounding blank lines but preserves internal whitespace', () => {
		const file = `---
title: Sample
---


- item 1 
- item 2   

`;

		expect(trimContent(file)).toBe(`---\ntitle: Sample\n---\n\n- item 1 \n- item 2   \n`);
	});

	it('handles files without frontmatter', () => {
		const file = `

line 1  
line 2

`;

		expect(trimContent(file)).toBe(`line 1  \nline 2\n`);
	});

	it('returns frontmatter as-is when content is empty', () => {
		const file = `---
title: Empty
---

`;

		expect(trimContent(file)).toBe(`---\ntitle: Empty\n---\n`);
	});
});
