# PH Board 桥接

[English](ph-board.md) | 中文

[`@deepseek-ai/dsh-ph-board`](../../packages/host/dsh-ph-board)是本 fork 从 ph-station 面板通往 physical-harness 证据层（`board/store.py`）的只读 host 桥接。每个 `ctx.board` 方法通过 `execFile` 运行主机侧的 CLI 调用面（`board/storecli.py`），并原样转发其 stdout JSON——零统计、零解读——因此面板渲染的 dict 与聊天 LLM 经同一函数的 MCP 调用面拿到的逐字节一致。

来源：[`packages/host/dsh-ph-board/src/index.ts`](../../packages/host/dsh-ph-board/src/index.ts)；wire 类型：[`packages/host/dsh-ph-board/src/types.ts`](../../packages/host/dsh-ph-board/src/types.ts)

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxboard--boardbridge"></a>

### `ctx.board` — `BoardBridge`

Read-only Remote over board.store via the storecli subprocess. The gateway auto-serves each @Remote method at POST /api/board/<name>.

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
 * One runtime session's OPERATIONAL event feed (runtime_events.jsonl, written
 * by harness.opstream): events with seq > afterSeq plus last_seq. A last_seq
 * below the caller's cursor means the runtime re-booted (feed truncated);
 * the poller resets its cursor to 0 and re-reads. Live progress, never chain
 * evidence.
 * @param request - session name (guarded by storecli's safe_child) + cursor.
 * @returns board.store.read_runtime_events(...) verbatim, or an {error} dict.
 */
@Remote('runtimeEvents') runtimeEvents(request: BoardRuntimeEventsRequest): Promise<JsonValue>
```

Source: [`packages/host/dsh-ph-board/src/index.ts`](../../packages/host/dsh-ph-board/src/index.ts)
<!-- END GENERATED cordis-surface -->
