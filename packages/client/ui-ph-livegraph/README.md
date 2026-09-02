# @deepseek-ai/dsh-client-ui-ph-livegraph

English | [中文](README.zh.md)

执行图 — the live execution-graph panel for the physical-harness console. One `conversation.view` tab composing three layers over the newest runtime session:

- **capability routing** — the session chain's `capability.resolve` rows (consumer → capability → provider ref), deduped to the current mount;
- **task plan** — `plan_built`'s full node graph from the operational feed, or the newest sealed `task.plan_complete` when the feed is absent;
- **live state** — node/stage lifecycle animated from the board Remote's `runtimeEvents` incremental feed (`runs/<session>/runtime_events.jsonl`, written by `harness.opstream`; truncated per boot, `last_seq < cursor` means reboot → reset and re-read).

Pure consumer: every status is copied verbatim from board payloads; the fold (`src/client/graph.ts`) assembles rendering state and computes nothing (charter: TS renders only). Poll cadence is ~1.5s while a task is in flight, ~8s idle, paused while the document is hidden. The 取景窗 viewport panel instead LONG-POLLS the board's `runtimeFrame` face (`afterTs` cursor + `waitMs` ≈0.9s server-side block), re-issuing the moment a reply lands, so its to-hand frame rate tracks the harness frame-dump rate. Its download button fetches the latest completed task's disposable `rollout.mp4` through `runtimeRollout`; the video is never interpreted or promoted to evidence. The 过程流 ticker hangs a keyframe thumbnail on any row whose event `seq` has an image on disk (`runs/<session>/keyframes/<seq:06d>-<kind>.jpg`, dropped by `harness.opstream` and cleared at `opstream.arm()` with the feed): it polls the byte-free index (`runtimeKeyframes`, ~3s) and fetches a row's JPEG (`runtimeKeyframe`) only when that thumbnail first intersects the scroll viewport or is clicked, never in bulk. Clicking opens a lightbox that walks the run's other keyframed rows with ←/→ (capture-phase, so the scrubber keys stay quiet) and closes on Esc. The event `seq` already on every ticker row is the whole join — a session with no keyframes renders exactly as before.

Session scoping: the panels auto-follow the newest live runtime session and show only what arrives after the mounting conversation first opened them, because the runtime feed is global and would otherwise replay the previous conversation's runs. The header picker groups discovered sessions into live runtimes and archived stores off the board's own `runtime.boot` marker; a session picked by hand replays in full.

Graph rendering is `@xyflow/react` (React Flow v12, MIT) with `@dagrejs/dagre` (MIT) layered layout — the component pair sanctioned by `physical-harness/docs/ph-ui-redesign.md` §5, shared with the mission-cockpit redesign so both surfaces speak one graph idiom. React Flow's structural stylesheet is vendored at `src/client/xyflow-base.css` (MIT, from `@xyflow/react/dist/style.css`) and injected through the `?inline` channel for the plugin lifetime, because the client bundler's CSS pipeline is package-local.

## Model Experience

None, as the panel renders the board Remote's operational feed for the browser operator and touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- The vendored `xyflow-base.css` must be refreshed when `@xyflow/react` is upgraded (the bundler's `?inline` channel does not resolve `node_modules` specifiers).
- The feed's per-conversation seq floor lives in page memory: a reload re-blanks every conversation, and a conversation reopened in a new tab starts from that tab's tail. Persisting it needs a store the panels do not own.
- Stage events are attributed to the currently running node by feed order (the resident runtime processes briefs serially); concurrent tasks would need a node id on `stage_transition`.
