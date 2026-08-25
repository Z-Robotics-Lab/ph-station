# @deepseek-ai/dsh-client-ui-ph-ops

English | [中文](README.zh.md)

physical-harness operator rail + mission cockpit. Two browser surfaces that read the harness evidence layer through the board Remote and render only:

- **Mission cockpit** — a `conversation.view` tab (任务图). The graph-first view of the running mission: goal → task node → stage pipeline plus the capability-wiring fan, one interactive React Flow DAG (pan/zoom, minimap, click-to-select). A run-history strip switches between sealed task attempts; clicking a node opens its evidence (stages, faults, provider `ref`) beside the graph. Status color is the established three (green pass / red fail / neutral pending), so it reads as one system with 战报/演进/账本.
- **Operator rail** — a `sidebar.section` occupant: a persistent stack of at-a-glance cards (mission mini-map, progress, runtime vitals, evolution ticker) answering "where is the mission / is it progressing / is the machine healthy / is it getting better" without a click. Collapses to status dots when the sidebar is an icon rail.

Every number comes from `board.store` — the Python `session_progress` fold and the session chain — through the board Host Remote (`sessionProgress`, `session`, `sessions`, `runtimeStatus`, `stores`, `rounds`). No statistics are computed here (the charter's audited hard rule: the fork renders, Python aggregates).

## Dependencies

Two net-new runtime deps, both MIT, justified against the redesign spec (`physical-harness/docs/ph-ui-redesign.md` §5):

- **`@xyflow/react`** (React Flow v12) — the interactive mission DAG: custom status-colored nodes, pan/zoom, minimap, controlled selection for click-to-drill. Hand-rolling this in SVG is the larger diff and worse interaction/a11y. React Flow renders its own DOM subtree, so it does not inherit the panel language; `ops.module.css` overrides its `--xy-*` variables against `currentColor` (which flips with the app theme) and sets `colorMode="system"`.
- **`@dagrejs/dagre`** — layered DAG layout feeding React Flow (which does not auto-position). Small and sufficient for our single-digit-to-dozens node counts.

## Model Experience

None, as both surfaces render board Remote state for the browser operator and the chat LLM reads the same `board.store` functions through the MCP server.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Live in-flight state.** The cockpit shows the last *sealed* `task.plan_complete` tree, not interim stage progress. When the resident runtime writes its operational feed (`runtime_events.jsonl`, read by `board.store.read_runtime_events`), the graph can animate the in-flight node; today that feed is empty on this box, so the surface shows sealed state only — never invented liveness.
- **Node evidence renders inline** in the cockpit rather than routing to the right-hand `details` slot. Cross-slot session-scoped selection wiring is deferred; the inline panel is self-contained.
- **Per-poll board calls.** The rail drives six board reads per 15s poll (sessions, session, session_progress, runtime_status, stores, rounds), each a cold `board.storecli` subprocess. Fine at human cadence on tiny stores; batch into one read fn if poll latency is ever measured to matter.
- **Cards are not individually collapsible.** The section scrolls as a whole; add per-card collapse if the rail grows.
