# Agent Note: Vault MiniMap collapse as a local twin, not a shared extraction

Status: implemented

English | [中文](2026-08-26-vault-minimap-collapse-local-twin.zh.md)

## Problem

The 技能库 (`ui-ph-vault`) graph canvas mounted its React Flow MiniMap unconditionally. On a narrow dockview pane the 172×116 map sits on top of the graph it summarizes, covering nodes the operator is trying to read. The 执行图谱 (`ui-ph-livegraph`) already solved exactly this: an operator toggle, a persisted per-surface preference, and a narrow-pane default that collapses the map before it can cover anything. The vault lacked the mechanism, so the two graph panels disagreed on a basic affordance — and the obvious fix invited extracting the ~20-line mechanism into a shared package, which is the decision this note owns.

## Decision

`VaultGraphCanvas` mirrors the livegraph mechanism as a documented `jscpd:ignore` **local twin**: `readMiniPref`/`writeMiniPref` persist the operator's choice under `ph:phvault:minimap` (`ph:phlivegraph:minimap` is the sibling key), an explicit toggle wins over the default, and absent a saved preference the live pane width collapses the map below `MINI_NARROW` (1000px). The pane width piggybacks on the refit `ResizeObserver` the canvas already ran — no second observer. The toggle button renders an inline tabler map/map-off glyph via the same vendored-inline pattern as `KindGlyph`, keeping the vault free of the `ui-ph-icons` leaf.

The twin comment in `VaultGraphCanvas.tsx` names `LiveGraphView` as the mirror copy, matching the refit-observer twin the same file already carries.

## Alternatives considered

**Extract the mechanism into a shared package (or into `ui-ph-icons` as a utility).** Rejected. The ph panel packages are deliberately decoupled — `DashView` states a panel cannot import another plugin's provider across the client-bundle-purity gate, and every prior shared shape (the `usePolledLoad` twins, the refit observer, the session-pick rule) is a documented `jscpd:ignore` twin with the recorded rule "extract to a shared package only if a fourth ph panel package appears" (see [the first-load visibility note](../bug-fix/2026-08-25-ph-surfaces-first-load-visibility.md), whose fix runs across those same twins). A new shared leaf costs full package ceremony — invariant module, catalog regeneration, purity registration — for ~20 lines used by two panels. The precedent holds until a third graph panel wants the mechanism.

**Import the toggle glyph from `ui-ph-icons`.** Rejected: the vault deliberately keeps zero icons-leaf dependency — `KindGlyph` already vendors its bulb/box/plug paths inline with a comment stating the panel stays self-contained. One more inline glyph is consistent; a new package edge for one icon is not.

**CSS-only mitigation (shrink or reposition the map on narrow panes).** Rejected: the operator sometimes wants the map gone regardless of width, and the livegraph already established the toggle-plus-preference idiom operators know. A diverging vault-only behavior would be a second vocabulary for the same control.

## Consequences

The two graph panels now behave identically, at the cost of a second copy of ~20 lines whose mirror is named in both files — the same standing obligation the refit twin already carries. The reintroduction condition for a shared extraction is recorded above: a third ph graph panel adopting the mechanism (or a fourth ph panel package overall, per the poller precedent) justifies the leaf.

## Testing

The vault package's tests pin the pure fold only; this control is browser-verified: in the scratch component lab the toggle hides and shows the map, writes `1`/`0` to the preference key, and a full reload with `1` saved mounts collapsed; the assembled cockpit on the operator's LAN origin renders the toggle over live board data with the map shown by default on a wide pane.
