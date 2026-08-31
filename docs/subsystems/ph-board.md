# PH Board Bridge

English | [中文](ph-board.zh.md)

[`@deepseek-ai/dsh-ph-board`](../../packages/host/dsh-ph-board) is this fork's read-only host bridge from the ph-station panels to the physical-harness evidence layer (`board/store.py`). Every `ctx.board` method runs the harness's CLI face (`board/storecli.py`) via `execFile` and forwards its stdout JSON verbatim — zero statistics, zero interpretation — so a panel renders the byte-identical dict the chat LLM receives through the MCP face of the same function.

Source: [`packages/host/dsh-ph-board/src/index.ts`](../../packages/host/dsh-ph-board/src/index.ts); wire types: [`packages/host/dsh-ph-board/src/types.ts`](../../packages/host/dsh-ph-board/src/types.ts)

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxboard--boardbridge"></a>

### `ctx.board` — `BoardBridge`

Remote over board.store via the storecli subprocess: read methods plus two writes (`submitBrief`, storecli's atomic brief drop, and `modelServer`, the local model server's start/stop). The gateway auto-serves each @Remote method at POST /api/board/<name>.

```ts cordis-catalog
/**
 * Every campaign store under runs/, newest first (summary cards).
 * @returns board.store.list_stores(runs) verbatim.
 */
@Remote('stores') stores(): Promise<JsonValue>

/**
 * Full structured view of one campaign store by name.
 * @param request - the store name (guarded by storecli's safe_child).
 * @returns board.store.store_detail(...) verbatim, or an {error} dict.
 */
@Remote('store') store(request: BoardStoreRequest): Promise<JsonValue>

/**
 * Multi-block held-out comparison for a campaign (its block + rescores).
 * @param request - the store name (guarded by storecli's safe_child).
 * @returns board.store.heldout_blocks(...) verbatim, or an {error} dict.
 */
@Remote('heldout') heldout(request: BoardStoreRequest): Promise<JsonValue>

/**
 * Every installed 机箱 card (each plugin's `manifest.toml`), manifest read as data.
 * @returns board.cards.list_cards() verbatim.
 */
@Remote('cards') cards(): Promise<JsonValue>

/**
 * The progress.md rounds feed (`## Round N - DATE - TITLE` sections), latest first.
 * @returns board.store.parse_rounds(...) verbatim (演进 timeline).
 */
@Remote('rounds') rounds(): Promise<JsonValue>

/**
 * The STATUS.md seed-block ledger (each range's burn state + source line).
 * @returns board.store.parse_ledger(...) verbatim (账本 table).
 */
@Remote('ledger') ledger(): Promise<JsonValue>

/**
 * Every live campaign heartbeat under runs/ (`runs/<store>/progress.json`, written
 * per finished episode by script-path batteries): done/total/label, the
 * python-folded rolling stats, and a `running` flag (fresh heartbeat, not yet
 * at total). Live state, never sealed evidence -- the 演进 panel's
 * in-progress card renders it verbatim.
 * @returns board.store.campaign_progress(runs) verbatim.
 */
@Remote('campaignProgress') campaignProgress(): Promise<JsonValue>

/**
 * Every runtime session under runs/, newest first (summary cards, no rows).
 * @returns board.store.discover_sessions(runs) verbatim (status-bar heartbeat).
 */
@Remote('sessions') sessions(): Promise<JsonValue>

/**
 * One runtime session by name: its note payloads grouped by kind + chain check.
 * @param request - the session name (guarded by storecli's safe_child).
 * @returns board.store.read_session(...) verbatim, or an {error} dict.
 */
@Remote('session') session(request: BoardSessionRequest): Promise<JsonValue>

/**
 * One session's mission-progress aggregate over its task.plan_complete rows
 * (task tallies, total replans/faults, stage pass-rate, latest task tree).
 * The fold lives in Python (charter: statistics in board/); this forwards it.
 * @param request - the session name (guarded by storecli's safe_child).
 * @returns board.store.session_progress(...) verbatim, or an {error} dict.
 */
