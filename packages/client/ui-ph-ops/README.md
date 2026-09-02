# @deepseek-ai/dsh-client-ui-ph-ops

English | [中文](README.zh.md)

physical-harness operator rail + mission cockpit. Two browser surfaces that read the harness evidence layer through the board Remote and render only:

- **Mission cockpit** — a `conversation.view` tab (任务图). The graph-first view of the running mission: goal → task node → stage pipeline plus the capability-wiring fan, one interactive React Flow DAG (pan/zoom, minimap, click-to-select). A run-history strip switches between sealed task attempts; clicking a node opens its evidence (stages, faults, provider `ref`) beside the graph. Status color is the established three (green pass / red fail / neutral pending), so it reads as one system with 战报/演进/账本.
- **Skills page** — a `conversation.view` tab (技能): one table over the board's `skills` fold (record name, embodiment bindings, executor keys, evidence count, limits, failure modes); a row expands to its per-executor evidence.
- **Evolve page** — a `conversation.view` tab (演化): the lightweight evolve loop, visible / stoppable / resumable. Lists the session's evolve campaigns (`rsiRun` for every task the runtime feed saw claimed, plus those started here), starts one from a task name alone (`submitBrief` with `{"kind":"evolve","task"}`; every other field is the runtime's default), and for the picked campaign shows its rounds, the `rsiSeries` success-count line chart as inline SVG (no chart library), the `rsiFrames` media paths of one round, and this brief's lines of `runtimeEvents`. Stop is `cancelBrief` on the open brief; resume resubmits the same brief (the runtime continues from campaign.json's cursor).
- **Operator rail** — a `sidebar.section` occupant: a persistent stack of at-a-glance cards (mission mini-map, progress, runtime vitals, evolution ticker) answering "where is the mission / is it progressing / is the machine healthy / is it getting better" without a click. Collapses to status dots when the sidebar is an icon rail.

Every number comes from `board.store` — the Python `session_progress` fold and the session chain — through the board Host Remote (`sessionProgress`, `session`, `sessions`, `runtimeStatus`, `runtimeEvents`, `hostVitals`, `modelServer`, `policyServer`, `restartServices`, `health`, `stores`, `rounds`). No statistics are computed here (the charter's audited hard rule: the fork renders, Python aggregates). The vitals card also carries the host's own headroom from `hostVitals` — per-GPU VRAM with the process holding it, RAM, and free disk — on its own 5s poll, because those move without a board write to follow and a full card kills the resident runtime; above 90% the meter turns red. The thresholds pick a colour, never a number. Beneath the VRAM meter that explains it, the card carries the only control on this surface: `modelServer` starts and stops the box's local model server, badged stopped / loading / running (`running` without `healthy` is the 1-2 minute load) with the button held down until a poll confirms the switch. It switches the service process only — which model a request routes to stays the model selector's choice — and the rail passes a literal action word; the whitelist, the launcher path, and the kill guard are all `board.store`'s. Beside it, `policyServer` is the same switch for the pi0.5 policy server (badged not started / running (not serving) / serving, with the short checkpoint sha) as explicit Start / Stop buttons, noted as not started by default, ~18 GB VRAM, and unable to coexist with the local model. Last, `restartServices` restarts the harness services behind an in-widget two-step confirm (the first click arms the button, a second click within 8s fires; never `window.confirm`) with a rebuild-console-first checkbox; after firing, the card shows a restarting line and polls `health` (after a short grace, since the helper answers before the console goes down) until the console answers again, then shows the `restart` row's state and last line. The rail reads `runtimeEvents` only to tell a still-open run from a settled one — the board's own `task_claimed` / `task_done` / `task_failed` markers, read verbatim, never a verdict computed here.

## Dependencies

Two net-new runtime deps, both MIT, justified against the redesign spec (`physical-harness/docs/ph-ui-redesign.md` §5):

- **`@xyflow/react`** (React Flow v12) — the interactive mission DAG: custom status-colored nodes, pan/zoom, minimap, controlled selection for click-to-drill. Hand-rolling this in SVG is the larger diff and worse interaction/a11y. React Flow renders its own DOM subtree, so it does not inherit the panel language; `ops.module.css` overrides its `--xy-*` variables against `currentColor` (which flips with the app theme) and sets `colorMode="system"`.
- **`@dagrejs/dagre`** — layered DAG layout feeding React Flow (which does not auto-position). Small and sufficient for our single-digit-to-dozens node counts.

## Model Experience

None, as both surfaces render board Remote state for the browser operator and the chat LLM reads the same `board.store` functions through the MCP server.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Evolve media are paths, not pictures.** `rsiFrames` returns session-relative paths and no board face serves the bytes, so the evolve page lists them; thumbnails and inline video wait for a byte-serving face.
- **The evolve campaign list follows the runtime feed.** Campaigns are found by calling `rsiRun` for each task in the per-boot `runtimeEvents` feed, so a campaign claimed before the last reboot stays hidden until its task is started again from this page; a campaigns-directory listing face would remove that gap.

- **Live in-flight state.** The cockpit shows the last *sealed* `task.plan_complete` tree, not interim stage progress. The operational feed (`runtime_events.jsonl`, read by `board.store.read_runtime_events`) already drives the rail's mission card between a live/running render and its settled (收场) final line; animating the cockpit graph's in-flight node from that same feed is still deferred.
- **Settled dwell is fixed.** After a run seals, the mission card's final line lingers `SETTLE_MS` (30s) before yielding to idle; a new run re-reveals it. Fixed constant, not config — expose it only if an operator asks.
- **Node evidence renders inline** in the cockpit rather than routing to the right-hand `details` slot. Cross-slot session-scoped selection wiring is deferred; the inline panel is self-contained.
- **Per-poll board calls.** The rail drives seven board reads per 15s poll (sessions, session, session_progress, runtime_status, runtime_events, stores, rounds), each a cold `board.storecli` subprocess. Fine at human cadence on tiny stores; batch into one read fn if poll latency is ever measured to matter.
- **Cards are not individually collapsible.** The section scrolls as a whole; add per-card collapse if the rail grows.
