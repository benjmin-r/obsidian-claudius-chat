import { App, type SettingDefinition } from "obsidian";
import { ClaudiusChatSettingTab } from "../src/settings";
import { DEFAULT_SETTINGS, effortFromSetting, type ClaudiusChatSettings } from "../src/settings-types";

function fakePlugin(settings: ClaudiusChatSettings = { ...DEFAULT_SETTINGS }) {
	return {
		app: new App(),
		settings,
		saveSettings: jest.fn().mockResolvedValue(undefined),
		refreshConnections: jest.fn(),
		refreshConnDebugPanels: jest.fn(),
	};
}

describe("DEFAULT_SETTINGS", () => {
	it("ships a tailnet ws url and empty token", () => {
		expect(DEFAULT_SETTINGS.serverUrl.startsWith("ws://")).toBe(true);
		expect(DEFAULT_SETTINGS.token).toBe("");
		expect(DEFAULT_SETTINGS.autoReconnect).toBe(true);
	});
});

describe("effortFromSetting", () => {
	it("maps real levels through and everything else to the model default", () => {
		expect(effortFromSetting("xhigh")).toBe("xhigh");
		expect(effortFromSetting("default")).toBeUndefined();
		expect(effortFromSetting(undefined)).toBeUndefined();
		expect(effortFromSetting("bogus")).toBeUndefined();
	});

	it("defaults to the model's own level", () => {
		expect(DEFAULT_SETTINGS.defaultEffort).toBe("default");
	});
});

