# Releasing the plugin

Maintainer notes. A release is a GitHub Release whose tag equals the plugin version and which carries `main.js`, `manifest.json` and `styles.css`. That is the format both BRAT and the Obsidian community directory read.

## Cut a release

1. Bump `version` in `manifest.json` (repo root) and add the matching entry to `versions.json` (`"<version>": "<minAppVersion>"`). Keep the package versions in step.
2. Update `TECHNICAL_DECISIONS.md` if the release carries a notable decision.
3. Run `npm run build` and `npm run test:coverage`.
4. Merge to `main`. The directory reads `manifest.json` at the head of the default branch.
5. Tag and push (the tag **must equal** the manifest version, with no `v` prefix):

   ```bash
   git tag 0.1.0
   git push origin 0.1.0
   ```

`.github/workflows/release.yml` builds the plugin, checks that the tag equals the manifest version, and creates the release with the three assets. `.github/workflows/ci.yml` runs the tests (with coverage thresholds) and the build on every push and pull request.

## Community directory

Pre-submission checks and the current open items are in [`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md), which cites the official Obsidian requirements. Updates after the first submission need no resubmission: publish a new release with a higher version. Failed automated reviews are fixed the same way.
