/**
 * Startup orphan sweep — kill Agent-SDK subprocesses left behind by a previous
 * run of THIS server.
 *
 * The systemd unit uses `KillMode=process`, so on a CLEAN stop node's own
 * `process.on("exit")` hook SIGTERMs the SDK children — but a HARD crash (SIGKILL,
 * OOM) skips that hook and orphans them. They pin ~165 MB each until the box is
 * rebooted (see the RAM-exhaustion incident). This sweep, run ONCE at startup
 * before any session spawns, reclaims them.
 *
 * Ownership is decided by the vault: every SDK child is spawned with this server's
 * vault as its working directory, and one server serves one vault. A match whose cwd
 * is another vault belongs to a sibling server on the same host (or a foreign
 * Agent-SDK app) and is left alone, as is any match whose cwd cannot be read.
 *
 * Pure over injected deps (no `fs`/`process` here) so the selection + safety logic
 * is unit-tested; `sdk-adapter.ts` supplies the real `/proc` + `process.kill`.
 */

import { isDescendant } from "./external-activity";

/**
 * True for an SDK-spawned streaming CLI child. Matches the vendored binary path
 * plus the streaming-input flag the SDK always passes — which an interactive
 * `claude` in a terminal does NOT — so we never sweep a user's own CLI session.
 */
export function isAgentSubprocessCmdline(cmdline: string): boolean {
	return cmdline.includes("claude-agent-sdk") && cmdline.includes("--input-format stream-json");
}

export interface SweepDeps {
	/** this server's pid — never swept, and its live descendants are skipped. */
	ownPid: number;
	/** this server's vault, resolved the way the kernel reports a cwd (symlinks followed). */
	vaultCwd: string;
	/** candidate pids to inspect (e.g. numeric entries under /proc). */
	listPids(): number[];
	/** a pid's full command line (argv joined by spaces), or undefined if gone/unreadable. */
	cmdline(pid: number): string | undefined;
	/** a pid's parent pid, or undefined if unavailable. */
	parentOf(pid: number): number | undefined;
	/** a pid's working directory, or undefined if gone/unreadable. */
	cwdOf(pid: number): string | undefined;
	/** signal the pid; return true if the signal was delivered. */
	kill(pid: number): boolean;
}

/** Why a matching process was left alone. */
export type SkipReason = "other-vault" | "cwd-unreadable";

export interface SweepResult {
	/** pids a signal was delivered to. */
	swept: number[];
	/** matches that were not ours to kill (our own live children are not listed). */
	skipped: { pid: number; reason: SkipReason; /** the cwd that was read, when readable. */ cwd?: string }[];
}

/**
 * Select and signal orphaned Agent-SDK subprocesses of this server's vault. Skips our
 * own pid and our own live descendants (so it's safe even if ever called after
 * sessions start, though it is meant for startup when we have no children yet), and
 * anything not provably in our vault.
 */
export function sweepOrphanedAgents(deps: SweepDeps): SweepResult {
	const result: SweepResult = { swept: [], skipped: [] };
	for (const pid of deps.listPids()) {
		if (pid === deps.ownPid) continue;
		const cmdline = deps.cmdline(pid);
		if (!cmdline || !isAgentSubprocessCmdline(cmdline)) continue;
		if (isDescendant(pid, deps.ownPid, (p) => deps.parentOf(p))) continue; // our own live child — never kill
		const cwd = deps.cwdOf(pid);
		if (cwd === undefined) {
			result.skipped.push({ pid, reason: "cwd-unreadable" });
			continue;
		}
		if (cwd !== deps.vaultCwd) {
			result.skipped.push({ pid, reason: "other-vault", cwd });
			continue;
		}
		if (deps.kill(pid)) result.swept.push(pid);
	}
	return result;
}