describe("ClaudiusChatSettingTab", () => {
	it("renders all fields including a password-masked token", () => {
		const plugin = fakePlugin();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const tab = new ClaudiusChatSettingTab(plugin.app, plugin as any);
		tab.display();
		const inputs = tab.containerEl.querySelectorAll("input");
		const selects = tab.containerEl.querySelectorAll("select");
		expect(inputs.length).toBeGreaterThanOrEqual(3);
		expect(selects.length).toBe(3); // model + default-reasoning + default-mode dropdowns
		expect(tab.containerEl.querySelector('input[type="password"]')).not.toBeNull();
	});

	it("persists edits via saveSettings", async () => {
		const plugin = fakePlugin();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const tab = new ClaudiusChatSettingTab(plugin.app, plugin as any);
		tab.display();
		const urlInput = tab.containerEl.querySelector("input") as HTMLInputElement;
		urlInput.value = "ws://other:9000";
		urlInput.dispatchEvent(new Event("input"));
		await Promise.resolve();
		expect(plugin.settings.serverUrl).toBe("ws://other:9000");
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it("re-points open views when the server URL or token changes", async () => {
		const plugin = fakePlugin();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const tab = new ClaudiusChatSettingTab(plugin.app, plugin as any);
		tab.display();
		const urlInput = tab.containerEl.querySelector("input") as HTMLInputElement;
		urlInput.value = "ws://other:9000";
		urlInput.dispatchEvent(new Event("input"));
		await Promise.resolve();
		expect(plugin.refreshConnections).toHaveBeenCalledTimes(1);
		const tokenInput = tab.containerEl.querySelector('input[type="password"]') as HTMLInputElement;
		tokenInput.value = "new-token";
		tokenInput.dispatchEvent(new Event("input"));
		await Promise.resolve();
		expect(plugin.settings.token).toBe("new-token");
		expect(plugin.refreshConnections).toHaveBeenCalledTimes(2);
	});
});

describe("ClaudiusChatSettingTab definitions (Obsidian 1.13+)", () => {
	function makeTab(settings?: ClaudiusChatSettings) {
		const plugin = fakePlugin(settings);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const tab = new ClaudiusChatSettingTab(plugin.app, plugin as any);
		return { plugin, tab };
	}

	/** Every row (control or render) across all groups, in order. */
	function rows(tab: ClaudiusChatSettingTab): SettingDefinition[] {
		return tab.getSettingDefinitions().flatMap((d) => ("items" in d ? (d.items ?? []) : [d])) as SettingDefinition[];
	}

	function controlKeys(tab: ClaudiusChatSettingTab): string[] {
		return rows(tab).flatMap((d) => ("control" in d && d.control ? [d.control.key] : []));
	}

	it("defines every user-facing setting once, all backed by a stored field", () => {
		const { tab } = makeTab();
		const keys = [...controlKeys(tab), "token"]; // the token row is a render callback
		expect(new Set(keys).size).toBe(keys.length);
		expect(keys.sort()).toEqual(
			[
				"autoReconnect",
				"debugConnectionPanel",
				"debugKeyboardPanel",
				"defaultEffort",
				"defaultModel",
				"defaultPermissionMode",
				"exportFolder",
				"exportGroupByMonth",
				"reconnectDelayMs",
				"serverUrl",
				"token",
			].sort()
		);
		for (const key of keys) expect(DEFAULT_SETTINGS).toHaveProperty(key);
	});

	it("reads current values and writes them back through setControlValue", async () => {
		const { plugin, tab } = makeTab();
		expect(tab.getControlValue("autoReconnect")).toBe(true);
		await tab.setControlValue("autoReconnect", false);
		expect(plugin.settings.autoReconnect).toBe(false);
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		expect(plugin.refreshConnections).not.toHaveBeenCalled();
	});

	it("trims the URL and export folder, and re-points connections on URL or token changes", async () => {
		const { plugin, tab } = makeTab();
		await tab.setControlValue("serverUrl", "  ws://h:1  ");
		await tab.setControlValue("exportFolder", " Notes ");
		await tab.setControlValue("token", " keep spaces ");
		expect(plugin.settings.serverUrl).toBe("ws://h:1");
		expect(plugin.settings.exportFolder).toBe("Notes");
		expect(plugin.settings.token).toBe(" keep spaces ");
		expect(plugin.refreshConnections).toHaveBeenCalledTimes(2); // url + token, not the folder
	});

	it("refreshes the debug panels when the connection debug panel is toggled", async () => {
		const { plugin, tab } = makeTab();
		await tab.setControlValue("debugConnectionPanel", true);
		expect(plugin.refreshConnDebugPanels).toHaveBeenCalledTimes(1);
	});

	it("rejects a reconnect delay below the minimum", () => {
		const { tab } = makeTab();
		const row = rows(tab).find((d) => "control" in d && d.control?.key === "reconnectDelayMs");
		const control = row && "control" in row ? row.control : undefined;
		if (!control || control.type !== "number") throw new Error("reconnectDelayMs should be a number control");
		expect(control.validate?.(99)).toMatch(/at least 100/);
		expect(control.validate?.(100)).toBeUndefined();
	});
});

describe("ClaudiusChatSettingTab legacy display() (Obsidian before 1.13)", () => {
	function render(settings?: ClaudiusChatSettings) {
		const plugin = fakePlugin(settings);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const tab = new ClaudiusChatSettingTab(plugin.app, plugin as any);
		tab.display();
		return { plugin, tab };
	}

	it("draws each group as a heading followed by its rows", () => {
		const { tab } = render();
		const drawn = Array.from(tab.containerEl.children).map((row) => ({
			heading: row.classList.contains("setting-item-heading"),
			name: row.firstElementChild?.textContent,
		}));
		const expected = tab.getSettingDefinitions().flatMap((d) => {
			if (!("items" in d)) return [];
			return [
				{ heading: true, name: d.heading },
				...(d.items ?? []).map((item) => ({ heading: false, name: "name" in item ? item.name : undefined })),
			];
		});
		expect(drawn).toEqual(expected);
	});

	it("styles the group headings as dividers and the intro sentences as muted text", () => {
		const { tab } = render();
		expect(tab.containerEl.querySelectorAll(".occ-settings-group-heading").length).toBe(4);
		expect(tab.containerEl.querySelectorAll(".occ-settings-group-intro").length).toBe(4);
	});

	it("keeps an out-of-range reconnect delay unsaved and flags the input", async () => {
		const { plugin, tab } = render();
		const input = tab.containerEl.querySelector('input[placeholder="1500"]') as HTMLInputElement;
		input.value = "50";
		input.dispatchEvent(new Event("input"));
		await new Promise((r) => setTimeout(r, 0));
		expect(plugin.settings.reconnectDelayMs).toBe(DEFAULT_SETTINGS.reconnectDelayMs);
		expect(input.classList.contains("occ-input-invalid")).toBe(true);
		input.value = "2500";
		input.dispatchEvent(new Event("input"));
		await new Promise((r) => setTimeout(r, 0));
		expect(plugin.settings.reconnectDelayMs).toBe(2500);
		expect(input.classList.contains("occ-input-invalid")).toBe(false);
	});

	it("persists a dropdown change", async () => {
		const { plugin, tab } = render();
		const select = tab.containerEl.querySelectorAll("select")[0] as HTMLSelectElement;
		const other = Array.from(select.options).find((o) => o.value !== select.value)!;
		select.value = other.value;
		select.dispatchEvent(new Event("change"));
		await Promise.resolve();
		expect(plugin.settings.defaultModel).toBe(other.value);
	});
});

describe("ClaudiusChatSettingTab grouping", () => {
	function groups() {
		const plugin = fakePlugin();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const tab = new ClaudiusChatSettingTab(plugin.app, plugin as any);
		return tab.getSettingDefinitions().flatMap((d) => ("items" in d ? [d] : []));
	}

	it("has the four sections, in order, with a heading each", () => {
		expect(groups().map((g) => g.heading)).toEqual(["Connection", "New sessions", "Exports", "Troubleshooting"]);
	});

	it("keeps headings sentence case and free of the word 'settings'", () => {
		for (const g of groups()) {
			expect(g.heading).not.toMatch(/settings/i);
			expect(g.heading).toBe((g.heading ?? "").charAt(0).toUpperCase() + (g.heading ?? "").slice(1).toLowerCase());
		}
	});

	it("opens every group with a one-sentence explanation that is not searchable", () => {
		for (const g of groups()) {
			const intro = (g.items ?? [])[0];
			expect(intro && "name" in intro ? intro.name : "").toMatch(/^[A-Z][^.]*\.$/); // exactly one sentence
			expect(intro && "searchable" in intro ? intro.searchable : undefined).toBe(false);
		}
	});

	it("puts each setting in exactly one group", () => {
		const keys = groups().flatMap((g) => (g.items ?? []).flatMap((i) => ("control" in i && i.control ? [i.control.key] : [])));
		expect(new Set(keys).size).toBe(keys.length);
		expect(keys).toHaveLength(10); // the token row is a render callback
	});
});
