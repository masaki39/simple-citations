import { AbstractInputSuggest, App, TAbstractFile, TFile } from "obsidian";

export class JsonFileSuggest extends AbstractInputSuggest<TFile> {
	private textInputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.textInputEl = inputEl;
	}

	getSuggestions(inputStr: string): TFile[] {
		const lowerInput = inputStr.toLowerCase();
		return this.app.vault.getAllLoadedFiles().filter(
			(f: TAbstractFile): f is TFile =>
				f instanceof TFile &&
				f.extension === "json" &&
				f.path.toLowerCase().includes(lowerInput)
		);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.setValue(file.path);
		this.textInputEl.dispatchEvent(new Event("input"));
		this.close();
	}
}
