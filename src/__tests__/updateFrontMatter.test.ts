import { updateFrontMatter } from "../utils/updateFrontMatter";
import { DEFAULT_SETTINGS } from "../settings/settings";

function run(fm: Record<string, unknown>, fullSync = false) {
	const app = {
		fileManager: {
			processFrontMatter: jest.fn(async (_file, fn) => fn(fm)),
		},
	} as any;
	const file = { stat: { ctime: new Date(2026, 9, 20, 9, 30).getTime() } } as any;
	const settings = { ...DEFAULT_SETTINGS, createdProperty: "date" };
	const item = { id: "doe2020", title: "A title", "container-title": "Journal" };
	return updateFrontMatter(app, settings, file, item, fullSync).then(() => fm);
}

describe("updateFrontMatter created date", () => {
	it("adds the creation date as the first property", async () => {
		const fm = await run({});
		expect(fm.date).toBe("2026-10-20");
		expect(Object.keys(fm)[0]).toBe("date");
	});

	it("keeps an existing value and moves it to the top", async () => {
		const fm = await run({ title: "Old", note: "kept", date: "2020-01-01" });
		expect(fm.date).toBe("2020-01-01");
		expect(Object.keys(fm)[0]).toBe("date");
		expect(fm.note).toBe("kept");
	});

	it("keeps an existing value across full sync", async () => {
		const fm = await run({ date: "2020-01-01", note: "dropped" }, true);
		expect(fm.date).toBe("2020-01-01");
		expect(fm.note).toBeUndefined();
	});
});
