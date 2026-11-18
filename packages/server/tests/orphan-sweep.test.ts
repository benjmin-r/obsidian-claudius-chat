import { isAgentSubprocessCmdline, sweepOrphanedAgents, type SweepDeps } from "../src/orphan-sweep";

const SDK_CMD =
	"/home/u/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude --output-format stream-json --verbose " +
	"--input-format stream-json --model claude-opus-4-8 --permission-prompt-tool stdio --resume abc --permission-mode default";

describe("isAgentSubprocessCmdline", () => {
	it("matches an SDK-spawned streaming child", () => {
		expect(isAgentSubprocessCmdline(SDK_CMD)).toBe(true);
	});
	it("does NOT match an interactive CLI (no streaming-input flag)", () => {
		expect(isAgentSubprocessCmdline("/home/u/.local/bin/claude")).toBe(false);
		expect(isAgentSubprocessCmdline("/home/u/.local/bin/claude --resume abc")).toBe(false);
	});
	it("does NOT match unrelated processes", () => {
		expect(isAgentSubprocessCmdline("node /srv/app/index.js --input-format stream-json")).toBe(false); // not the SDK binary
		expect(isAgentSubprocessCmdline("/usr/bin/vim notes.md")).toBe(false);
	});
});

const VAULT = "/home/u/vaults/main";
const OTHER = "/home/u/vaults/fitness";

type Proc = { cmdline: string; ppid: number; cwd?: string | null };

/** Build sweep deps over in-memory process tables. `cwd` defaults to our vault; null = unreadable. */
function deps(
	over: {
		ownPid?: number;
		procs: Record<number, Proc>;
		killable?: (pid: number) => boolean;
	}
): { d: SweepDeps; killed: number[] } {
	const killed: number[] = [];
	const d: SweepDeps = {
		ownPid: over.ownPid ?? 1000,
		vaultCwd: VAULT,
		listPids: () => Object.keys(over.procs).map(Number),
		cmdline: (pid) => over.procs[pid]?.cmdline,
		parentOf: (pid) => over.procs[pid]?.ppid,
		cwdOf: (pid) => {
			const cwd = over.procs[pid]?.cwd;
			return cwd === null ? undefined : (cwd ?? VAULT);
		},
		kill: (pid) => {
			if (over.killable && !over.killable(pid)) return false;
			killed.push(pid);
			return true;
		},
	};
	return { d, killed };
}

describe("sweepOrphanedAgents", () => {
	it("sweeps an orphaned SDK child of our vault (reparented to init)", () => {
		const { d, killed } = deps({ procs: { 42: { cmdline: SDK_CMD, ppid: 1 } } });
		expect(sweepOrphanedAgents(d)).toEqual({ swept: [42], skipped: [] });
		expect(killed).toEqual([42]);
	});

	it("sweeps our orphan whatever it was reparented to (subreaper, not only pid 1)", () => {
		const { d, killed } = deps({
			procs: { 42: { cmdline: SDK_CMD, ppid: 2345 }, 2345: { cmdline: "systemd --user", ppid: 1 } },
		});
		expect(sweepOrphanedAgents(d).swept).toEqual([42]);
		expect(killed).toEqual([42]);
	});

	it("never sweeps our own live descendants", () => {
		// 55 is an SDK child whose parent chain leads to ownPid (1000) → a live session.
		const { d, killed } = deps({
			ownPid: 1000,
			procs: {
				55: { cmdline: SDK_CMD, ppid: 1000 },
				56: { cmdline: SDK_CMD, ppid: 55 }, // grandchild, still ours
			},
		});
		expect(sweepOrphanedAgents(d)).toEqual({ swept: [], skipped: [] });
		expect(killed).toEqual([]);
	});

	it("does not sweep a sibling server's live child (another vault)", () => {
		// 2000 is a second server serving another vault; 2001 is its in-flight turn.
		const { d, killed } = deps({
			procs: {
				2000: { cmdline: "node /srv/occ/dist/index.js", ppid: 1, cwd: OTHER },
				2001: { cmdline: SDK_CMD, ppid: 2000, cwd: OTHER },
			},
		});
		expect(sweepOrphanedAgents(d)).toEqual({ swept: [], skipped: [{ pid: 2001, reason: "other-vault", cwd: OTHER }] });
		expect(killed).toEqual([]);
	});

	it("does not sweep a foreign Agent-SDK app whose parent died", () => {
		const { d, killed } = deps({ procs: { 77: { cmdline: SDK_CMD, ppid: 1, cwd: "/home/u/projects/other-app" } } });
		expect(sweepOrphanedAgents(d).swept).toEqual([]);
		expect(killed).toEqual([]);
	});

	it("skips, and reports, a match whose cwd cannot be read", () => {
		const { d, killed } = deps({ procs: { 42: { cmdline: SDK_CMD, ppid: 1, cwd: null } } });
		expect(sweepOrphanedAgents(d)).toEqual({ swept: [], skipped: [{ pid: 42, reason: "cwd-unreadable" }] });
		expect(killed).toEqual([]);
	});

	it("skips non-SDK processes and our own pid", () => {
		const { d, killed } = deps({
			ownPid: 1000,
			procs: {
				1000: { cmdline: "node index.js", ppid: 1 }, // us
				7: { cmdline: "/usr/bin/vim", ppid: 1 }, // unrelated
				8: { cmdline: "/home/u/.local/bin/claude --resume x", ppid: 1 }, // interactive CLI
			},
		});
		expect(sweepOrphanedAgents(d)).toEqual({ swept: [], skipped: [] });
		expect(killed).toEqual([]);
	});

	it("counts only pids the kill actually reached (race: process already gone)", () => {
		const { d, killed } = deps({
			procs: { 42: { cmdline: SDK_CMD, ppid: 1 }, 43: { cmdline: SDK_CMD, ppid: 1 } },
			killable: (pid) => pid !== 43, // 43 vanished between listing and kill
		});
		expect(sweepOrphanedAgents(d).swept).toEqual([42]);
		expect(killed).toEqual([42]);
	});
});
