# Agent Note: 实验台 names only the dashboard; the cockpit pane is 图谱·过程流

Status: implemented

English | [中文](2026-08-25-cockpit-graph-flow-tab-name.zh.md)

## Problem

The v3 dashboard (`packages/client/ui-ph-dash`, conversation.view id `dash`, order -20) took the name 实验台 and became the session's default composite view, but the earlier merged graph-and-ticker view (`packages/client/ui-ph-livegraph`, id `lab`, order -10) kept its own 实验台 label. The tab strip and the dashboard read one conversation.view ledger, so both entries render, and in Chinese the strip showed two tabs both labelled 实验台 — the operator cannot tell the dashboard from the pane it docks. English was unaffected (Cockpit versus Lab).

## Decision

The `lab` view's label is 图谱·过程流 / Graph · Flow, naming what the pane is — the 执行图谱 graph and the 过程流 ticker under one `RunFeedProvider`. 实验台 now names only the `dash` dashboard. The `lab` entry stays registered so the dashboard docks it as the default cockpit pane; only its `view.lab` label changed. Comments in `ui-ph-livegraph` and `ui-ph-dash` that called the pane 实验台 or the session's default view were corrected, since the default is now `dash` at order -20.

## Alternatives considered

- **Remove `lab` from the tab strip while keeping it dockable.** The strip and the dashboard read the same conversation.view ledger, so dropping `lab` from the strip drops it from the dashboard too. Keeping one while hiding the other needs a new per-entry "hidden from strip" flag — more surface for exactly this kind of collision.
- **Rename only the Chinese label.** Leaves English and Chinese naming the same view on different principles, so a later English reader re-litigates why `lab` is "Lab" here and graph·flow there.
- **Rename the dashboard instead.** 实验台 is the dashboard's established name and its default-view role; renaming the host rather than the docked pane moves the confusion instead of resolving it.

## Consequences

The docked cockpit pane's title reads 图谱·过程流, matching its content and distinct from the standalone 执行图谱 (order 19) and 过程流 (order 18) tabs. No id, order, or wiring changed, so the dashboard's default layout still docks `lab` as the cockpit pane and no stored layout migrates. The change is locale strings plus the corrected comments.
