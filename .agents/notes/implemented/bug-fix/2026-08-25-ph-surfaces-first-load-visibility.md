# Agent Note: ph live surfaces run their first board load regardless of tab visibility

Status: implemented

English | [中文](2026-08-25-ph-surfaces-first-load-visibility.zh.md)

## Problem

The ph live surfaces — the operator rail (`ui-ph-ops`), the frame status bar and the 战报/演进/机箱/账本 panels (`ui-ph-panels`, `ui-ph-battle`), and the 执行图谱·过程流 feed (`ui-ph-livegraph`) — refresh on a poll paused while `document.hidden` so a backgrounded console burns no board calls. Every one of them gated its *first* load on that same `!document.hidden` check: `usePolledLoad` ran `run()` (which is `if (!document.hidden) load()`) on mount, `BattleView` ran the same inline, and `useLiveFeed`'s first `tick()` skipped `load()` while hidden. So a surface that *mounts* while its tab reports hidden — an operator console on a backgrounded or occluded window, not the active tab — never issued its first board read and stayed on its empty initial render: 模式 未知 / 技能 0 for the rail, 无会话 for the status bar, 加载中 for the feed. The `visibilitychange` handler recovers on a return-to-visible transition, but a tab that stays hidden never receives one, so the empty state was permanent. The 技能库 (`ui-ph-vault`) never showed the fault because `VaultView` already runs its first load unconditionally and gates only the background refresh — the asymmetry that hid the bug, now the reference.

Decisive evidence: on the operator's real remote (backgrounded) browser the console sat at 模式 未知 / 技能 0 with only `board/vault` ever issued; forcing `document.hidden` to false and dispatching `visibilitychange` on the unmodified live build made the rail reach 模式 execution / 技能 3 within one tick — proving the pollers were merely paused, not failing a board read (server curls of every endpoint returned `ok: true` throughout, and the gateway reached the transport with an active Connection every time).

## Decision

Run the first load unconditionally in every ph poller, matching `VaultView`: `usePolledLoad` (the `ui-ph-ops` and `ui-ph-panels` twins) calls `load()` on mount instead of the visibility-gated `run()`; `BattleView` calls `void loadStores()`; `useLiveFeed`'s first `tick()` runs `load()` regardless of `document.hidden` (a `first` flag), then reverts to the gated cadence. Only the refresh cadence and the `visibilitychange` handler stay gated, so a backgrounded console still burns no board calls after the first paint — the gate keeps its purpose, it just no longer suppresses the initial paint. `useLiveFeed` additionally wraps its awaited `load()` in `try/catch` routing a rejection to `setOnline(false)`: its recursive `setTimeout` schedules the next tick only after `await load()` returns, so a rejected board read would otherwise skip the reschedule and stop the feed permanently — the offline fold its `ok: false` siblings already have, which 2026-08-25-ph-panels-fold-remote-reject did not extend to this hook.

## Alternatives considered

**Remove the hidden-tab gate entirely.** Rejected: the gate exists so a console left open on a background tab does not spawn a Python storecli subprocess per poll for nobody. Only the first paint needs to bypass it.

**Recover through the `visibilitychange` handler alone.** Rejected: it fires only on a hidden→visible transition, which a persistently-hidden tab (a second monitor, an occluded window) never receives; the panel stays blank until the operator happens to focus it — the exact symptom reported.

## Consequences

A ph surface that mounts while hidden paints its data once immediately, then refreshes on the visible-only cadence as before. The first-paint board reads (a handful, once, at mount) now fire whether or not the tab is foreground — the same reads a foreground mount already issued, so no new steady-state load. The four pollers stay near-identical twins (the deliberate no-shared-module decoupling), now all matching `VaultView`'s first-load rule.

## Testing

The assembled fork build, served over the operator's own plain-http LAN origin and driven in the real remote browser while the tab reports `document.hidden`, reaches 模式 execution / 技能 3 / session-main with a populated 过程流 feed on load — the exact condition the old build left blank. These view-only packages carry no unit harness; the assembled-app real-browser drive is their coverage, as for the sibling fold change.
