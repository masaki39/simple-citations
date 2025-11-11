import { validateCitekey } from '../validateCitekey';

describe('validateCitekey', () => {
	let consoleSpy: jest.SpyInstance;

	beforeEach(() => {
		consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	it('rejects empty citekeys', () => {
		expect(validateCitekey('')).toBe(false);
	});

	it('rejects citekeys with invalid characters', () => {
		expect(validateCitekey('bad/key')).toBe(false);
		expect(validateCitekey('bad:key')).toBe(false);
		expect(validateCitekey('bad#key')).toBe(false);
	});

	it('accepts citekeys made of safe characters', () => {
		expect(validateCitekey('doe2023note')).toBe(true);
		expect(validateCitekey('Doe_2023')).toBe(true);
	});
});
