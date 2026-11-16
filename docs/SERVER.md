# Running the Claudius Chat server

> Part of [Claudius Chat for Obsidian](../README.md). The README has the quick start; this page is the full reference for the server you run on your always-on host.

The server owns the Claude sessions. The plugin is only a view onto it. It runs the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) with your vault as its working directory, and it listens on your Tailscale address only.

## Host requirements

- **Linux** is what this is developed and tested on (Debian, systemd). **macOS** should work, but it is **untested**. The two Linux-only parts (orphan cleanup and CLI-conflict detection read `/proc`) simply do nothing where `/proc` is missing. Windows is not supported.
- **Node.js 20 or newer.**
- **Claude Code installed and signed in** for the user the server runs as. Check with `claude` in a terminal as that user. The server reads that user's `~/.claude`.
- **Tailscale** up on the host.
- **A copy of your vault** on the host (the server's `OCC_VAULT_CWD`), kept in sync with your devices by whatever you already use (Obsidian Sync, Syncthing, git, ...). *This project does not sync files*. The agent edits the host's copy and your sync carries the changes to your other devices.

## Install and build

```bash
git clone https://github.com/benjmin-r/obsidian-claudius-chat.git ~/projects/obsidian-claudius-chat
cd ~/projects/obsidian-claudius-chat
npm install
npm run build -w @occ/protocol && npm run build -w @occ/server
```

## Configure

```bash
cp packages/server/occ-server.env.example ~/.config/occ-server.env
chmod 600 ~/.config/occ-server.env
```

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `OCC_TOKEN` | yes | | Bearer token clients must present. Generate with `openssl rand -hex 32`. Treat it like a password. |
| `OCC_HOST` | yes | | The host's Tailscale IP (`tailscale ip -4`). The server refuses `0.0.0.0` and `::`. |
| `OCC_VAULT_CWD` | no | `/home/USER/vaults/VAULT` | Absolute path of the vault copy. **Set this**; the default is a placeholder. |
| `OCC_PORT` | no | `8765` | Port to listen on. |
| `OCC_MODEL` | no | `claude-sonnet-5-5` | Model for new sessions when the plugin doesn't pick one. |
| `OCC_MAX_LIVE_SESSIONS` | no | `6` | Max concurrent live sessions. Each is a separate `claude` subprocess of roughly 165 MB. |
| `OCC_BUFFER_LIMIT` | no | `2000` | Events kept per session for replay after a reconnect. |

Do **not** set `ANTHROPIC_API_KEY`. If it is present the SDK bills that key instead of using your subscription login.

## Try it in the foreground

```bash
node --env-file="$HOME/.config/occ-server.env" packages/server/dist/index.js
```

You should see `[occ] listening on ws://<tailscale-ip>:8765 (cwd=..., model=...)`. Stop it with Ctrl+C. (`--env-file` needs Node 20.6 or newer.)

## Run it permanently (systemd)

```bash
sudo cp packages/server/occ-server.service /etc/systemd/system/
```

Edit the copy and replace `USER` and `VAULT` in `User=`, `WorkingDirectory=`, `HOME`, `PATH`, `EnvironmentFile=` and `ExecStart=`. `HOME` must be the account whose `~/.claude` holds your Claude login.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now occ-server.service
journalctl -u occ-server -f      # look for: [occ] listening on ws://<tailscale-ip>:8765
```

The unit uses `Restart=always`. A restart loses any turn that is mid-flight; the conversation itself is restored when a client next attaches.

On macOS there is no launchd unit. Run the foreground command under whatever you use to keep a process alive (launchd, pm2, tmux).

## Several vaults

One server process serves one vault. For a second vault, copy the env file and the unit with a different name, port and `OCC_VAULT_CWD`, and give each its own token. In the plugin of each vault, point **Server URL** at that vault's port.

**Caution (Linux):** on start-up a server kills any Claude Agent SDK subprocess on the machine that is not its own child (it assumes they are orphans from a crash). If you run several servers on one host, starting or restarting one will end the in-flight turns of the others. Restart them when the others are idle.

## Security

- **Tailnet only.** The server refuses to bind to `0.0.0.0`/`::`. Traffic stays inside Tailscale's WireGuard tunnel, so plain `ws://` is fine.
- **Token on every connection.** A bad token gets an error and the socket is closed. Anyone on your tailnet who has the token can drive the agent, so restrict the host with Tailscale ACLs (tag the host if you use tag-based ACLs).
- **The agent runs as the server's user.** It has Claude Code's tools, including a shell, with the vault as working directory. It is not sandboxed to the vault. Run the server as an unprivileged user that can write only to the vault copy if you can, and keep backups or version history of the vault.
- The server never logs message content or the token.

## Behaviour worth knowing

- **Phone sleeps or network drops:** the session keeps running on the server. The plugin reconnects when the app returns to the foreground, then replays the buffered transcript and continues live.
- **Server restart:** the in-flight turn is lost, but the conversation is resumed from disk on the next attach.
- **Idle sessions** with no plugin view attached are released after about 5 minutes.
- **Session list is capped at 50.** The session picker and **Export to Markdown** both use a store query that returns only the 50 most recently modified sessions. A session outside that window won't appear in the picker, and exporting it another way (for example from a saved link) produces a file without its model, `created` and `updated` frontmatter.
- **Using the `claude` CLI in the same vault:** see [CLI_INTEROP.md](CLI_INTEROP.md).

## Updating

```bash
cd ~/projects/obsidian-claudius-chat
git pull
npm install
npm run build -w @occ/protocol && npm run build -w @occ/server
sudo systemctl restart occ-server.service
```

Update the plugin through BRAT (or the community store) as usual. Plugin and server share one protocol, so update both together.
