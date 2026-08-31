# @deepseek-ai/dsh-ph-brain

English | [中文](README.zh.md)

physical-harness fork brain: a Typert Remote (`brain`) that turns a mission into an ordered plan of skills drawn from the harness skill index, choosing each executor by measured success rate. The gateway auto-serves its one method at `POST /api/brain/plan`; the cockpit's 大脑 panel calls it, and dispatches the resulting plan through `ctx.board` (`submitBrief` → `briefStatus`) — the one execution door the harness exposes. This package plans; it never dispatches.

At session start the runtime boot writes the skill index to `<runsDir>/<session>/skill_index.json` (`scripts/harness_runtime.py`, `harness.skill_record.skill_index`). `plan(mission, session, priorFailuresJson)` reads that one file as context, builds a request (the skill index + the mission + the brief grammar + any prior failures), calls DeepSeek's OpenAI-compatible `/chat/completions` once, and returns the parsed `{steps, flags, note}` (or the same shape with an `error` key). The API key is resolved per request through the credentials seam (`ctx.get('credentials')`, reference `DEEPSEEK_API_KEY`); it is never held on the config, echoed in a result, or logged.

The planning rule is honest about the measurements. Each record under a skill carries `measured.successes` of `measured.n` and a `binding`; the planner picks the highest-success record and sets `executor` to its digest. When every executor for a needed skill has `n=0` or a low success rate (place is `0/10` on both `scripted` and `pi0.5` right now), the planner does **not** route around it: it keeps the step with `executor: null` and adds an operator flag. Flagging an unreliable skill is correct behavior, not a routing failure. The planner may only select skill names present in the index, and draws brief seeds from the scratch window `[420000, 439999]` so a dispatch never burns the irreversible seed ledger.

The pure request assembly and reply parsing live in `src/planner.ts` (unit-tested on a labeled `skill_index.json` fixture in `tests/`); the Remote in `src/index.ts` owns the filesystem read, the credential resolution, and the network call.

## Config

- `runsDir` — campaign `runs/` directory holding `<session>/skill_index.json` (required; the cockpit injects `PH_BOARD_RUNS`).
- `model` — chat-completions model id (required; the cockpit defaults it to the deployment's DeepSeek route, overridable with `PH_BRAIN_MODEL`).
- `apiKeyEnv` — credential reference resolved per request (default `DEEPSEEK_API_KEY`).
- `baseURL` — endpoint base (default `https://api.deepseek.com`; `$DEEPSEEK_BASE_URL` overrides at request time).
- `timeoutMs` — per-request timeout (default 60000).

The cockpit's bundle row disables this plugin when `PH_BOARD_RUNS` is absent, so a plain `dsh web` still boots (the panel then reports the brain unavailable).

## Model Experience

One non-streaming chat-completions request per `plan` call. The system prompt fixes the decomposition rule and the brief grammar; the user message carries the skill index JSON, the mission, and any prior failures. `response_format` is `json_object` and `temperature` is 0, so the reply is one JSON object parsed into a plan. No session, no tools, no multi-turn loop — the bounded replan loop lives in the cockpit panel over this method plus the board.

#### KV Cache effect

Each call sends the whole skill index and mission fresh with no cross-call cache; a replan re-sends the index plus the accumulated failures. The index is compact by design (no evidence blobs) so it fits one context window.

## Known Limitations and Deferred Work

- The bounded dispatch loop (submit → watch → replan, max 3) runs in the browser panel (`ui-ph-ops`), not here, so it stops if the operator closes the tab; the submitted brief keeps running in the runtime regardless, and `briefStatus` is durable, so re-opening the panel and re-planning resumes cleanly. A resident host-side loop is deferred until an unattended run needs one.
- The planner trusts the model to select only in-index skill names; an invented name is dispatched as a task brief and hard-fails in the runtime rather than being rejected here (the harness stays the sole authority over what a brief means).
