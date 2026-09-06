// The plugin runs in Obsidian's renderer, where `window` is always present, and
// the Obsidian lint rules require the `window.*` timer methods over the bare
// globals. Jest's "node" environment has no `window`, so alias the timer methods
// it uses onto a minimal shim. Keep this in sync with the `window.*` calls in
// src/ (currently just the timer family).
if (typeof globalThis.window === 'undefined') {
	globalThis.window = {
		setTimeout: globalThis.setTimeout.bind(globalThis),
		clearTimeout: globalThis.clearTimeout.bind(globalThis),
		setInterval: globalThis.setInterval.bind(globalThis),
		clearInterval: globalThis.clearInterval.bind(globalThis),
	};
}
