# Security policy

## Reporting a vulnerability

Please report it privately, not in a public issue: open the repository's **Security** tab and select **Report a vulnerability** (GitHub private vulnerability reporting). Include the version, what you can do, and the smallest steps to reproduce it. Never include a real token.

This is a one-person hobby project, so replies are best effort. Only the latest release is supported.

## What counts

- Getting past the bearer token, or any way to reach the server without it.
- The server binding to a wildcard address, or accepting messages before `hello`.
- The token or message content appearing in logs, in the repository, or sent anywhere other than the server you configured.
- The plugin contacting any host other than the configured server.
- Writing files outside the vault or the export folder (path traversal in exports).
- A crafted protocol message that crashes the server or the plugin.

## Known design limits (not vulnerabilities)

- **The agent is Claude Code running as the server's user**, shell included, with your vault as its working directory. It is not sandboxed. Run the server as an unprivileged user and keep backups.
- **The confirmation prompt for destructive commands is a heuristic** (a short list of patterns), not a guarantee.
- **Anyone on your tailnet who has the token can drive the agent.** Treat the token like a password and restrict the host with Tailscale ACLs.
- **The token is stored in plain text** in the plugin's `data.json` inside your vault.
- **Traffic is plain `ws://`.** It is meant to stay inside Tailscale's encrypted tunnel; do not expose the port elsewhere.

Hardening advice is in [docs/SERVER.md](docs/SERVER.md#security).
