// Obsidian's official linter (eslint-plugin-obsidianmd): the same checks the community
// directory's automated review runs. Lints the plugin source only; the server and
// protocol packages are plain Node code. Run from the repo root so the manifest's
// minAppVersion is found (`npm run lint`).
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	globalIgnores(["**/node_modules", "**/dist", "**/coverage", "packages/plugin/main.js", "packages/plugin/tests", "packages/plugin/scripts"]),
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				project: "./packages/plugin/tsconfig.json",
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
]);
