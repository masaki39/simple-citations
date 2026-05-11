import { parseBbtYear } from '../updateFrontMatter';

describe('parseBbtYear', () => {
	it('parses 4-digit year', () => {
		expect(parseBbtYear('1999')).toBe(1999);
	});

	it('parses YYYY-MM format', () => {
		expect(parseBbtYear('2010-03')).toBe(2010);
	});

	it('parses YYYY-MM-DD format', () => {
		expect(parseBbtYear('2020-03-20')).toBe(2020);
	});

	it('parses YYYY-M-D format', () => {
		expect(parseBbtYear('2001-5-1')).toBe(2001);
	});

	it('parses YYYY/MM/DD format', () => {
		expect(parseBbtYear('2001/06/01')).toBe(2001);
	});

	it('parses MM/YYYY format', () => {
		expect(parseBbtYear('07/2019')).toBe(2019);
	});

	it('parses M/YYYY format', () => {
		expect(parseBbtYear('9/2013')).toBe(2013);
	});

	it('parses 09/2013 format', () => {
		expect(parseBbtYear('09/2013')).toBe(2013);
	});

	it('trims whitespace', () => {
		expect(parseBbtYear('  2022  ')).toBe(2022);
	});

	it('returns undefined for invalid date', () => {
		expect(parseBbtYear('not-a-date')).toBeUndefined();
	});

	it('returns undefined for empty string', () => {
		expect(parseBbtYear('')).toBeUndefined();
	});
});
