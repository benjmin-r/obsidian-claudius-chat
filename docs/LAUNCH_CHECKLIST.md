# Launch checklist

Plan: ship via BRAT now, submit to the official Obsidian community store later.

Priorities: `[MUST]` / `[HIGH]` / `[OPTIONAL]`. The compliance section was verified
against the current source; it states what is true today versus what still needs a fix.

## Official sources (fetched 2026-11-16; re-check before each submission)

The docs moved: the old `Plugins/Releasing/Submission+requirements` and
`Developer+policies` URLs now 404. Current canonical pages:

- Submission requirements: https://docs.obsidian.md/community-directory/submission-requirements-for-plugins
- Developer policies: https://docs.obsidian.md/community-directory/developer-policies
- Submit your plugin (repo layout, process): https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin
- Plugin guidelines (code/UI rules): https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Manifest reference (id/name/version rules): https://docs.obsidian.md/Reference/Manifest
- Release with GitHub Actions: https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions
- Community directory FAQ (automated review, Review branch): https://docs.obsidian.md/community-directory/faq
- Submit/manage at https://community.obsidian.md (GitHub account must be linked)
- Local linter: `eslint-plugin-obsidianmd` (the FAQ's recommended way to run the review checks locally)

Key facts from those pages:

- `manifest.json`, `README.md` and `LICENSE` must be in the repo **root**; the directory
  reads `manifest.json` at HEAD of the **default branch**.
- Release tag == manifest `version` (`x.y.z`, bare, no `v` shown in examples); assets
  `main.js`, `manifest.json`, optional `styles.css`. Release name is free-form.
- Automated review runs on every version: Manifest, Releases, Source code, Build
  verification (Error / Warning / Recommendation / Pass). The plugin cannot be installed
  until errors are resolved; fix by publishing a higher version.
- The scanner builds with the first of `build`, `build:plugin`, `compile` in package.json.
- The management page has **Review branch** (scan a branch/tag/SHA without publishing).
- README must disclose: network use, account/payment required, files outside the vault,
  ads, server-side telemetry (+ privacy policy link). Prohibited: obfuscation, ads,
  client-side telemetry, self-install/update.
- Updates need no resubmission: a new release is enough.

## Compliance status (verified against the code)

Already satisfying Obsidian guidelines — no action:

- Command id `open-claude-chat` has no plugin-id prefix (Obsidian adds it automatically).
- No global `app`; `onunload` does not detach leaves.
- No Node/Electron APIs in the plugin, so `isDesktopOnly: false` is honest and the
  mobile-safe claim holds.
- No `innerHTML`/`outerHTML`, no sample placeholders (`MyPlugin`/`SampleSettingTab`),
  no telemetry, no self-updater, no ads, no obfuscation.
- `manifest.name` ("Claude Chat") contains neither "Obsidian" nor "Plugin";
  `id` ("claude-chat") doesn't contain "obsidian". Description is 100 chars (<=250)
  and ends with a period.
- LICENSE present with clear MIT designation.

Two real code fixes needed before store submission — both **DONE**:

- `[MUST]` ✅ Hardcoded inline styles. All static `.style.display` / `.style.width` /
  `.style.borderColor` assignments in `chat-view.ts`, `file-suggest.ts`, and
  `settings.ts` now toggle CSS classes (`.occ-hidden`, `.occ-input-invalid`,
  `.occ-modal-input` in `styles.css`). The only remaining `.style.` writes are the
  runtime-computed keyboard-inset values in `setKeyboardInset()` (element height +
  two CSS custom properties derived from the live keyboard height) — these are
  layout values that cannot be a static class and must stay in JS. (A static
  `style.flex = "none"` there was flagged by the linter on 2026-11-16 and is now the
  `.occ-kb-open` class.)
- `[MUST]` ✅ Settings heading. The `createEl("h2", …)` in `settings.ts` was removed
  (Obsidian renders the plugin name as the tab title; a single-section tab needs no
  extra heading). The remaining `createEl("h3"/…)` calls are inside Modals, not the
  SettingTab, so the heading guideline doesn't apply to them.

## Pre-release check log (2026-11-16, branch `release/0.1.0`)

Automated checks, all run against a clean clone where noted:

- ✅ `npm ci` + `npm test` + `npm run build` from a clean clone: pass (348 tests).
- ✅ Coverage gates (`npm run test:coverage`): pass. Protocol branch coverage was
  86.8% against a 90% threshold and CI did not notice, because CI ran `npm test`
  (no coverage). Added tests; CI now runs `npm run test:coverage`.
- ✅ `npm run lint` (eslint-plugin-obsidianmd, the directory review's rules) is in the
  repo and in CI: 0 findings. `minAppVersion` 1.4.0 verified with it (lowest clean
  version; the true floor is 1.3.5, TDL-20261117-003).
- ✅ Version consistency: root, all packages, `manifest.json` and `versions.json`
  are all `0.1.0`; the release workflow also enforces tag == manifest version.
- ✅ `main.js` bundle: only `require("obsidian")`; no Node built-ins, `eval`,
  `innerHTML`, or source-map reference. Matches `isDesktopOnly: false`.
- ✅ Inline styles: the keyboard/safe-area debug panel still set ~15 `.style.*`
  properties (contradicting the compliance note above). Moved into
  `.occ-kb-debug-btn` / `.occ-safe-area-probe`. Only runtime-computed keyboard-inset
  values remain in JS.
- ✅ Secrets: no tokens/keys in tracked files or git history; no `data.json` or
  `.env` tracked. Hosts/IPs in tracked files are placeholders or test fixtures.
- ✅ `npm audit --omit=dev`: 0 vulnerabilities. The 7 dev-only findings
  (js-yaml, moment via `obsidian` typings) never ship in `main.js`.
- ⚠️ Not covered here: device smoke tests, mobile keyboard, README screenshot
  (see Phase 1 items below).

### Lint findings (2026-11-16) — resolved

Run with `eslint-plugin-obsidianmd@0.6.0` (recommended config) in a scratch dir; not
added to the repo. Errors: 0 after the fixes below. The authoritative check remains
**Review branch** on community.obsidian.md.

- ✅ Default hotkey `Mod+O` removed (`main.ts`); it collided with Quick switcher.
- ✅ Static `style.flex` replaced by `.occ-kb-open { flex: none !important }`.
- ✅ Command names no longer contain the plugin name ("Open chat", "Open chat in tab").
  Ids are unchanged.
- ✅ Type-aware errors fixed (`no-base-to-string`, redundant assertions, `any` from
  `JSON.parse`/`loadData`, `trimEnd` lib gap).
- ✅ The 19 warnings are fixed too (popout-window `activeDocument`/`window.setTimeout`,
  declarative settings definitions, TDL-20261117-001). Linter: 0 errors, 0 warnings.
  Still to check by hand: the settings tab in a real Obsidian 1.13+ and in an older one.

## Phase 1 — Ship via BRAT (now)

Remaining Phase-1 items need a real device/vault or a maintainer action — they can't
be done from a headless CI checkout:

- `[MUST]` ⏳ End-to-end smoke test from a clean vault and clean server, following the
  README verbatim. The install steps are the product surface for a self-hosted plugin.
- `[MUST]` ⏳ First-run / failure UX: server down, wrong token, Tailscale off, blank URL
  should each produce a clear message, not a dead sidebar. (Blank/malformed URL is now
  guarded in code — `BridgeClient.connect()` emits a clear error instead of throwing,
  with tests; the rest still needs a manual pass on a real device.)
- `[MUST]` ⏳ Real mobile test (iOS + Android) over the tailnet, since the plugin ships
  `isDesktopOnly: false`. (iPad on-screen keyboard and Android keyboard are still
  unverified with the final keyboard fix — see the handoff notes.)
- `[HIGH]` ⏳ Screenshot or GIF in the README (streaming sidebar + a permission prompt).
  Highest-leverage adoption item. (Needs a running instance to capture.)
- `[HIGH]` ✅ Replace `<owner>/obsidian-claude-chat` placeholders with the real GitHub
  path (`benjmin-r/obsidian-claude-chat`) so the BRAT instructions are copy-pasteable.
- `[HIGH]` ⏳ Cut the tag (`git tag 0.1.0 && git push origin 0.1.0`) and confirm the
  Release has all three assets and a BRAT install works. (Maintainer action — pushing a
  tag triggers the release workflow; not done autonomously.)
- `[OPTIONAL]` `CHANGELOG.md` — skip for 0.1.

## Phase 2 — Community store submission

Required by the Developer Policies / Submission requirements:

- `[MUST]` ✅ Network-use disclosure in the README. Added a labeled "Network use &
  requirements" section: the plugin connects only to the user's self-hosted server
  over their tailnet; no third-party/cloud service; no telemetry.
- `[MUST]` ✅ Self-hosted-server / account requirement disclosure. Same README section
  states plainly that full functionality requires a user-run server with an
  authenticated Claude subscription and Tailscale.
- `[MUST]` ✅ Apply the two code fixes above (inline styles, settings heading).
- `[MUST]` ✅ Confirm `manifest.description` is action-oriented, <=250 chars, ends with
  a period, no special characters. Rephrased to lead with the action ("Chat with
  Claude in a structured sidebar, …").
- `[MUST]` ✅ Do not add a `fundingUrl` unless donations are actually accepted. Still
  absent — fine.
- `[HIGH]` ✅ (Obsidian-optional, recommended) Added an "Unofficial" disclaimer in the
  README ("not affiliated with, endorsed by, or sponsored by Anthropic").
- `[HIGH]` ✅ Filled `authorUrl` (`https://github.com/benjmin-r`) and set `author` to
  the full name "Benjamin Reitzammer" (matches the LICENSE).

Submission process (from the docs):

1. `[MUST]` Repo public with `README.md`, `LICENSE`, `manifest.json`. Note: these live
   under `packages/plugin/` — the release assets are what matter, but verify the
   submission bot is happy with the monorepo layout (some checks look for a root
   manifest).
2. `[MUST]` GitHub Release tag must equal the manifest version, with `main.js` +
   `manifest.json` + `styles.css` attached. `release.yml` already enforces and does this.
3. `[MUST]` Sign in at community.obsidian.md, link the GitHub account, Plugins → New
   plugin, enter the repo URL, agree to the developer policies, Submit.
4. `[MUST]` Pass the automated validation bot; address feedback by updating the repo
   and publishing a new release with an incremented version.
5. `[OPTIONAL]` After acceptance, announce in the forum's Share & Showcase and the
   Discord `#updates` channel.

## Store blocker: manifest location — fixed, verify

`manifest.json` and `versions.json` now live at the repo root (TDL-20261116-001), as the
"Submit your plugin" page requires. Remaining check: confirm with **Review branch**
that build verification is happy with `main.js` being built into `packages/plugin/`.
