# Agent Note: the operator rail shows the host's own headroom

Status: implemented

English | [中文](2026-08-28-host-vitals-in-the-operator-rail.zh.md)

## Problem

Every live face the cockpit owns reads the *harness*: session chains, the runtime status file, the event feed, the viewport frame. None reads the *box the harness runs on*. A resident runtime died to a full 4090 while the operator watched the rail report 模式 execution / 心跳 3s — every harness signal healthy right up to the moment VRAM ran out. The operator works only in the browser and never opens a terminal, so `nvidia-smi` was not an available diagnosis; the first sign of the ceiling was the runtime already gone.

## Decision

A new board face, `host_vitals(path)`, and a `hostVitals` row set at the bottom of the rail's 运行体征 card: per-GPU VRAM with the compute processes holding it, physical RAM, and free space on the filesystem holding `runs/`.

The harness owns every number. `board/store.py` runs two `nvidia-smi --query-… --format=csv,noheader,nounits` reads and joins them on the GPU uuid (`--query-compute-apps` carries no index column, so uuid is the only key that pairs a process with its card), reads `/proc/meminfo` for `MemTotal − MemAvailable`, and calls `os.statvfs` — no new Python dependency, no `psutil`, no `pynvml`. It also ranks each card's processes biggest-first, so the panel names the top consumer without sorting anything: the charter's rule that statistics live in `board/`.

This is live state on the `runtime_status` footing — never a chain row, never sealed evidence, and it never raises. A missing `nvidia-smi`, a timeout, a nonzero exit, an unparsable `/proc/meminfo`, or a dead path degrade to an empty `gpu` list or zeros. A host with no NVIDIA driver is a normal deployment, not an outage, and a failed probe must leave a gap in one card rather than take the poll down.

Three faces stay byte-identical (`board/store.py`, `board/storecli.py`, `board/mcp_server.py`), so the chat LLM and the panel read the same dict. The bridge method takes no argument — the reading is host-addressed, not session-addressed — and the gateway auto-serves it at `POST /api/board/hostVitals`.

The rail polls it on its own 5s cadence rather than the shared 15s evidence cadence, and folds its own failure: a `hostVitals` read that fails clears only these rows, leaving the mission cards live. TypeScript picks a colour from the fraction (≥90% red, ≥75% amber) and nothing else — no command, no derived number.

## Alternatives considered

**A GPU metrics dependency (`pynvml`, `psutil`).** Rejected: `nvidia-smi`, `/proc/meminfo`, and `statvfs` are three short reads, and a runtime dependency added to the harness venv for a status panel is a new failure mode on the machine the panel exists to watch.

**Raise the whole rail's poll to 5s.** Rejected: the evidence-layer reads spawn a Python `storecli` subprocess each, and session chains change at run speed. Only the host numbers move on their own — nothing writes to the board when VRAM fills — so only they need the faster tick.

**Compute the warning thresholds board-side.** Rejected: a threshold is a display choice, not a statistic. The board would have to ship a verdict the panel could only re-render, and a second deployment wanting a different cutoff would need a harness change.

**Fail loud when `nvidia-smi` is absent.** Rejected against the repo's general misconfiguration-fails-loud rule: this face is a live sample, in the family that already reads an absent `runtime_status.json` as `null`. A CPU-only box is a supported deployment, so an empty `gpu` list is the honest answer, not an error.

## Consequences

The rail issues one extra board call every 5s, which costs one `storecli` subprocess and one `nvidia-smi` pair per tick — the same order as the existing per-poll reads, and paused with them while the tab is hidden. The operator sees a card at 94% turn red with `sglang::scheduler` named beside it before the next task claims the runtime.

The GPU/RAM/disk rows use the existing `meterTrack`/`meterFill` meter from the progress card instead of new glyph-led `VitalRow`s, so the vendored tabler icon subset gained nothing. `usePolledLoad` took an optional cadence parameter, defaulting to the unchanged `POLL_MS`; its `ui-ph-panels` twin is untouched.

## Testing

`tests/test_host_vitals.py` in the harness repo (4 tests, base lane 662 → 666) monkeypatches both host reads and covers the uuid join with its biggest-first ranking, the `MemTotal − MemAvailable` read, the three-face byte equivalence with `ts` pinned, and the degradation contract — missing binary, timeout, nonzero exit, unparsable `/proc/meminfo`, dead path — each asserted to yield an empty list or zeros rather than an exception.

`packages/client/ui-ph-ops/tests/operator-rail.client.spec.tsx` gains the warning case: a card at 23000/24564 MiB renders `94%`, exactly one fail-hued meter fill, and the process name, while RAM at 30% and disk at 88% stay out of that hue.
