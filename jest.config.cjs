/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src'],
	testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
	moduleFileExtensions: ['ts', 'js', 'json'],
	clearMocks: true
};
