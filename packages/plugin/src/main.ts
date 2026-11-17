import { Notice, Plugin } from "obsidian";
import { ChatView, VIEW_TYPE_CLAUDIUS_CHAT } from "./chat-view";
import { ConversationSuggest, insertConversationLink } from "./link-insert";
import { ClaudiusChatSettingTab } from "./settings";
import { DEFAULT_SETTINGS, type ClaudiusChatSettings } from "./settings-types";

/** Quiet period after the last keystroke in the URL/token fields before reconnecting. */
const CONNECTION_SETTINGS_DEBOUNCE_MS = 800;

export default class ClaudiusChatPlugin extends Plugin {
	settings!: ClaudiusChatSettings;
	private refreshConnectionsTimer: number | undefined;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_CLAUDIUS_CHAT, (leaf) => new ChatView(leaf, this));

		this.addRibbonIcon("message-square", "Open Claudius chat", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-chat",
			name: "Open chat",
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "open-chat-tab",
			name: "Open chat in tab",
			callback: () => void this.openInTab(),
		});

		// Expand/collapse all tool-call and thinking activity in the transcript — mirrors
		// the ctrl-o transcript toggle in the Claude Code TUI.
		this.addCommand({
			id: "toggle-transcript-detail",
			name: "Toggle tool call / thinking detail (expand or collapse all)",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(ChatView);
				if (!view) return false;
				if (!checking) view.toggleTranscriptExpanded();
				return true;
			},
		});

		// Link to conversations from notes: `[title](obsidian://occ-chat?session=<id>)`.
		this.addCommand({
			id: "insert-conversation-link",
			name: "Insert link to a Claude conversation",
			editorCallback: (editor) => void insertConversationLink(this, editor),
		});
		// Inline `/occ` autocomplete in the editor inserts the same link.
		this.registerEditorSuggest(new ConversationSuggest(this));
		// Route occ-chat:// links (from notes) to the chat view, opening the session
		// (and deep-linking to a specific message when `msg` is present).
		this.registerObsidianProtocolHandler("occ-chat", (params) => void this.openSessionFromLink(params.session, params.msg));

		this.addSettingTab(new ClaudiusChatSettingTab(this.app, this));
	}

	/** Open the chat view, switch it to `sessionId`, and (optionally) scroll to `messageId`. */
	async openSessionFromLink(sessionId?: string, messageId?: string): Promise<void> {
		if (!sessionId) {
			new Notice("Claudius Chat: link is missing a session id.");
			return;
		}
		await this.activateView();
		const view = this.app.workspace
			.getLeavesOfType(VIEW_TYPE_CLAUDIUS_CHAT)
			.map((leaf) => leaf.view)
			.find((v): v is ChatView => v instanceof ChatView);
		if (view) view.openSession(sessionId, messageId);
		else new Notice("Claudius Chat: couldn't open the chat view.");
	}

	onunload(): void {
		window.clearTimeout(this.refreshConnectionsTimer);
		// Obsidian detaches the leaves; the view's onClose disconnects the socket.
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<ClaudiusChatSettings> | null);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Re-point open chat views at the current server URL / token. Debounced: the
	 * settings fields save on every keystroke, and each half-typed URL would
	 * otherwise open (and fail) a socket.
	 */
	refreshConnections(): void {
		window.clearTimeout(this.refreshConnectionsTimer);
		this.refreshConnectionsTimer = window.setTimeout(() => {
			for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIUS_CHAT)) {
				if (leaf.view instanceof ChatView) leaf.view.applyConnectionSettings();
			}
		}, CONNECTION_SETTINGS_DEBOUNCE_MS);
	}

	/** Apply the connection-debug-panel setting to all open chat views (live toggle). */
	refreshConnDebugPanels(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIUS_CHAT)) {
			if (leaf.view instanceof ChatView) leaf.view.syncConnDebugPanel();
		}
	}

	/** Open (or reveal) the chat view in the right sidebar. */
	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_CLAUDIUS_CHAT);
		if (existing.length > 0) {
			await workspace.revealLeaf(existing[0]!);
			return;
		}
		const leaf = workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_CLAUDIUS_CHAT, active: true });
		await workspace.revealLeaf(leaf);
	}

	/**
	 * Open a NEW, independent chat in a main-area tab. Always creates a fresh tab
	 * (never reuses one), so multiple parallel chats — each its own ChatView,
	 * WebSocket and session — can run side by side.
	 */
	async openInTab(): Promise<void> {
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_CLAUDIUS_CHAT, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}
}
