# @deepseek-ai/dsh-ph-board

English | [中文](README.zh.md)

physical-harness fork host bridge. A Typert Remote (`board`) that forwards the ph-station panels to the motherboard's evidence layer (`board/store.py`) through its CLI face (`board/storecli.py`), same-origin behind the gateway's `trusted-host` fence. Every method but one reads; `submitBrief` is the one write — storecli's atomic brief drop into a runtime session's inbox.

Each `@Remote` method `execFile`s `<pythonPath> -m board.storecli <fn> [name]` with `cwd=<repoRoot>` and returns `JSON.parse(stdout)` verbatim — zero statistics, zero interpretation. The gateway auto-serves them at `POST /api/board/<name>` (`stores`, `store`, `heldout`, `campaignProgress`, `cards`, `rounds`, `ledger`, `sessions`, `session`, `sessionProgress`, `runtimeStatus`, `runtimeFrame`, `runtimeEvents`, `vault`, `vaultNode`, `vaultNeighbors`, `submitBrief`). `submitBrief(briefJson, session)` forwards the two strings verbatim as `storecli submit_brief --brief/--session` (the same atomic `board/brief_drop` write `mcp_server.submit_brief` uses) and returns its `{submitted, inbox}` — deliberately zero client-side validation, because the resident runtime is the only authority over what a brief means. `campaignProgress` reads every live campaign heartbeat (`runs/*/progress.json`, overwritten per finished episode by a script-path battery) — done/total/label, the python-folded rolling stats, and a `running` flag — for the 演进 panel's in-progress card. `cards` reads the 机箱 (`board/cards.py`: `plugins/*/manifest.toml` as data); `rounds`/`ledger` fold the progress.md / STATUS.md feeds; `sessions`/`session` read the runtime session-log chain (the 演进 / 机箱 / 账本 panels and the status bar); `sessionProgress` folds one session's `task.plan_complete` rows into the mission-progress counts the operator rail and mission cockpit render; `runtimeStatus` reads the live `runtime_status.json` (the 取景窗 chip / vitals). `runtimeFrame` reads the live viewport JPEG (`runs/<session>/frame.jpg`) as `{jpeg_b64, ts, age_s}` with an `afterTs` cursor (forwarded as `--after-ts`; unchanged file → short `{unchanged}` reply) and an optional `waitMs` long poll (forwarded as `--wait-ms`: storecli blocks up to ~2s until the frame changes past the cursor, so the 取景窗 re-issues on reply and its frame rate tracks the harness dump rate). `runtimeEvents` reads the operational live-progress feed (`runs/<session>/runtime_events.jsonl`) with an incremental `afterSeq` cursor (forwarded as `--after`); `last_seq` below the caller's cursor means the runtime re-booted and the poller re-reads from 0 (the 执行图 live graph). `vault`/`vaultNode`/`vaultNeighbors` read the sealed typed-relation vault fold (`board/vault.py`) — the whole graph, one node as a wiki page, and one node's adjacency — for the 技能库 panel.

## Config

Three deployment-varying paths, injected by `scripts/cockpit` as `PH_BOARD_*` env vars through the deploy overlay's bundle row:

- `pythonPath` — Python that imports `board.store` (the motherboard venv).
- `repoRoot` — motherboard checkout, used as the subprocess `cwd`.
- `runsDir` — campaign `runs/` directory, passed as `--runs`.

The bundle row disables this plugin when `PH_BOARD_REPO` is absent, so a plain `dsh web` still boots (the panel then reports the board unavailable).

## Model Experience

None, as the Remote serves the browser panels (reads plus the `submitBrief` drop) and the chat LLM reaches the same `board.store` / `brief_drop` functions through the MCP server, which this package does not own.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- One Python subprocess per request on the panel-read methods; cold-imports `board.store`. Fine at human-cadence polling on tiny stores. `runtimeFrame` alone rides a resident `storecli serve` worker (line-JSON stdio, same dispatch): the measured ~60ms per-request spawn was the viewport's fps ceiling. The worker serializes frame reads, so a second browser tab shares one frame pipeline.
