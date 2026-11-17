import { clampEffort, isEffortLevel, supportedEffortLevels } from "../src/effort";

describe("supportedEffortLevels", () => {
	it("gives Opus every level", () => {
		expect(supportedEffortLevels("claude-opus-5-5")).toEqual(["low", "medium", "high", "xhigh", "max"]);
		expect(supportedEffortLevels("claude-opus-5")).toEqual(["low", "medium", "high", "xhigh", "max"]);
	});

	it("gives Sonnet everything but xhigh", () => {
		expect(supportedEffortLevels("claude-sonnet-5-5")).toEqual(["low", "medium", "high", "max"]);
	});

	it("gives Fable 5.1 and Haiku 5.5 every level", () => {
		expect(supportedEffortLevels("claude-fable-5-1")).toEqual(["low", "medium", "high", "xhigh", "max"]);
		expect(supportedEffortLevels("claude-haiku-5-5")).toEqual(["low", "medium", "high", "xhigh", "max"]);
	});

	it("gives Haiku 4.5 and unknown models none", () => {
		expect(supportedEffortLevels("claude-haiku-4-5-20251001")).toEqual([]);
		expect(supportedEffortLevels("something-else")).toEqual([]);
	});

	it("returns a fresh array each call", () => {
		const a = supportedEffortLevels("claude-opus-5-5");
		a.pop();
		expect(supportedEffortLevels("claude-opus-5-5")).toHaveLength(5);
	});
});

describe("clampEffort", () => {
	it("passes supported levels through", () => {
		expect(clampEffort("claude-opus-5-5", "xhigh")).toBe("xhigh");
		expect(clampEffort("claude-sonnet-5-5", "max")).toBe("max");
	});

	it("drops an unsupported level to the highest supported one below it", () => {
		expect(clampEffort("claude-sonnet-5-5", "xhigh")).toBe("high");
	});

	it("keeps 'model default' (undefined) as undefined", () => {
		expect(clampEffort("claude-opus-5-5", undefined)).toBeUndefined();
	});

	it("yields undefined for models without effort control", () => {
		expect(clampEffort("claude-haiku-4-5-20251001", "high")).toBeUndefined();
	});
});

describe("isEffortLevel", () => {
	it("accepts the five levels and rejects anything else", () => {
		for (const l of ["low", "medium", "high", "xhigh", "max"]) expect(isEffortLevel(l)).toBe(true);
		for (const v of ["ultra", "", null, undefined, 3, {}]) expect(isEffortLevel(v)).toBe(false);
	});
});
