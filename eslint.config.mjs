// Obsidian's official linter (eslint-plugin-obsidianmd): the same checks the community
// directory's automated review runs. The review lints every package in the repo, not
// just the plugin, from a clean checkout (nothing built), so this does too. Run from the
// repo root so the manifest's minAppVersion is found (`npm run lint`).
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	globalIgnores(["**/node_modules", "**/dist", "**/coverage", "packages/plugin/main.js", "packages/*/tests", "packages/plugin/scripts"]),
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				// Each file uses its package's tsconfig.json.
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		// The Claudius server is a Node program; it is not part of the plugin bundle.
		// The review still reports these imports as warnings (accepted, see docs/LAUNCH_CHECKLIST.md).
		files: ["packages/server/**/*.ts"],
		rules: { "obsidianmd/no-nodejs-modules": "off" },
	},
]);
