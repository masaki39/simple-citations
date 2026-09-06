import { AbstractInputSuggest, App, TAbstractFile, TFile, TFolder } from "obsidian";

/**
 * Suggests top-level field names discovered in the configured bibliography
 * JSON files. `getNames` returns the current candidate list (already filtered
 * of fields the user has selected elsewhere); the popover filters it by the
 * text typed so far.
 */
export class BibFieldSuggest extends AbstractInputSuggest<string> {
	private textInputEl: HTMLInputElement;
	private getNames: () => string[];

	constructor(app: App, inputEl: HTMLInputElement, getNames: () => string[]) {
		super(app, inputEl);
		this.textInputEl = inputEl;
		this.getNames = getNames;
	}

	getSuggestions(inputStr: string): string[] {
		const lowerInput = inputStr.toLowerCase();
		return this.getNames().filter((name) =>
			name.toLowerCase().includes(lowerInput)
		);
	}

	renderSuggestion(name: string, el: HTMLElement): void {
		el.setText(name);
	}

	selectSuggestion(name: string): void {
		this.setValue(name);
		this.textInputEl.dispatchEvent(new Event("input"));
		this.close();
		this.textInputEl.blur();
	}
}

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private textInputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.textInputEl = inputEl;
	}

	getSuggestions(inputStr: string): TFolder[] {
		const lowerInput = inputStr.toLowerCase();
		return this.app.vault.getAllLoadedFiles().filter(
			(f: TAbstractFile): f is TFolder =>
				f instanceof TFolder &&
				f.path.toLowerCase().includes(lowerInput)
		);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path || '/');
	}

	selectSuggestion(folder: TFolder): void {
		this.setValue(folder.path);
		this.textInputEl.dispatchEvent(new Event("input"));
		this.close();
		this.textInputEl.blur();
	}
}

export class JsonFileSuggest extends AbstractInputSuggest<TFile> {
	private textInputEl: HTMLInputElement;
	private excludePaths: () => string[];

	constructor(app: App, inputEl: HTMLInputElement, excludePaths: () => string[] = () => []) {
		super(app, inputEl);
		this.textInputEl = inputEl;
		this.excludePaths = excludePaths;
	}

	getSuggestions(inputStr: string): TFile[] {
		const lowerInput = inputStr.toLowerCase();
		const excluded = new Set(this.excludePaths());
		return this.app.vault.getAllLoadedFiles().filter(
			(f: TAbstractFile): f is TFile =>
				f instanceof TFile &&
				f.extension === "json" &&
				f.path.toLowerCase().includes(lowerInput) &&
				!excluded.has(f.path)
		);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.setValue(file.path);
		this.textInputEl.dispatchEvent(new Event("input"));
		this.close();
		this.textInputEl.blur();
	}
}
