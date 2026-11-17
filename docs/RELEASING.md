# Releasing the plugin

Maintainer notes. A release is a GitHub Release whose tag equals the plugin version and which carries `main.js`, `manifest.json` and `styles.css`. That is the format both BRAT and the Obsidian community directory read.

## Cut a release

1. Bump `version` in `manifest.json` (repo root) and add the matching entry to `versions.json` (`"<version>": "<minAppVersion>"`). Keep the package versions in step: the root and the three packages, plus the exact `@occ/protocol` pins in `packages/plugin` and `packages/server` and their entries in `package-lock.json`. `npm version --workspaces` does not update the pins and fails on them; edit the versions by hand and check with `npm ci` and `npm ls @occ/protocol`.
2. Update `TECHNICAL_DECISIONS.md` if the release carries a notable decision.
3. Run `npm run lint`, `npm run build` and `npm run test:coverage`, then the review-parity lint described in [`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md) (the directory review runs an older linter than the repo's).
4. Merge to `main`. The directory reads `manifest.json` at the head of the default branch.
5. Tag and push (the tag **must equal** the manifest version, with no `v` prefix):

   ```bash
   git tag 0.1.0
   git push origin 0.1.0
   ```

`.github/workflows/release.yml` builds the plugin, checks that the tag equals the manifest version, and creates the release with the three assets. `.github/workflows/ci.yml` runs the lint, the tests (with coverage thresholds) and the build on every push and pull request.

## Community directory

Pre-submission checks and the current open items are in [`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md), which cites the official Obsidian requirements. Updates after the first submission need no resubmission: publish a new release with a higher version. Failed automated reviews are fixed the same way.
