# @deepseek-ai/dsh-client-ui-ph-panels

English | [中文](README.zh.md)

The 演进 (RSI monitor), 机箱 (chassis), and 账本 (ledger) panels plus the frame-wide status bar. Each is one slot entry that reads the harness evidence layer through the `board` Host Remote and renders only — no service, no business logic. Every number comes from `board.store` / `board.cards`; TS formats (×100 for pp with sign, mtime → duration) but computes nothing.

- **演进** (`conversation.view` tab) — `/api/board/stores` + `/api/board/store` for per-generation Δpp bars (dev/blind/held-out deltas, promotion events, McNemar fixed/broken), and `/api/board/rounds` for the progress.md feed. `/api/board/campaignProgress` drives the 进行中 cards on top: one per running script-path battery (`runs/*/progress.json` heartbeat) with its done/total bar, success count, first-death top-3 chips, and an ETA that is a pure display conversion of the python-provided timestamps; the heartbeat alone tightens to a 5s poll while a campaign runs, and the cards render nothing (no reserved space) when none does.
- **机箱** (`conversation.view` tab) — `/api/board/cards` card grid: name, actuation, needs_sim, contribute counts, and manifest summary. The doctor is not wired (no `scripts/plugin_doctor.py` yet), so a labeled `体检: 未接入` slot stands in — never faked.
- **账本** (`conversation.view` tab) — `/api/board/ledger` seed-block table: range, burn state, source line. `parse_ledger` returns no task / holdout field, so those columns are absent rather than invented.
- **status bar** (`shell.overlay` strip) — MODE + boot facts from the newest runtime session's `runtime.boot` row (`/api/board/sessions` + `/api/board/session`), a heartbeat from the session mtime, and board-bridge reachability from whether the fetch worked. When the boot row carries a `render` key it also shows a 取景窗 on/off chip; rows without the key (older sessions) show no chip — presence is the signal, never a guess.
- **任务台 chips** (`conversation.input.dock` row above the composer) — small preset buttons (stack / lift_geometric task, latest battle report) that prefill the composer draft with an editable prompt template via the session input face; they never submit — the operator edits seed/params and sends.

Every panel and the status bar re-fetch on a shared 15s poll, paused while the tab is hidden and re-run the moment it returns; a failed poll keeps the last good data. When the board bridge is not mounted (a plain `dsh web` with no `PH_BOARD_*` env), each panel reports the data plane unavailable.

## Model Experience

None, as the panels render board Remote state and the 任务台 chips only prefill an editable composer draft, which reaches the model as an ordinary user message only when the operator sends it.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- Fixed 15s polls rather than an mtime-driven refresh; adequate for the small `runs/` tree, revisit if it grows large.
- The 演进 Δpp bars use a fixed 40pp full-scale reference (a glance cue; the exact signed value sits beside every bar).
