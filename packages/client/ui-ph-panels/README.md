# @deepseek-ai/dsh-client-ui-ph-panels

The 演进 (RSI monitor), 机箱 (chassis), and 账本 (ledger) panels plus the
frame-wide status bar. Each is one slot entry that reads the harness evidence
layer through the `board` Host Remote and renders only — no service, no business
logic. Every number comes from `board.store` / `board.cards`; TS formats
(×100 for pp with sign, mtime → duration) but computes nothing.

- **演进** (`conversation.view` tab) — `/api/board/stores` + `/api/board/store`
  for per-generation Δpp bars (dev/blind/held-out deltas, promotion events,
  McNemar fixed/broken), and `/api/board/rounds` for the progress.md feed.
- **机箱** (`conversation.view` tab) — `/api/board/cards` card grid: name,
  actuation, needs_sim, contribute counts, and manifest summary. The doctor is
  not wired (no `scripts/plugin_doctor.py` yet), so a labeled `体检: 未接入`
  slot stands in — never faked.
- **账本** (`conversation.view` tab) — `/api/board/ledger` seed-block table:
  range, burn state, source line. `parse_ledger` returns no task / holdout
  field, so those columns are absent rather than invented.
- **status bar** (`shell.overlay` strip) — MODE + boot facts from the newest
  runtime session's `runtime.boot` row (`/api/board/sessions` +
  `/api/board/session`), a heartbeat from the session mtime, and board-bridge
  reachability from whether the fetch worked. No render-window / model-serving
  indicator: no data source exists yet (design watch-item).

When the board bridge is not mounted (a plain `dsh web` with no `PH_BOARD_*`
env), each panel reports the data plane unavailable.

## Model Experience

Not model-facing. Operator surfaces beside the chat; they add no prompt, token,
or KV-cache effect.

## Known Limitations and Deferred Work

- Fixed 5s polls rather than an mtime-driven refresh; adequate for the small
  `runs/` tree, revisit if it grows large.
- The 演进 Δpp bars use a fixed 40pp full-scale reference (a glance cue; the
  exact signed value sits beside every bar).
