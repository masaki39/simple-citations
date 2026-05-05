import { isBetterBibTeXFormat, normalizeBbtEntry } from '../loadBibliographyData';

describe('isBetterBibTeXFormat', () => {
	it('returns false for a flat array (CSL JSON)', () => {
		expect(isBetterBibTeXFormat([{ 'citation-key': 'a' }])).toBe(false);
	});

	it('returns true for a valid BetterBibTeX JSON object', () => {
		expect(isBetterBibTeXFormat({
			config: { label: 'BetterBibTeX JSON' },
			items: []
		})).toBe(true);
	});

	it('returns false when config.label differs', () => {
		expect(isBetterBibTeXFormat({
			config: { label: 'BetterCSLJSON' },
			items: []
		})).toBe(false);
	});

	it('returns false when items is missing', () => {
		expect(isBetterBibTeXFormat({
			config: { label: 'BetterBibTeX JSON' }
		})).toBe(false);
	});

	it('returns false when items is not an array', () => {
		expect(isBetterBibTeXFormat({
			config: { label: 'BetterBibTeX JSON' },
			items: {}
		})).toBe(false);
	});

	it('returns false for null', () => {
		expect(isBetterBibTeXFormat(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isBetterBibTeXFormat(undefined)).toBe(false);
	});

	it('returns false for a plain string', () => {
		expect(isBetterBibTeXFormat('BetterBibTeX JSON')).toBe(false);
	});
});

describe('normalizeBbtEntry', () => {
	const noCollections = new Map<string, string[]>();

	it('maps citationKey to citation-key', () => {
		const result = normalizeBbtEntry({ citationKey: 'smith2024' }, noCollections);
		expect(result['citation-key']).toBe('smith2024');
	});

	it('sets _bbt flag to true', () => {
		const result = normalizeBbtEntry({}, noCollections);
		expect(result['_bbt']).toBe(true);
	});

	it('maps abstractNote to abstract', () => {
		const result = normalizeBbtEntry({ abstractNote: 'This is the abstract.' }, noCollections);
		expect(result['abstract']).toBe('This is the abstract.');
	});

	it('does not set abstract when abstractNote is absent', () => {
		const result = normalizeBbtEntry({}, noCollections);
		expect(result['abstract']).toBeUndefined();
	});

	it('extracts a single PDF path as a string', () => {
		const result = normalizeBbtEntry({
			attachments: [{ path: '/path/to/file.pdf' }]
		}, noCollections);
		expect(result['pdf']).toBe('/path/to/file.pdf');
	});

	it('extracts multiple PDF paths as an array', () => {
		const result = normalizeBbtEntry({
			attachments: [
				{ path: '/path/a.pdf' },
				{ path: '/path/b.pdf' }
			]
		}, noCollections);
		expect(result['pdf']).toEqual(['/path/a.pdf', '/path/b.pdf']);
	});

	it('ignores non-PDF attachments', () => {
		const result = normalizeBbtEntry({
			attachments: [
				{ path: '/path/snapshot.html' },
				{ path: '/path/file.pdf' }
			]
		}, noCollections);
		expect(result['pdf']).toBe('/path/file.pdf');
	});

	it('does not set pdf when no PDF attachments exist', () => {
		const result = normalizeBbtEntry({
			attachments: [{ path: '/path/snapshot.html' }]
		}, noCollections);
		expect(result['pdf']).toBeUndefined();
	});

	it('does not set pdf when attachments is absent', () => {
		const result = normalizeBbtEntry({}, noCollections);
		expect(result['pdf']).toBeUndefined();
	});

	it('resolves collection names from the map using item key', () => {
		const colMap = new Map([['KXEXBFTX', ['Spine Surgery', 'Orthopedics']]]);
		const result = normalizeBbtEntry({ key: 'KXEXBFTX' }, colMap);
		expect(result['collections']).toEqual(['Spine Surgery', 'Orthopedics']);
	});

	it('does not set collections when item key is absent', () => {
		const colMap = new Map([['KXEXBFTX', ['Spine Surgery']]]);
		const result = normalizeBbtEntry({}, colMap);
		expect(result['collections']).toBeUndefined();
	});

	it('does not set collections when key has no matching entry', () => {
		const result = normalizeBbtEntry({ key: 'XXXXXXX' }, noCollections);
		expect(result['collections']).toBeUndefined();
	});

	it('preserves other item fields', () => {
		const result = normalizeBbtEntry({ title: 'My Title', DOI: '10.1/foo' }, noCollections);
		expect(result['title']).toBe('My Title');
		expect(result['DOI']).toBe('10.1/foo');
	});
});
