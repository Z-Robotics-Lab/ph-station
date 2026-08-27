# Agent Note: One-click RSI — submitBrief write on the board Remote + launcher/stepper that render board facts

Status: implemented

English | [中文](2026-08-28-rsi-one-click-launcher-stepper.zh.md)

## Problem

Running RSI required hand-writing a `{"kind":"rsi","task":...}` brief JSON, knowing out-of-band which session's runtime booted in evolution mode, and gambling on that runtime being alive (one brief sat unclaimed in a dead inbox for 21 hours). The console showed the chain only after the fact, through the 进行中 card's `stage` chip. The fix had to make submission a two-click act and the whole discipline chain visible, without moving any judgement into TypeScript.

## Decision

`dsh-ph-board` gains its one write, `submitBrief(briefJson, session)`: the two strings forwarded verbatim as `storecli submit_brief --brief/--session` (the motherboard side implements that subcommand over the same atomic `board/brief_drop` write `mcp_server.submit_brief` uses, returning the identical `{submitted, inbox}`). Zero validation on both sides — the resident runtime is the only authority over what a brief means, so a bad brief fails in the runtime's `failed/`, visibly, rather than being second-guessed by a client.

The 演化台 head (`RsiRun.tsx`, the console's own inject face) renders board facts into a launcher: the task dropdown flattens the 机箱 cards' `contributes.task_bindings`; the session dropdown lists `runtime.boot` sessions whose live `runtimeStatus.mode` is `evolution`, each with its session-log-mtime age, and past ~10 minutes a gray stale badge — a displayed fact that never blocks the submit (a quiet runtime can look stale while alive; the runtime decides). The returned `submitted` filename is echoed with a pointer to the stepper below.

The seven-step stepper (allocate → calibrate → gate → prereg → dev → held-out → install) positions itself from the newest rsi `campaignProgress` heartbeat's `stage` through a display mapping (`STAGE_POS`, the same vocabulary-rendering move as `STAGE_KEYS`), and shows done/total, the three seed blocks, the first-death distribution, and the gate's c1..c6 criteria as red/green chips. The criteria come from the sealed `runtime.rsi_scheduled` session-chain row matched by brief stem, falling back to the live heartbeat's own `verdict`/`failed` fields while the chain runs; a NO-GO renders as the labeled honest result ("诚实 NO-GO"), never an error state.

## Alternatives considered

**Client-side brief validation (task exists, session fresh).** Rejected: the runtime is the single authority; a client check would fork the rule set and rot.

**Reading the gate payload from `runtime_events`.** Rejected on inspection: `runtime.rsi_scheduled` is appended by `rt.log.append` — a session-chain row surfaced by `read_session`, not an opstream event — so the stepper reads it through the existing `session` Remote.

**Blocking submits to stale sessions.** Rejected: mtime staleness is a heuristic, not a liveness verdict; the badge shows the age and the operator decides.

## Consequences

The board Remote is no longer read-only; `submitBrief` is its single write and both package READMEs now say so. The two-sided contract (flag names, output JSON) is pinned by prose here and by the motherboard's storecli tests there; joint live verification through the deployed console is the integration step that seals it.

## Testing

Fork: `tsc -b tsconfig.client.json` + full `build:lib` (the host face regenerates the Typert remote client with the new method); oxlint on the package (only the pre-existing sibling `usePolledLoad` finding remains). No package vitest exists for these two packages. Live UI verification against a booted evolution runtime is deliberately left to the orchestrated joint test with the motherboard's `submit_brief` subcommand.
