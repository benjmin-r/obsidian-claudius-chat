/**
 * Server log output, one line per call: stdout for info, stderr for warnings
 * (journald picks both up under systemd). Callers pass ids and event types only,
 * never message content or the bearer token (AGENTS.md, Security & privacy).
 *
 * Written to the streams directly, not through `console`: this is a Node server,
 * and Obsidian's plugin lint flags `console` calls as noise in a plugin.
 */
export function logInfo(line: string): void {
	process.stdout.write(`${line}\n`);
}

export function logWarn(line: string): void {
	process.stderr.write(`${line}\n`);
}
