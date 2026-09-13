import { parseFieldNames, splitProtectedFields, countFieldMatches } from '../removeFields';

describe('parseFieldNames', () => {
	it('splits on commas and trims whitespace', () => {
		expect(parseFieldNames(' text ,  oldField ,foo')).toEqual(['text', 'oldField', 'foo']);
	});

	it('drops empty entries', () => {
		expect(parseFieldNames('text,,  ,foo')).toEqual(['text', 'foo']);
	});

	it('de-duplicates repeated names', () => {
		expect(parseFieldNames('text, text, Text')).toEqual(['text', 'Text']);
	});

	it('returns an empty array for blank input', () => {
		expect(parseFieldNames('   ')).toEqual([]);
	});
});

describe('splitProtectedFields', () => {
	it('separates plugin-managed properties from removable ones', () => {
		const result = splitProtectedFields(['text', 'title', 'oldField', 'tags']);
		expect(result.removable).toEqual(['text', 'oldField']);
		expect(result.protectedFields).toEqual(['title', 'tags']);
	});

	it('treats all fields as removable when none are protected', () => {
		const result = splitProtectedFields(['text', 'oldField']);
		expect(result.removable).toEqual(['text', 'oldField']);
		expect(result.protectedFields).toEqual([]);
	});

	it('returns empty arrays for empty input', () => {
		expect(splitProtectedFields([])).toEqual({ removable: [], protectedFields: [] });
	});
});

describe('countFieldMatches', () => {
	it('counts how many frontmatter objects contain each field', () => {
		const frontmatters = [
			{ text: ['a.txt'], title: 'A' },
			{ title: 'B' },
			{ text: [], txt: ['b.txt'] },
		];
		const counts = countFieldMatches(frontmatters, ['text', 'txt']);
		expect(counts.get('text')).toBe(2);
		expect(counts.get('txt')).toBe(1);
	});

	it('skips undefined frontmatter entries', () => {
		const counts = countFieldMatches([undefined, { text: 'a' }, undefined], ['text']);
		expect(counts.get('text')).toBe(1);
	});

	it('returns zero for fields present in no notes', () => {
		const counts = countFieldMatches([{ title: 'A' }], ['text']);
		expect(counts.get('text')).toBe(0);
	});
});
