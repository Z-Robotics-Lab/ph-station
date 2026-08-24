# Agent Note: gate the welcome notice off on an origin that cannot remember the dismissal

Status: implemented

English | [中文](2026-08-25-ph-welcome-notice-gate-remote-origin.zh.md)

## Problem

The product-wide internal-testing notice (`内测声明`, `WelcomeNotice`) blocks the app until its exact copy version is acknowledged, and the acknowledgement persists through the welcome settings scope. On a loopback browser the scope follows the durable Host section and the notice shows once. On a non-loopback origin — the lab operator's LAN path `http://172.26.112.106:3081`, a plain-http insecure context — the scope resolves to memory mode, because the loopback-only settings API cannot be reached. `WelcomeNoticeStore` treated memory mode as a process-local acknowledgement that started `false`, so the notice rendered, `acknowledge()` advanced only this process, and the dismissal was lost on reload: the upstream DeepSeek beta notice reappeared on **every** page load on the LAN origin the operators actually use.

## Decision

On a memory-mode scope the notice reads as already-acknowledged: `WelcomeNoticeStore.derive` publishes `acknowledged: true` for `mode === 'memory'`, so `WelcomeNotice` completes its onboarding step and renders nothing. An origin that cannot persist a dismissal is never nagged by a notice it could not remember. Loopback behavior is unchanged — the durable path still shows the notice once and records the acknowledgement — so only the two tests that pinned the remote-reappear behavior changed (`welcome-store.client.spec.ts` memory case, `apply.client.spec.ts` remote-browser case, and the `remote-welcome.e2e.ts` drive now asserts the notice never blocks a remote origin). The now-unused process-local `localAcknowledged` field and its `acknowledge()` write were removed.

## Alternatives considered

**Remove the welcome-notice registration (the roster row) entirely for the fork.** The notice is upstream's beta messaging, not this lab's, so full removal is defensible. Rejected as the larger, riskier change: it cascades into deleting or rewriting the component, store, copy, locale keys, the two onboarding unit specs, the loopback onboarding e2e, its snapshot, and the scaffold plumbing, and it removes the once-only notice on the loopback host where it can still persist. The memory-mode gate fixes the reported bug (the LAN origin) at its root with the smallest diff; a full removal remains available if the lab wants the notice gone on loopback too.

**Persist the acknowledgement to `localStorage` on a memory-mode scope.** `localStorage` works in an insecure context, so the notice would show once and then stick. Rejected: it still shows the upstream beta copy once per browser, and "no notice on fresh load" is the acceptance for the operator origin; auto-acknowledging on an origin that cannot reach the durable store is simpler and meets it.

## Consequences

The LAN/insecure origin never shows the internal-testing notice; the loopback host is unchanged. The gate keys on the scope's `memory` mode — the exact signal that the durable store is unreachable — not on a hardcoded origin check, so it also covers any future non-persisting scope. If the lab later wants the notice gone on loopback as well, that is the full-removal change above, not this gate.

## Testing

The two welcome unit specs assert a memory-mode / remote-browser scope now reads `acknowledged: true` after load. The loopback specs (`welcome-notice.client.spec.tsx`, the loopback `apply.client.spec.ts` cases, and the loopback onboarding e2e with its snapshot) are unchanged and still pass, pinning the once-only durable behavior. The headless drive over the plain-http LAN origin asserts no `内测声明` dialog mounts and the app is not held inert, across a reload.
