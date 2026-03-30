import { getStrategy, getDefaultStrategy, mergeValues } from '../mergeStrategies';

describe('getDefaultStrategy', () => {
	it('returns merge for collections', () => {
		expect(getDefaultStrategy('collections')).toBe('merge');
	});

	it('returns merge for library', () => {
		expect(getDefaultStrategy('library')).toBe('merge');
	});

	it('returns priority for other properties', () => {
		expect(getDefaultStrategy('title')).toBe('priority');
		expect(getDefaultStrategy('doi')).toBe('priority');
		expect(getDefaultStrategy('year')).toBe('priority');
	});
});

describe('getStrategy', () => {
	it('respects explicit priority override', () => {
		expect(getStrategy({ collections: 'priority' }, 'collections')).toBe('priority');
	});

	it('respects explicit merge override', () => {
		expect(getStrategy({ title: 'merge' }, 'title')).toBe('merge');
	});

	it('falls back to default when no override', () => {
		expect(getStrategy({}, 'collections')).toBe('merge');
		expect(getStrategy({}, 'title')).toBe('priority');
	});
});

describe('mergeValues', () => {
	it('returns incoming when existing is undefined', () => {
		expect(mergeValues(undefined, 'foo')).toBe('foo');
	});

	it('returns existing when incoming is undefined', () => {
		expect(mergeValues('foo', undefined)).toBe('foo');
	});

	it('concatenates two arrays and deduplicates', () => {
		expect(mergeValues(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
	});

	it('wraps two scalars into a deduplicated array', () => {
		expect(mergeValues('a', 'b')).toEqual(['a', 'b']);
	});

	it('deduplicates identical scalars', () => {
		expect(mergeValues('a', 'a')).toEqual(['a']);
	});

	it('merges array and scalar', () => {
		expect(mergeValues(['a'], 'b')).toEqual(['a', 'b']);
	});
});
