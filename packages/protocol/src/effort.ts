/**
 * Reasoning-effort levels and which ones each model supports. Pure, so the
 * server (validation) and the plugin (menu rendering) share ONE table.
 *
 * The SDK only reports supported levels per model *alias* (opus / sonnet /
 * haiku), so we key on the model family. Verified against
 * `Query.supportedModels()`: opus = low..max incl. xhigh; sonnet = low, medium,
 * high, max (no xhigh); haiku 4.5 = no effort support. See TDL-20260930-001.
 * Fable 5.1 and Haiku 5.5 take all five levels (per the Claude API model docs,
 * not yet checked against `supportedModels()`); see TDL-20261117-005.
 */

/** Ordered lowest → highest. */
export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;

export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export function isEffortLevel(value: unknown): value is EffortLevel {
	return typeof value === "string" && (EFFORT_LEVELS as readonly string[]).includes(value);
}

/** The levels a model accepts, lowest first. Empty when the model has no effort control. */
export function supportedEffortLevels(model: string): EffortLevel[] {
	const id = model.toLowerCase();
	if (id.includes("opus") || id.includes("fable") || id.includes("haiku-5")) return [...EFFORT_LEVELS];
	if (id.includes("sonnet")) return EFFORT_LEVELS.filter((l) => l !== "xhigh");
	return [];
}

/**
 * Coerce `level` to one `model` supports: itself if supported, else the highest
 * supported level below it (so `xhigh` on Sonnet becomes `high`), else the
 * lowest supported. `undefined` (= the model's own default) passes through, and
 * a model with no effort control always yields `undefined`.
 */
export function clampEffort(model: string, level: EffortLevel | undefined): EffortLevel | undefined {
	if (!level) return undefined;
	const supported = supportedEffortLevels(model);
	if (supported.length === 0) return undefined;
	if (supported.includes(level)) return level;
	const rank = EFFORT_LEVELS.indexOf(level);
	const lower = supported.filter((l) => EFFORT_LEVELS.indexOf(l) < rank);
	return lower.length > 0 ? lower[lower.length - 1] : supported[0];
}
