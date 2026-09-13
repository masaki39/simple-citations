import { BASE_PROPERTIES } from './updateFrontMatter';

/** Frontmatter keys the plugin always manages; never offered for removal here. */
export const PROTECTED_PROPERTIES: readonly string[] = [
	...BASE_PROPERTIES,
	'aliases',
	'tags',
	'zotero',
	'bibliography',
];

/** Parses a comma-separated list of property names into a de-duplicated, trimmed array. */
export function parseFieldNames(input: string): string[] {
	return Array.from(new Set(
		input.split(',').map(f => f.trim()).filter(Boolean)
	));
}

export interface SplitFields {
	removable: string[];
	protectedFields: string[];
}

/** Splits requested field names into ones safe to remove and ones the plugin manages itself. */
export function splitProtectedFields(fields: string[]): SplitFields {
	const removable: string[] = [];
	const protectedFields: string[] = [];
	for (const field of fields) {
		(PROTECTED_PROPERTIES.includes(field) ? protectedFields : removable).push(field);
	}
	return { removable, protectedFields };
}

/** Counts, per field, how many of the given frontmatter objects currently contain it. */
export function countFieldMatches(
	frontmatters: (Record<string, unknown> | undefined)[],
	fields: string[]
): Map<string, number> {
	const counts = new Map<string, number>(fields.map(f => [f, 0]));
	for (const fm of frontmatters) {
		if (!fm) continue;
		for (const field of fields) {
			if (Object.prototype.hasOwnProperty.call(fm, field)) {
				counts.set(field, (counts.get(field) ?? 0) + 1);
			}
		}
	}
	return counts;
}
