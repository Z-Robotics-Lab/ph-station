# @deepseek-ai/dsh-client-ui-ph-battle

English | [中文](README.zh.md)

The 战报 (battle-report) panel: one entry in the `conversation.view` slot that reads the harness evidence layer through the `board` Host Remote and renders only. No service, no business logic — every number comes from `board.store` (paired gate, McNemar fixed/broken, held-out badge, per-generation Δpp).

It fetches `/api/board/stores` for the campaign list, then `/api/board/store` + `/api/board/heldout` on selection, re-fetching the list on a 15s poll that pauses while the tab is hidden and re-runs the moment it returns; a failed poll keeps the last good list. When the board bridge is not mounted (a plain `dsh web` with no `PH_BOARD_*` env), the panel reports the data plane unavailable.

## Model Experience

None, as the panel renders board Remote state for the browser operator and touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- Fixed 15s list poll rather than a `store_mtime`-driven refresh; adequate for the small `runs/` tree, revisit if the campaign list grows large.
- The visibility-paused poll effect is a local twin of ui-ph-panels' `usePolledLoad` (marked with `jscpd:ignore`); the two fork panel packages stay independent rather than couple for eight lines. Extract to a shared package if a third ph panel package appears.
- This package ships only 战报; the 演进 / 机箱 / 账本 panels and the status bar live in the sibling `@deepseek-ai/dsh-client-ui-ph-panels` package.
