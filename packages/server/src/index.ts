/**
 * Entry point: load config, build the SessionManager with the real SDK adapter,
 * and start the WebSocket transport bound to the Tailscale IP.
 */

import { setInterval } from "node:timers";
import { loadConfig } from "./config";
import {
	archiveStored,
	deleteStored,
	detectExternalActivity,
	listStored,
	loadHistory,
	renameStored,
	runQuery,
	sweepOrphanedAgentsFromProc,
} from "./sdk-adapter";
import { SessionManager } from "./session-manager";
import { startTransport } from "./ws-transport";
import { logInfo } from "./log";

function main(): void {
	const config = loadConfig();

	// Reclaim Agent-SDK subprocesses orphaned by a previous run of THIS server (a hard
	// crash skips node's exit-time teardown; KillMode=process leaves them behind). We have
	// no children yet. Ownership is the vault: children of sibling servers (other vaults)
	// or foreign SDK apps are left alone.
	const { swept, skipped } = sweepOrphanedAgentsFromProc(config.vaultCwd);
	if (swept.length > 0) {
		logInfo(`[occ] swept ${swept.length} orphaned agent subprocess(es) from a previous run: [${swept.join(",")}]`);
	}
	const unreadable = skipped.filter((s) => s.reason === "cwd-unreadable").map((s) => s.pid);
	if (unreadable.length > 0) {
		logInfo(`[occ] left ${unreadable.length} agent subprocess(es) alone, cwd unreadable: [${unreadable.join(",")}]`);
	}
	const otherVault = skipped.filter((s) => s.reason === "other-vault");
	if (otherVault.length > 0) {
		const list = otherVault.map((s) => `${s.pid}=${s.cwd}`).join(", ");
		logInfo(`[occ] left ${otherVault.length} agent subprocess(es) of other vaults alone: [${list}]`);
	}

	let counter = 0;
	const manager = new SessionManager(
		{
			runQuery,
			now: () => Date.now(),
			newHandleId: () => `new-${Date.now()}-${(counter += 1)}`,
			listStored,
			loadHistory,
			renameStored,
			deleteStored,
			archiveStored,
			detectExternalActivity,
		},
		{ cwd: config.vaultCwd, defaultModel: config.defaultModel, bufferLimit: config.bufferLimit, maxLiveSessions: config.maxLiveSessions }
	);

	const transport = startTransport(config, manager);

	// NOTE: CLI activity is checked on demand only — when a session is opened/reloaded
	// (resumeWithHistory) and before each send (sendGate). There is intentionally NO
	// periodic poll: read-only never clears or reloads on its own; the user reloads.

	// Release idle, detached sessions after 5 min so we stop being a writer the
	// user's own CLI would conflict with (and free the subprocess). A detached
	// session stuck awaiting a permission decision keeps its subprocess pinned, so
	// auto-deny abandoned prompts after 1 h (a real deny, not the phantom-reject a
	// bare drop would cause) and let the ensuing idle state reap it.
	const reaper = setInterval(() => manager.reapIdle(5 * 60_000, 60 * 60_000), 60_000);
	reaper.unref();

	// Recover turns wedged with zero events for too long (a hung SDK subprocess that
	// never completes a tool call and never errors on its own). 5 min, not 1 — a
	// single slow tool call (e.g. an API-backed CLI like readwise) can legitimately
	// run 60-90s+ with no intermediate events, and a 1-minute threshold was killing
	// those false-positive (see memory occ-bug-stuck-working-no-watchdog). Checked
	// twice as often as the threshold so detection lands close to the mark.
	const stallReaper = setInterval(() => manager.reapStalledTurns(5 * 60_000), 60_000);
	stallReaper.unref();

	logInfo(`[occ] listening on ws://${config.host}:${config.port} (cwd=${config.vaultCwd}, model=${config.defaultModel})`);

	const shutdown = (): void => {
		void transport.close().finally(() => process.exit(0));
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

main();
