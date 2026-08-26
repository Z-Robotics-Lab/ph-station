# Agent Note: Live campaign progress card reads a heartbeat file, not the runtime

Status: implemented

English | [中文](2026-08-26-campaign-progress-live-card.zh.md)

## Problem

Script-path batteries (`probe_kitchen_thaw.py` and its campaign siblings) run OUTSIDE the resident runtime by the harness's two-state discipline, so they emit no `runtime_events.jsonl` and no live feed the console can watch. A 150-episode calibration takes ~14 minutes during which the 演进 panel shows nothing; the operator only sees the sealed store afterwards. The fix had to add a live surface without turning render state into evidence and without moving statistics into TypeScript.

## Decision

The harness motherboard writes `runs/<store>/progress.json` (atomic temp + `os.replace`, per finished episode, exceptions swallowed so a dead heartbeat never kills a battery) with done/total/timestamps/label plus the rolling stats folded python-side (success count, first-death histogram). `board.store.campaign_progress` scans the heartbeats and computes the `running` flag (fresh under 120s AND done < total); all three faces (storecli, MCP, the `campaignProgress` Remote here) forward the same dict, byte-equivalence pinned in the motherboard's `tests/test_campaign_progress.py`. `EvolutionView` renders 进行中 cards from it verbatim: the only TS arithmetic is the progress-bar width and the ETA, a pure display conversion of the python-provided `started_ts`/`updated_ts`/`done`. The heartbeat read alone tightens to a 5s interval while a campaign is running; the panel keeps its shared 15s cadence otherwise, and the cards render nothing (no reserved space) when no campaign is live.

## Alternatives considered

**Route campaigns through the resident runtime to reuse `runtime_events`.** Rejected: the two-state discipline deliberately keeps campaign batteries out of the runtime (fresh kernels per episode under a worker pool); bending it for a progress bar inverts the architecture.

**Fold the first-death histogram / running judgement in TypeScript.** Rejected: the charter's standing red line — statistics live in `board/` Python, the fork renders verbatim (same rule that shaped `sessionProgress`).

**A push channel (SSE/long poll) for progress.** Rejected: episodes complete every few seconds; a 5s interval over the existing execFile face is indistinguishable to the operator and adds no new transport. The `runtimeFrame` serve-worker precedent applies only when a measured spawn cost caps a frame rate.

## Consequences

A finished or crashed battery leaves its last `progress.json` in the store dir; the board reports it `running: false` and the card disappears, but the file itself lingers as harmless live-state residue beside the sealed evidence. If a future battery finishes episodes faster than the 120s freshness window assumes, the constant sits in one place (`board/store.py::_PROGRESS_RUNNING_S`).

## Testing

Motherboard: `tests/test_campaign_progress.py` (writer atomicity + never-raise, tracker fold, running/stale/done split, empty runs, three-face byte equivalence); base-gate snapshot refreshed same-commit. Fork: typecheck + build; live verification against the deployed console with a synthetic heartbeat (screenshot archived in the motherboard's `local-archive/robocasa-adapt/progress-card/`).
