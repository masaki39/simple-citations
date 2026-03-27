/**
 * Merge strategy types:
 * - 'priority': use value from the highest-priority (earliest) bibliography file
 * - 'merge': combine values from all files (arrays concat, strings become array)
 */
export type MergeStrategy = 'priority' | 'merge';

/** Properties that default to 'merge' — aggregated across bibliography files. */
const MERGE_BY_DEFAULT: ReadonlySet<string> = new Set([
	'collections',
	'library',
]);

/** Get the effective merge strategy for a given property. */
export function getStrategy(
	overrides: Record<string, string>,
	property: string
): MergeStrategy {
	const override = overrides[property];
	if (override === 'priority' || override === 'merge') return override;
	return MERGE_BY_DEFAULT.has(property) ? 'merge' : 'priority';
}

/** Get the default strategy for a property (ignoring user overrides). */
export function getDefaultStrategy(property: string): MergeStrategy {
	return MERGE_BY_DEFAULT.has(property) ? 'merge' : 'priority';
}

/**
 * Merge two values according to the 'merge' strategy.
 * - Both arrays → concat and deduplicate
 * - Mixed or both scalars → wrap in array and deduplicate
 */
export function mergeValues(existing: any, incoming: any): any {
	if (existing === undefined) return incoming;
	if (incoming === undefined) return existing;
	const arrA = Array.isArray(existing) ? existing : [existing];
	const arrB = Array.isArray(incoming) ? incoming : [incoming];
	const seen = new Set<string>();
	const result: any[] = [];
	for (const item of [...arrA, ...arrB]) {
		const key = typeof item === 'object' && item !== null
			? JSON.stringify(item)
			: String(item);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(item);
		}
	}
	return result;
}