@Remote('sessionProgress') sessionProgress(request: BoardSessionRequest): Promise<JsonValue>

/**
 * One runtime session's LIVE status (pid/render/mode/boot_ts/display),
 * overwritten each boot. Live operational state, not the sealed boot-row seal.
 * @param request - the session name (guarded by storecli's safe_child).
 * @returns board.store.read_runtime_status(...) verbatim, or null when absent.
 */
@Remote('runtimeStatus') runtimeStatus(request: BoardSessionRequest): Promise<JsonValue>

/**
 * The harness box's LIVE resource headroom: every GPU's VRAM with the compute
 * processes holding it (biggest first), physical RAM, and free space on the
 * filesystem holding `runs/` — `{gpu, ram, disk, ts}`. Host-addressed rather
 * than session-addressed, so it takes no argument. Live state, never chain
 * evidence, and the harness face never raises: a box with no NVIDIA driver
 * reports an empty `gpu` list instead of an error.
 * @returns board.store.host_vitals(runsDir) verbatim.
 */
@Remote('hostVitals') hostVitals(): Promise<JsonValue>

/**
 * Read or switch the harness box's LOCAL model server (llama.cpp on
 * 127.0.0.1:30001) — `{running, pid, port, healthy, model, vram_mib}`, plus an
 * `error` key when an action could not be carried out. `running` true with
 * `healthy` false is the server's 1-2 minute load window.
 *
 * Switches the SERVICE PROCESS only; which model a request routes to stays the
 * console's route selection. Stopping the server returns its VRAM to the
 * simulator, which is why an operator who never opens a terminal needs it.
 *
 * The second write on this Remote, and the narrowest one available: `action`
 * is storecli's single positional argument, board.store accepts only
 * `status`/`start`/`stop`, and the launcher script board.store may run is a
 * constant there. No path, command line, or pid from this process reaches the
 * harness.
 * @param action - `status`, `start`, or `stop`. board.store rejects any other
 * word with an error beside a truthful status and executes nothing.
 * @returns board.store.model_server(action, runsDir) verbatim.
 */
@Remote('modelServer') modelServer(action: string): Promise<JsonValue>

/**
 * One runtime session's LIVE viewport frame (`runs/<session>/frame.jpg`,
 * dumped offscreen by the harness frames overlay while a task runs):
 * `{jpeg_b64, ts, age_s}`, or `{error: 'no frame'}` when none exists. The
 * base64 is encoded harness-side; this panel-facing face only forwards it.
 * `afterTs` is the poller's cursor: an unchanged file returns the short
 * `{unchanged, ts, age_s}` reply with no image bytes. `waitMs` long-polls:
 * storecli blocks up to that long (capped board-side at 2s) for the frame to
 * change past the cursor before answering, so the 取景窗 re-issues the call
 * on reply and its to-hand fps tracks the writer's dump rate.
 * @param request - session name (guarded by storecli's safe_child) + cursors.
 * @returns board.store.read_runtime_frame(...) verbatim, or an {error} dict.
 */
@Remote('runtimeFrame') runtimeFrame(request: BoardRuntimeFrameRequest): Promise<JsonValue>

/**
 * One runtime session's OPERATIONAL event feed (runtime_events.jsonl, written
 * by harness.opstream): events with seq > afterSeq plus last_seq. A last_seq
 * below the caller's cursor means the runtime re-booted (feed truncated);
 * the poller resets its cursor to 0 and re-reads. Live progress, never chain
 * evidence.
 * @param request - session name (guarded by storecli's safe_child) + cursor.
 * @returns board.store.read_runtime_events(...) verbatim, or an {error} dict.
 */
@Remote('runtimeEvents') runtimeEvents(request: BoardRuntimeEventsRequest): Promise<JsonValue>

