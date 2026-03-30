import { convertToPandocFormat } from '../convertToPandocFormat';

describe('convertToPandocFormat', () => {
	it('converts [[@key]] to [@key]', () => {
		expect(convertToPandocFormat('[[@smith2020]]')).toBe('[@smith2020]');
	});

	it('removes aliases from wiki-links before converting', () => {
		expect(convertToPandocFormat('[[@smith2020|Smith 2020]]')).toBe('[@smith2020]');
	});

	it('joins adjacent citations', () => {
		// ] + space + [@ → ;@ (the ] is consumed by the regex)
		expect(convertToPandocFormat('[[@a]] [[@b]]')).toBe('[@a;@b]');
	});

	it('moves citation after a period to before it', () => {
		// ".[@key]" → " [@key]. "
		expect(convertToPandocFormat('Smith et al.[@smith2020]')).toBe('Smith et al [@smith2020]. ');
	});

	it('handles mixed transformations', () => {
		const input = 'Cited by [[@jones2019|Jones]] and [[@smith2020]].';
		const result = convertToPandocFormat(input);
		expect(result).toContain('[@jones2019]');
		expect(result).toContain('[@smith2020]');
	});

	it('leaves non-citation content unchanged', () => {
		expect(convertToPandocFormat('No citations here.')).toBe('No citations here.');
	});
});
