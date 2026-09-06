import {
	TEMPLATE_SAMPLES,
	getTemplateSample,
	templateSampleOptions,
	resolveTemplateContent,
} from "../templateSamples";
import { SimpleCitationsSettings } from "../../settings/settings";

describe("templateSamples", () => {
	it("exposes a dropdown option per sample", () => {
		expect(templateSampleOptions()).toEqual(
			Object.fromEntries(
				Object.entries(TEMPLATE_SAMPLES).map(([k, v]) => [k, v.label])
			)
		);
		expect(templateSampleOptions()[""]).toBe("None");
	});

	it("returns an empty string for the none / unknown keys", () => {
		expect(getTemplateSample("")).toBe("");
		expect(getTemplateSample("does-not-exist")).toBe("");
	});

	it("combines both single-view samples for the combined key", () => {
		expect(getTemplateSample("first-author-journal")).toBe(
			`${getTemplateSample("first-author")}\n\n${getTemplateSample("journal")}`
		);
	});

	it("wraps each sample query in an embedded base block that reads `this`", () => {
		for (const key of ["first-author", "journal"]) {
			const content = getTemplateSample(key);
			expect(content).toContain("```base");
			expect(content).toContain("this.");
		}
	});

	describe("resolveTemplateContent", () => {
		const settings = { templateSample: "journal" } as SimpleCitationsSettings;

		it("reads the template file when one is resolved", async () => {
			const app = {
				vault: { cachedRead: jest.fn().mockResolvedValue("file body") },
			} as any;

			await expect(
				resolveTemplateContent(app, settings, { path: "t.md" } as any)
			).resolves.toBe("file body");
			expect(app.vault.cachedRead).toHaveBeenCalledTimes(1);
		});

		it("falls back to the selected sample when there is no template file", async () => {
			const app = { vault: { cachedRead: jest.fn() } } as any;

			await expect(
				resolveTemplateContent(app, settings, null)
			).resolves.toBe(getTemplateSample("journal"));
			expect(app.vault.cachedRead).not.toHaveBeenCalled();
		});
	});
});
