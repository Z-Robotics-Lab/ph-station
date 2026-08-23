# @deepseek-ai/dsh-client-ui-ph-battle

The 战报 (battle-report) panel: one entry in the `conversation.view` slot that
reads the harness evidence layer through the `board` Host Remote and renders
only. No service, no business logic — every number comes from `board.store`
(paired gate, McNemar fixed/broken, held-out badge, per-generation Δpp).

It fetches `/api/board/stores` for the campaign list, then
`/api/board/store` + `/api/board/heldout` on selection, polling the list at
human cadence. When the board bridge is not mounted (a plain `dsh web` with no
`PH_BOARD_*` env), the panel reports the data plane unavailable.

## Model Experience

Not model-facing. This is an operator surface beside the chat; it adds no
prompt, token, or KV-cache effect.

## Known Limitations and Deferred Work

- Fixed 5s list poll rather than a `store_mtime`-driven refresh; adequate for the
  small `runs/` tree, revisit if the campaign list grows large.
- 演进 / 机箱 / 账本 panels and the status bar are deferred (see
  `docs/ph-station-design.md` §7); this package ships only 战报.