/**
 * The INDEX of one runtime session's keyframe stills (`runs/<session>/keyframes/`,
 * one JPEG the harness pins to an interesting `runtimeEvents` seq and clears on
 * every boot): `{frames: [{seq, kind, ts}], count}`. Index only — no image
 * bytes — so a panel polls it at event cadence and fetches a still through
 * {@link runtimeKeyframe} on demand. An absent directory reads as an empty
 * index, because a keyframe is live state and never sealed evidence.
 * @param request - the session name (guarded by storecli's safe_child).
 * @returns board.store.read_runtime_keyframes(...) verbatim, or an {error} dict.
 */
@Remote('runtimeKeyframes') runtimeKeyframes(request: BoardSessionRequest): Promise<JsonValue>

/**
 * One keyframe still by the `runtimeEvents` seq it is pinned to:
 * `{jpeg_b64, seq, kind}`, or `{error: 'no keyframe'}` when that seq holds
 * none (never captured, or cleared by a later boot). The base64 is encoded
 * harness-side; this face only forwards it.
 * @param request - session name (guarded by storecli's safe_child) + the seq.
 * @returns board.store.read_runtime_keyframe(...) verbatim, or an {error} dict.
 */
@Remote('runtimeKeyframe') runtimeKeyframe(request: BoardRuntimeKeyframeRequest): Promise<JsonValue>

/**
 * Drop one brief into a runtime session's inbox (`storecli submit_brief`,
 * which shares board/brief_drop's atomic write with mcp_server.submit_brief).
 * The one write on this Remote, and deliberately zero-validation on both
 * sides: the resident runtime is the sole authority over what a brief means,
 * so a malformed brief is filed under the session's failed/ by the runtime
 * rather than second-guessed here.
 * @param briefJson - the brief as a JSON string, forwarded verbatim as --brief.
 * @param session - runtime session directory name, forwarded as --session.
 * @returns storecli's stdout verbatim ({submitted, inbox}, the same JSON
 * mcp_server.submit_brief returns), or an {error} dict.
 */
@Remote('submitBrief') submitBrief(briefJson: string, session: string): Promise<JsonValue>

/**
 * Where one brief is and what it did (`storecli brief_status`): the same
 * `{state, brief_id, session, task, events, outcome?, ...}` dict the MCP face
 * returns, read off which of the runtime's intake directories holds the brief.
 * The brain panel polls this after `submitBrief` to watch a dispatch and to
 * decide when to replan; it is a live read, never sealed evidence. `waitMs`
 * long-polls for the state to change (capped board-side); waiting it out is
 * not an error — the reply just still reads `running`.
 * @param request - the brief id, its runtime session, and an optional poll budget.
 * @returns board.store.brief_status(...) verbatim, or an {error} dict.
 */
@Remote('briefStatus') briefStatus(request: BoardBriefStatusRequest): Promise<JsonValue>

/**
 * The whole skill vault: the deterministic fold over sealed SkillRecords,
 * manifest cards, and the capability catalog as a typed wiki graph.
 * @returns board.vault.build_graph(...) verbatim ({schema_version, nodes, edges}).
 */
@Remote('vault') vault(): Promise<JsonValue>

/**
 * One vault node as a wiki page: the node plus its `out` edges and `backlinks`.
 * @param request - the node id (skill digest / package dir / capability seam).
 * @returns board.vault.node(...) verbatim, or an {error: 'unknown node'} dict.
 */
@Remote('vaultNode') vaultNode(request: BoardVaultNodeRequest): Promise<JsonValue>

/**
 * Adjacency (both directions) for one vault node, optionally one relation.
 * @param request - the node id plus an optional `rel` restriction.
 * @returns board.vault.neighbors(...) verbatim, or an {error: 'unknown node'} dict.
 */
@Remote('vaultNeighbors') vaultNeighbors(request: BoardVaultNeighborsRequest): Promise<JsonValue>
```

Source: [`packages/host/dsh-ph-board/src/index.ts`](../../packages/host/dsh-ph-board/src/index.ts)
<!-- END GENERATED cordis-surface -->
