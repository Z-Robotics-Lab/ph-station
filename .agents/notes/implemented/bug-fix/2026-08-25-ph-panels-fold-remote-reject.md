# Agent Note: ph panels fold a rejected board read into offline, not a permanent spinner

Status: implemented

English | [中文](2026-08-25-ph-panels-fold-remote-reject.zh.md)

## Problem

The ph read panels (战报/演进/机箱/账本 tabs and the frame-wide status bar) drive the board Remote through injected `fetch*` helpers typed `() => Promise<RemoteResult<unknown>>`, and each view's poll callback awaits one and branches on `.ok`, folding a failure into its own offline state. That reads the `RemoteResult` contract literally — carrier failures arrive as `ok: false` — but `ClientRemoteService.invoke` (`packages/api/gateway/src/client/index.ts`) *rejects* on assembly faults (wrong argument count, a parameter that fails its codec, a missing Context binder, or no active Connection), deliberately, so programmer errors fail loud; the client gateway tests pin those rejections. A rejected board read therefore escaped the poll callback: `void load()` swallowed the rejection, no state setter ran, and the view stayed on its initial render forever — 加载中 for the four list panels, 模式 未知 / 无会话 for the status bar — with no request retried and no error surfaced. A single transient reject (a load-order gap that leaves `connection` momentarily absent, a future codec change) turns the whole board strip into a silent permanent spinner.

## Decision

Every panel poll callback — `loadStores` in `BattleView` and `load` in `EvolutionView`, `CardsView`, `LedgerView`, and `StatusBar` — wraps its board reads in `try/catch` and routes a rejection to the same offline sink its `ok: false` branch already uses: `setError(message)` for the four list panels (rendered as the existing "数据面不可用" state) and `setOnline(false)` for the status bar. A board read that rejects for any reason now reads as board-unavailable, never an infinite 加载中. The gateway keeps its loud rejections for assembly faults; the consumers own the fold, honoring the panels' own expectation that a failed load surfaces as offline.

## Alternatives considered

**Fold assembly faults into `ok: false` inside `ClientRemoteService.invoke`.** Rejected: the gateway rejects a wrong argument count, a bad codec input, or a missing Context deliberately so those programmer errors fail loud for the caller; `packages/api/gateway/tests/gateway.client.spec.ts` pins that behavior and every Remote consumer relies on it. Silencing it app-wide to fix one consumer trades a loud programmer-error signal for a hidden one.

**A shared guard helper wrapping every injected `board.*()` at the two inject faces.** Rejected: it touches more call sites (eleven) than the five poll gates, and the two ph client packages are deliberately decoupled with no shared module (the same reason `BattleView` inlines its own poll), so the helper would duplicate across packages anyway; the per-view `try/catch` sits exactly at the loading→data/error transition it protects.

## Consequences

A board read that rejects degrades to the visible offline state instead of a permanent spinner, at the cost of five near-identical `try/catch` blocks across two decoupled packages — consistent with their already-duplicated inline poll. The list panels keep their last-good data on a failed poll (data stays set, only `error` updates); the status bar marks board offline. Detail-drill reads (store/heldout on select) already degrade to their empty state and are unchanged.

## Testing

Headless Chrome drives the fork build over a plain-http LAN origin (an insecure context, the lab operator's path): opening a session's 战报 tab issues `board/stores` (HTTP 200) and renders real campaign rows, and the status strip reads MODE execution / session-main / board online — the happy path the fold must not regress. These view-only packages carry no unit harness; the assembled-app headless drive is their coverage, and the reject branch reuses the offline sink that drive exercises through `ok: false`.
