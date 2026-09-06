/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Load a Node built-in module.
 *
 * Obsidian plugins run in a CommonJS context, so `require` is the reliable
 * loader. Native dynamic `import("child_process")` throws in Obsidian's Electron
 * renderer — the browser ESM loader cannot resolve a bare Node specifier — so it
 * must not be used for built-ins.
 *
 * These modules only exist on desktop; guard every call site with
 * `Platform.isDesktop`.
 */

type NodeRequireFn = (id: string) => unknown;

function getRequire(): NodeRequireFn | null {
	if (typeof require === "function") return require as NodeRequireFn;
	const g = globalThis as { require?: NodeRequireFn };
	return typeof g.require === "function" ? g.require : null;
}

/** Require a Node built-in, or throw with a clear message. */
export function requireNode<T>(id: string): T {
	const req = getRequire();
	if (!req) throw new Error("require() is unavailable in this context");
	return req(id) as T;
}

/** Require a Node built-in, returning either the module or the failure reason. */
export function tryRequireNode<T>(id: string): { ok: true; module: T } | { ok: false; error: string } {
	try {
		return { ok: true, module: requireNode<T>(id) };
	} catch (error) {
		return { ok: false, error: (error as Error).message };
	}
}
