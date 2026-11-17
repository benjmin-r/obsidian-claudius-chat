import {
	App,
	PluginSettingTab,
	Setting,
	type SettingControl,
	type SettingDefinition,
	type SettingDefinitionGroup,
	type SettingDefinitionItem,
} from "obsidian";
import type ClaudiusChatPlugin from "./main";
import { EFFORT_DEFAULT_LABEL, EFFORT_LABELS, MODEL_OPTIONS, PERMISSION_MODE_OPTIONS } from "./settings-types";
import { EFFORT_LEVELS } from "@occ/protocol";

/** Text settings stored without surrounding whitespace. */
const TRIMMED_KEYS = new Set(["serverUrl", "exportFolder"]);

const MIN_RECONNECT_DELAY_MS = 100;

const EFFORT_OPTIONS: Record<string, string> = { default: EFFORT_DEFAULT_LABEL };
for (const level of EFFORT_LEVELS) EFFORT_OPTIONS[level] = EFFORT_LABELS[level];

/** Display text for a stored value: only strings and numbers have one. */
function asText(value: unknown): string {
	return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

/** A definition with a control or a render callback (the only row kinds this tab uses). */
function isRow(def: SettingDefinitionItem): def is SettingDefinition {
	return "control" in def || "render" in def;
}

/**
 * A group: a heading, one sentence saying what the group is for, then its rows.
 * The sentence is a text-only row (the group definition has no description field),
 * kept out of settings search.
 */
function group(heading: string, intro: string, items: SettingDefinition[]): SettingDefinitionGroup {
	const introRow: SettingDefinition = {
		name: intro,
		searchable: false,
		render: (setting) => {
			setting.settingEl.addClass("occ-settings-group-intro");
		},
	};
	return { type: "group", heading, items: [introRow, ...items] };
}

/**
 * Settings tab. Every field is shown on all platforms (no desktop-only
 * gating) so mobile users can configure the server URL and token.
 *
 * The fields are defined once, in `getSettingDefinitions()`. Obsidian 1.13+
 * renders (and indexes for settings search) that list itself; older versions
 * never call it and fall back to `display()`, which draws the same list.
 */
export class ClaudiusChatSettingTab extends PluginSettingTab {
	plugin: ClaudiusChatPlugin;

	constructor(app: App, plugin: ClaudiusChatPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// No top-level heading: Obsidian renders the plugin name as the tab title. The
	// group headings below are for the four sections.
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			group("Connection", "Where the plugin finds your Claudius Chat server and how it reconnects.", [
				{
					name: "Server URL",
					desc: "ws:// address of the Claudius Chat server on your tailnet, including port.",
					control: { type: "text", key: "serverUrl", placeholder: "ws://host.tailnet.ts.net:8765" },
				},
				{
					name: "Bearer token",
					desc: "Must match OCC_TOKEN on the server.",
					// Rendered by hand: the declarative text control cannot mask its input.
					render: (setting) => {
						setting.addText((text) => {
							text.setPlaceholder("token")
								.setValue(this.plugin.settings.token)
								.onChange((value) => void this.setControlValue("token", value));
							text.inputEl.type = "password";
						});
					},
				},
				{
					name: "Auto-reconnect",
					desc: "Reconnect automatically when the connection drops.",
					control: { type: "toggle", key: "autoReconnect" },
				},
				{
					name: "Reconnect delay (ms)",
					desc: "Base backoff between reconnect attempts.",
					control: {
						type: "number",
						key: "reconnectDelayMs",
						placeholder: "1500",
						min: MIN_RECONNECT_DELAY_MS,
						validate: (value) =>
							value >= MIN_RECONNECT_DELAY_MS ? undefined : `Enter at least ${MIN_RECONNECT_DELAY_MS}.`,
					},
				},
			]),
			group("New sessions", "Defaults for every new chat; each chat can change them from its toolbar.", [
				{
					name: "Default model",
					desc: "Model used when starting a new session.",
					control: { type: "dropdown", key: "defaultModel", options: MODEL_OPTIONS },
				},
				{
					name: "Default reasoning level",
					desc: "Reasoning effort for new sessions. A model that lacks a level uses the closest one it has (Haiku ignores it). Change it per-chat from the model menu.",
					control: {
						type: "dropdown",
						key: "defaultEffort",
						options: EFFORT_OPTIONS,
					},
				},
				{
					name: "Default mode",
					desc: "Permission mode applied to new sessions. Change it per-chat from the toolbar mode picker.",
					control: { type: "dropdown", key: "defaultPermissionMode", options: PERMISSION_MODE_OPTIONS },
				},
			]),
			group("Exports", "Where conversation exports are saved in your vault.", [
				{
					name: "Export folder",
					desc: "Vault folder conversation exports are written to.",
					control: { type: "text", key: "exportFolder", placeholder: "Claudius Conversations" },
				},
				{
					name: "Group exports by month",
					desc: "File exports into YYYY-MM subfolders under the export folder.",
					control: { type: "toggle", key: "exportGroupByMonth" },
				},
			]),
			group("Troubleshooting", "Diagnostic panels for tracking down mobile keyboard and connection problems.", [
				{
					name: "Keyboard debug panel",
					desc: "Show a 'Copy KB' button that copies an on-screen-keyboard layout report to the clipboard. For diagnosing mobile keyboard/layout issues. Reopen the chat view after changing.",
					control: { type: "toggle", key: "debugKeyboardPanel" },
				},
				{
					name: "Connection debug panel",
					desc: "Show a small on-screen widget that records connection events (foreground/reconnect/attach/server errors). Copy sends the log to the clipboard; Mark inserts a section marker. For diagnosing connection issues like 'No such session' on foregrounding.",
					control: { type: "toggle", key: "debugConnectionPanel" },
				},
			]),
		];
	}

	getControlValue(key: string): unknown {
		return (this.plugin.settings as unknown as Record<string, unknown>)[key];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.plugin.settings as unknown as Record<string, unknown>;
		settings[key] = typeof value === "string" && TRIMMED_KEYS.has(key) ? value.trim() : value;
		await this.plugin.saveSettings();
		if (key === "serverUrl" || key === "token") this.plugin.refreshConnections();
		if (key === "debugConnectionPanel") this.plugin.refreshConnDebugPanels();
	}

	/** Fallback renderer for Obsidian versions before 1.13 (see class doc). */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		for (const def of this.getSettingDefinitions()) {
			if (isRow(def)) this.renderRow(containerEl, def);
			else if ("heading" in def) this.renderGroup(containerEl, def);
		}
	}

	private renderGroup(containerEl: HTMLElement, def: SettingDefinitionGroup): void {
		const heading = new Setting(containerEl).setName(def.heading ?? "").setHeading();
		heading.settingEl.addClass("occ-settings-group-heading");
		for (const item of def.items ?? []) if (isRow(item)) this.renderRow(containerEl, item);
	}

	private renderRow(containerEl: HTMLElement, def: SettingDefinition): void {
		const setting = new Setting(containerEl).setName(def.name);
		if (typeof def.desc === "string") setting.setDesc(def.desc);
		if (def.control) this.renderControl(setting, def.control);
		else if (def.render) (def.render as (setting: Setting) => void)(setting);
	}

	private renderControl(setting: Setting, control: SettingControl): void {
		const key = control.key;
		const value = this.getControlValue(key);
		switch (control.type) {
			case "text":
				setting.addText((text) =>
					text
						.setPlaceholder(control.placeholder ?? "")
						.setValue(asText(value))
						.onChange((v) => void this.setControlValue(key, v))
				);
				break;
			case "dropdown":
				setting.addDropdown((dropdown) => {
					for (const [optionValue, label] of Object.entries(control.options))
						dropdown.addOption(optionValue, label);
					dropdown.setValue(asText(value)).onChange((v) => void this.setControlValue(key, v));
				});
				break;
			case "toggle":
				setting.addToggle((toggle) =>
					toggle.setValue(Boolean(value)).onChange((v) => void this.setControlValue(key, v))
				);
				break;
			case "number":
				setting.addText((text) =>
					text
						.setPlaceholder(control.placeholder ?? "")
						.setValue(asText(value))
						.onChange(async (raw) => {
							const n = parseInt(raw, 10);
							const valid = !Number.isNaN(n) && !(await control.validate?.(n));
							if (valid) await this.setControlValue(key, n);
							text.inputEl.toggleClass("occ-input-invalid", !valid);
						})
				);
				break;
			default:
				break; // control types this tab does not define
		}
	}
}
