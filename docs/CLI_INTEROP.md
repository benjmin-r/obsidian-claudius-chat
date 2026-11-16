# Using sessions from the Claude Code CLI as well

> Part of [Claudius Chat for Obsidian](../README.md). Read this if you also use the `claude` CLI in the same vault.

The server runs with `cwd` = the canonical vault path, so its sessions are stored in
the **same place** the `claude` CLI uses (`~/.claude/projects/<vault>/`). A session can
therefore move between the Obsidian plugin and a terminal — but only **one** of them may
*write* at a time, or the on-disk transcript forks. Rather than try to merge, the plugin
enforces this with a **read-only** model.

## Resuming across plugin and CLI

- `claude --resume <id>` in the vault continues a plugin session, and vice-versa.
- The CLI's interactive `/resume` *picker* only lists CLI-started sessions (it filters by
  `entrypoint`), so plugin-created sessions are resumable by id but won't show there — use
  the picker's kebab → **Copy shell resume command** to grab `claude --resume <id>`.

## Read-only when a CLI holds the session

- If a session you have open is also open in a terminal, the plugin goes **fully
  read-only** (composer + Send disabled, 🔒 banner). There is **no override** — this is
  deliberate, so a fork is impossible.
- Detection is **on demand, never polled**: the plugin checks for CLI activity only when
  you *open/reload* a session and when you *try to send* (the server refuses the send if a
  CLI is live). It never auto-clears or auto-reloads.
- To regain control: close the terminal session, then press **Reload** in the banner.
  Reload re-reads the transcript from disk and re-checks for a CLI; if none is active, the
  session becomes writable again. (Picking any session from the list always reloads from
  disk, too.)

## Clean hand-off to the terminal

- **Copy shell resume command** also *closes* the session in the plugin (returns to the
  empty state) and releases the server's hold on it, so the terminal gets a clean,
  sole-owner session.
- A session left idle with no plugin view attached is released after ~5 minutes, so the
  server stops being a writer your terminal would conflict with.

## Among plugin clients

Between plugin clients (the sidebar, extra tabs and other devices) a single-writer rule
also applies: extra views attach in a mirrored, read-only mode (an *eye* badge) and the server
refuses a second writer until the first releases it.

## How CLI activity is detected

The server reads Claude Code's live-process registry
(`~/.claude/sessions/*.json`), scoped to this vault's working dir and ignoring its own
query subprocesses (a `/proc` ancestry check). It is best-effort — if that registry is
absent or unreadable, no lock is applied.
