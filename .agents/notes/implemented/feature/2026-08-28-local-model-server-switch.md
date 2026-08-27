# Agent Note: the operator starts and stops the local model from the browser

Status: implemented

English | [中文](2026-08-28-local-model-server-switch.zh.md)

## Problem

The console's local backbone is a 27B on llama.cpp holding roughly 19 GB of a 24 GB card. Bringing a simulator up behind it means freeing that VRAM first, and putting it back means starting the server again — two `~/models/launch_llamacpp.sh` invocations and a `kill` that only exist in a terminal. The operator has a browser and nothing else. The `hostVitals` rows added the same day made the ceiling visible without offering anything to do about it.

The model *route* was never the missing piece: the console's model selector already lists both `deepseek-official` and `local-qwen`. Only the process was unreachable.

## Decision

`model_server(action)` on the board (`status` / `start` / `stop`) and a `modelServer` bridge method, rendered as one row directly under the VRAM meter that explains why it exists: a phase badge and a single button.

The board owns everything that executes. The launcher is the module constant `_MODEL_SCRIPT`; the action word is the entire caller-supplied surface, whitelisted to three values. A path or a command line accepted from a caller would be remote code execution on the harness box, reachable from a browser tab.

Process identity is `/proc/<pid>/exe`, not argv. The launcher's own here-doc in an editor's command line carries both `llama-server` and `--port 30001`, so an argv match would have adopted — and later killed — a text editor. `start` adopts a live server rather than spawning a second, and otherwise spawns with `start_new_session` (setsid) after a runtime died to a group-wide teardown mid-campaign on 2026-08-28. `stop` sends SIGTERM to one pid, recorded in `runs/model-server.pid`, only if it still proves that identity at kill time; a recycled or garbage record refuses. No pattern kill — one matched its own killer in this repo's history.

`running` with `healthy` false is the 1-2 minute load window: the server holds its port long before it answers `/v1/models`. Without that middle badge the whole load reads as "stopped" and invites a second start.

The UI renders and forwards, nothing else. The phase comes off the board's two booleans, the button hands back a literal action word, and a click sets a pending flag that holds the button disabled until a poll confirms the process actually changed — or reports an `error`, which hands the button back rather than disabling the only control forever. Copy on the row states the division of labour in both languages: this switches the service process; which model a request routes to is the model selector's choice.

## Alternatives considered

**Accept a script path or command from the caller.** Rejected outright: the same rule that forbids a brief naming its provider. A board face reachable from the browser that runs a caller's string is a remote execution hole, and no amount of client-side sanitising changes where the trust boundary is.

**Kill by pattern (`pkill -f llama-server`).** Rejected: this repository has already lost a process to a pattern that matched the killer's own shell. The pidfile plus a re-checked `/proc/<pid>/exe` kills exactly one process or none.

**Trust the pidfile alone.** Rejected: the server running right now was started outside the cockpit and has no record, and a pid outlives the process it named. Identity by scan makes `status` truthful about an adopted server and makes `stop` safe about a recycled one; the pidfile records what this face started, and the guard is what authorises the kill.

**Fold the status into `host_vitals`.** Rejected: `host_vitals` never raises and never mutates, and the rail's only control must not ride a read that a missing NVIDIA driver already degrades. Separate faces also let a `hostVitals` outage leave the switch working — it is the operator's only way to free the card.

**Let the button also switch the model route.** Rejected: the selector already does that, and one control doing both would make "stop the server" ambiguous with "use the cloud". The row says so in its copy rather than guessing.

## Consequences

The rail issues one more board call every 5s on the existing vitals cadence. A `start` blocks for up to a second while the board waits for the launcher to reach its `exec`, so the reply names the real pid instead of reporting "not running" about a process it just spawned; loading continues for minutes after that and shows as the loading badge.

`model_server` is on all three faces, so the chat LLM can stop the server that answers it. That is deliberate — the tool is documented as a process switch and the console's other route stays available — but it is a real capability, not an accident of exposure.

`runs/model-server.pid` and `runs/model-server.log` join the runs tree. Neither passes `is_store` or `is_session`, so no listing sees them.

## Testing

`tests/test_model_server.py` in the harness repo (8 tests, base lane 666 → 674) fakes `/proc`, the health probe, and `nvidia-smi`. It covers the three status states with the VRAM join on our pid; the impostor case, where a shell mentioning the binary and the port is not adopted; the action whitelist, with `Popen` and `os.kill` trip-wired so a rejected action provably runs nothing; adopt-instead-of-spawn; the spawned argv and `start_new_session`; the SIGTERM on a matching pid; the refusal on a recycled or garbage pidfile; and three-face byte equivalence including the CLI's omitted argument reading rather than writing.

`packages/client/ui-ph-ops/tests/operator-rail.client.spec.tsx` gains four cases: the three badges with their button labels, the button held disabled through a stop that the board still reports as running, the error path handing the button back, and the switch surviving a dead `hostVitals`.

`storecli model_server status` was run against the live server on this box and reported `running`, `healthy`, pid, model path, and 21734 MiB. `start` was run against it too and adopted the running server without spawning a second. `stop` was NOT exercised on the live server: it is serving the operator's console.
