# Agent Note: 实验台 dock sashes are grabbable on a desktop pointer

Status: implemented

English | [中文](2026-08-25-dash-sash-grabbable.zh.md)

## Problem

The 实验台 dashboard (`packages/client/ui-ph-dash`) arranges every conversation view into a dockview grid whose groups are resized by dragging the inter-group sashes. Vendored dockview (`dockview.css`, from dockview-core v8.2.0) draws each sash 4px wide, transparent at rest (`--dv-sash-color: transparent`), tinted only on hover after a 0.5s delay, and enlarges the pointer target to ±10px **only** under `@media (pointer: coarse)`. On the lab operator's desktop pointer that leaves a 4px, invisible, delayed-feedback divider between panels: the operator sees the 1px separator line but cannot find or hit the grab target, so the lower panels read as non-resizable — the vertical sash between the cockpit (lab) group and the tabbed group below it "does not respond to drag". The reservation that keeps the dock clear of the sticky composer band already lands separately (`DashView.module.css` `.stage` `padding-bottom: var(--dsh-composer-height)`), so the dock fills the stage content box with no dead band; the remaining gap is purely that the sashes are ungrabbable on a fine pointer.

## Decision

`dockview-ph.css` — the PH tint layer applied on the `.dv-ph` class DashView puts on the dockview root, injected after the vendored sheet — adds, scoped to `.dv-ph` so nothing outside the dashboard is touched:

- A **visible resting grip**: a short centered handle (`::after`, 2×24px, `border-radius: 2px`) on every enabled sash, faint at rest (`currentColor` 16%) and brighter while hovered or dragged (45%), oriented across the divider on both axes, so the divider reads as draggable.
- A **≥6px desktop hit-area**: the same enlarged `::before` strip dockview ships for coarse pointers, re-added under `@media (pointer: fine)` with a 4px-per-side extension (4px sash + 8px = 12px target). The vendored `@media (pointer: coarse)` ±10px strip is left untouched, so touch keeps its larger target.
- **Immediate hover feedback**: `transition-delay: 0s` on the sash hover/active tint, replacing dockview's 0.5s delay.

The vendored `dockview.css` stays a verbatim copy; the whole affordance rides the PH override layer.

## Alternatives considered

**Edit the vendored `dockview.css` (widen the sash, drop the coarse gate).** Rejected: `dockview.css` is a pinned verbatim copy attributed in THIRD_PARTY_NOTICES; local edits are re-applied on every dockview sync. The PH tint layer already exists for exactly this — mapping dockview chrome to PH-neutral tokens on `.dv-ph` — so the grab affordance belongs there.

**Widen the sash itself to ≥6px.** Rejected: the sash width is also the visible gap between panels; widening it thickens every divider and shifts the grid geometry. A transparent `::before` hit strip enlarges the target without changing layout, matching how dockview itself enlarges the touch target.

**Rely on the existing 1px `--dv-separator-border` line as the affordance.** Rejected: that line is a static separator with no hover state and no bearing on the grab target; the operator already sees it and still cannot grab the 4px sash. A grip that responds to hover is what signals "drag here".

## Consequences

Every inter-group sash (vertical and horizontal) now shows a resting grip and accepts a drag anywhere within a 12px band on a desktop pointer; touch behavior is unchanged. The cost is a per-side 4px hit strip that overlaps the adjacent panel edges, so a pointer within 4px of a group boundary starts a resize instead of reaching panel content there — the same trade dockview makes on touch, bounded to the dashboard by the `.dv-ph` scope. The grip is a small always-present mark centered on each divider.

## Testing

Headless Chromium drives the fork build (`node apps/cli/lib/bin.js web`) at 1840px and 1280px widths: opening a session's 实验台 tab, the dockview root's bottom equals the stage content bottom (no dead band); dragging the vertical sash 150px up then back down changes the two right-column group heights and the change survives a reload (the layout is written to `ph.dash.layout.v1`); and the sash `::after` grip and `::before` hit strip resolve on a fine pointer. These view-only packages carry no unit harness; the assembled-app headless drive is their coverage.
