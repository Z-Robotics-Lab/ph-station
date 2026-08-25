# @deepseek-ai/dsh-client-ui-ph-dash

English | [中文](README.zh.md)

实验台 — the drag-composable dashboard for the physical-harness console. One `conversation.view` entry (id `dash`, order −20, the leftmost tab and the session's default first screen) that hosts a [dockview](https://dockview.dev) panel grid. It reuses the same `conversation.view` ledger the tab strip reads and renders each view through the authorized `renderSlot`, so chat, the 图谱·过程流 cockpit, 技能库, 战报, and the other cockpit panels dock, split, resize, and tab on one screen without any panel being rewritten. Renders only — this package arranges existing views and computes nothing.

The arrangement persists per workspace in `localStorage` (a versioned key; a schema drift or corrupt store falls back to the default layout) and a toolbar button resets it. A draggable sash reserves a band for the composer, floored at the bare input row and capped at the live measured composer height. Dockview's structural stylesheet plus the PH tint are injected through the `?inline` channel for the plugin lifetime, because the client bundler's CSS pipeline is package-local. The one net-new runtime dependency is `dockview-react` (MIT).

The 执行图谱 graph and 过程流 ticker share one run selection through the livegraph `RunFeedProvider`, which lives inside the `lab` view; the default layout therefore docks `lab` as the cockpit panel, so picking a run in its scrubber drives both halves. The standalone 执行图谱 / 过程流 panels stay dockable, but each self-contains its own feed — a dashboard cannot import another plugin's provider across the purity gate.

## Model Experience

None, as the dashboard only arranges existing `conversation.view` panels rendered through `renderSlot` and registers nothing model-facing.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- The layout persists in browser `localStorage` only; a different browser or a cleared profile starts from the default arrangement.
- Run selection syncs between the graph and the ticker only inside the docked `lab` view; the standalone 执行图谱 / 过程流 panels each hold an independent feed because the purity gate forbids importing another plugin's provider.
