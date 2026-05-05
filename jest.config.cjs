/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src'],
	testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
	moduleFileExtensions: ['ts', 'js', 'json'],
	moduleNameMapper: {
		'^obsidian$': '<rootDir>/src/__mocks__/obsidian.js'
	},
	clearMocks: true
};
