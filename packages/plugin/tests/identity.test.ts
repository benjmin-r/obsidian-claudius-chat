import { readFileSync } from "fs";
import { join } from "path";
import ClaudiusChatPlugin from "../src/main";
import { VIEW_TYPE_CLAUDIUS_CHAT } from "../src/chat-view";

/**
 * Pins the identifiers that other things persist or key on (see TDL-20261117-002),
 * so a typo or an accidental rename fails CI instead of resetting users' settings.
 */
const repoRoot = join(__dirname, "..", "..", "..");
const manifest = JSON.parse(readFileSync(join(repoRoot, "manifest.json"), "utf8")) as Record<string, string>;
const versions = JSON.parse(readFileSync(join(repoRoot, "versions.json"), "utf8")) as Record<string, string>;

describe("plugin identity", () => {
	it("keeps the manifest id and name stable", () => {
		expect(manifest.id).toBe("claudius-chat");
		expect(manifest.name).toBe("Claudius Chat");
	});

	it("follows the directory rules for id and name", () => {
		expect(manifest.id).toMatch(/^[a-z-]+$/);
		expect(manifest.id).not.toMatch(/obsidian|plugin$/);
		expect(manifest.name).not.toMatch(/obsidian|plugin/i);
		expect(manifest.description).not.toMatch(/obsidian/i);
		expect(manifest.description.length).toBeLessThanOrEqual(250);
		expect(manifest.description.endsWith(".")).toBe(true);
	});

	it("keeps styles.css free of !important and anchored on the view type", () => {
		const css = readFileSync(join(repoRoot, "packages", "plugin", "styles.css"), "utf8");
		expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain("!important"); // the directory review warns on it
		expect(css).toContain(`.workspace-leaf-content[data-type="${VIEW_TYPE_CLAUDIUS_CHAT}"]`);
	});

	it("lists the manifest version in versions.json", () => {
		expect(versions[manifest.version]).toBe(manifest.minAppVersion);
	});

	it("keeps the view type stable (it is persisted in each device's saved workspace layout)", () => {
		expect(VIEW_TYPE_CLAUDIUS_CHAT).toBe("claudius-chat-view");
	});

	it("registers the link scheme and command ids that users' notes and hotkeys rely on", async () => {
		const plugin = new ClaudiusChatPlugin();
		await plugin.onload();
		const ids = (plugin.addCommand as jest.Mock).mock.calls.map(([cmd]) => (cmd as { id: string }).id);
		expect(ids).toEqual(expect.arrayContaining(["open-chat", "open-chat-tab", "toggle-transcript-detail"]));
		for (const id of ids) expect(id).not.toContain(manifest.id); // Obsidian prefixes the plugin id itself
		expect((plugin.registerObsidianProtocolHandler as jest.Mock).mock.calls.map(([action]) => action)).toContain(
			"occ-chat"
		);
	});
});
