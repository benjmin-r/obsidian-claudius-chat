# Contributing

Thanks for looking under the hood. This repo is an npm-workspaces monorepo:

```
packages/
  protocol/   pure shared wire types, SDK-to-event mapping, the "destructive command" predicate
  server/     the Agent SDK service (session actors, WebSocket transport)
  plugin/     the Obsidian plugin (chat view, bridge client, settings)
```

`plugin` and `server` both import their wire types from `protocol`, so there is one source of truth for the protocol and no client/server drift.

**Read [`AGENTS.md`](AGENTS.md) first** (it is for humans and AI agents alike). It has the architecture invariants and the "anatomy of a feature" checklist that explains why a feature usually touches protocol, server and plugin in turn. [`TECHNICAL_DECISIONS.md`](TECHNICAL_DECISIONS.md) records why things are the way they are, including verified Agent SDK behaviour; check it before changing something non-obvious.

## Build and test

```bash
npm install
npm run build            # protocol, then server, then plugin (order matters)
npm test                 # all three packages (Jest)
npm run lint             # Obsidian's official linter on the plugin source; CI runs this
npm run test:coverage    # enforces the per-package coverage thresholds; CI runs this
```

- Pure logic (protocol mappers, the view-model reducer, the session core) is unit-tested with injected fakes. Thin I/O shells (`sdk-adapter.ts`, `ws-transport.ts`, `index.ts`, `chat-view.ts`, `main.ts`) are excluded from coverage and checked by running the real thing.
- Match the surrounding style (Prettier config in `.prettierrc`).
- Do not push or release without the maintainer's go-ahead; see [`docs/RELEASING.md`](docs/RELEASING.md).

## Trying a plugin change

Build, then copy `packages/plugin/main.js`, `packages/plugin/styles.css` and `manifest.json` into `<vault>/.obsidian/plugins/claudius-chat/` and reload the plugin. Never copy `data.json` between vaults: it holds the bearer token.

## Reporting problems

Open an issue at <https://github.com/benjmin-r/obsidian-claudius-chat/issues>. Please include the plugin version, your host OS and Node version, and what the connection icon shows. Never paste your token.
