# physical-harness 操作台 (ph-station)

English | [中文](README.zh.md)

`ph-station` is the lab console for **physical-harness** — a rebranded, extended fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`, MIT). It keeps the upstream harness as its interface layer and adds a set of read-only panels that surface the motherboard's campaign evidence right beside the chat.

## Relationship to upstream

- Licensed [MIT](LICENSE), same as upstream. All upstream attribution and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) are kept intact.
- The `upstream` git remote (`deepseek-ai/deepseek-harness`) is retained so upstream fixes and features can be merged forward.
- Everything the fork adds lives in one host package, seven client packages, and the console brand:
  - `packages/host/dsh-ph-board` — a read-only `board` Host Remote that bridges the panels to the motherboard's evidence layer.
  - `packages/client/ui-ph-battle` — the 战报 panel.
  - `packages/client/ui-ph-panels` — the 演进 / 机箱 / 账本 panels, the 任务台 chips, and the status bar.
  - `packages/client/ui-ph-ops` — the operator rail and the graph-first mission cockpit.
  - `packages/client/ui-ph-livegraph` — the 执行图 live execution-graph panel.
  - `packages/client/ui-ph-vault` — the 技能库 Skill Vault wiki panel.
  - `packages/client/ui-ph-dash` — the 实验台 dockview dashboard that docks the other panels on one screen.
  - `packages/client/ui-ph-icons` — the shared cockpit icon set, a vendored MIT subset of tabler-icons.
  - **brand** — the `physical-harness` wordmark and `PH` monogram in `packages/client/ui-brand-official`.

<a id="run"></a>

## Run

The console is **not launched standalone** in this lab. It is started by the motherboard's cockpit script, which builds this fork, injects the `PH_BOARD_*` paths, and serves the Web UI at `http://127.0.0.1:3080`:

```sh
/home/yusenzlabpc/Desktop/physical-harness/scripts/cockpit
```

<a id="run-from-source"></a>

## Development

```sh
pnpm install     # install workspace dependencies
pnpm run build   # tsc emits lib/types, tsdown bundles the runtime
pnpm run dev:web # watch-mode Web UI for panel development
```

Repo conventions live in [AGENTS.md](AGENTS.md).

## Panels

All panels are read-only operator surfaces beside the chat; every number comes from the `board` Remote (`board.store` / `board.cards`), which reads the motherboard evidence layer. TypeScript formats but computes nothing.

- **任务台** — preset chips above the composer that prefill an editable task prompt (they never auto-send).
- **战报** — the per-campaign battle report: paired gate, McNemar fixed/broken, held-out badge, per-generation Δpp.
- **演进** — the RSI monitor: per-generation Δpp bars plus the progress feed.
- **机箱** — the chassis card grid read from plugin manifests.
- **账本** — the seed-block ledger table.
- **status bar** — MODE, boot facts, heartbeat, board reachability, and the 取景窗 (render) chip.

## License

[MIT](LICENSE). Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
