import { updateContent } from "../utils/updateContent";

describe("updateContent", () => {
	it("handles undefined abstract without throwing and removes abstract block", async () => {
		const content = [
			"---",
			"title: Test",
			"---",
			"",
			"Body",
			"",
			"<!-- START_ABSTRACT -->",
			"Old abstract",
			"<!-- END_ABSTRACT -->",
			"",
			"<!-- START_TEMPLATE -->",
			"Old template",
			"<!-- END_TEMPLATE -->",
			""
		].join("\n");
		let processed = "";
		const app = {
			vault: {
				process: jest.fn(async (_file, processor) => {
					processed = processor(content);
					return processed;
				})
			}
		} as any;

		await expect(updateContent(app, {} as any, "New template", undefined as any)).resolves.toBeUndefined();

		expect(app.vault.process).toHaveBeenCalledTimes(1);
		expect(processed).toContain("New template");
		expect(processed).not.toContain("Old template");
		expect(processed).not.toContain("Old abstract");
		expect(processed).not.toContain("START_ABSTRACT");
	});

	it("normalizes abstract whitespace", async () => {
		const content = [
			"<!-- START_ABSTRACT -->",
			"Old abstract",
			"<!-- END_ABSTRACT -->",
			""
		].join("\n");
		let processed = "";
		const app = {
			vault: {
				process: jest.fn(async (_file, processor) => {
					processed = processor(content);
					return processed;
				})
			}
		} as any;

		const abstract = "  Line 1  \n\n  Line 2  \n";

		await updateContent(app, {} as any, "", abstract);

		const match = processed.match(/<!-- START_ABSTRACT -->([\s\S]*?)<!-- END_ABSTRACT -->/);
		expect(match).not.toBeNull();
		const normalized = match![1].split("\n").map(line => line.trim()).filter(line => line.length > 0).join("\n");
		expect(normalized).toBe("Line 1\nLine 2");
	});
});
