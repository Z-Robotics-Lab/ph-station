# Agent Note: The VLM brain plans a mission and dispatches it through the board

Status: implemented

English | [中文](2026-08-31-vlm-brain-planner.zh.md)

## Problem

The physical-harness cockpit could read the evidence layer (the board Remote) and the chat agent could dispatch briefs one at a time through the MCP tools, but nothing turned a whole mission into a plan of skills chosen against the measured library. An operator wanting "stack the block" had to decompose it by hand, pick which executor to run per skill from the vault numbers, submit each brief, poll it, and decide what to do when one failed. The skill index the runtime already writes at boot (`<session>/skill_index.json`) is exactly the one-read planning context for that job, and it was going unused by any GUI surface.

## Decision

A new host Remote, `@deepseek-ai/dsh-ph-brain` (`ctx.brain`, served at `POST /api/brain/plan`), is the planner. `plan(mission, session, priorFailuresJson)` reads `<runsDir>/<session>/skill_index.json` as context, calls DeepSeek's OpenAI-compatible `/chat/completions` once, and returns `{steps, flags, note}` (or the same shape with `error`). The model may only select skill names present in the index, picks each executor by the record with the highest measured success, and draws brief seeds from the scratch window `[420000, 439999]` so a dispatch never burns the irreversible seed ledger. When every executor for a needed skill has a null or low record (place is `0/10` on both `scripted` and `pi0.5`), the planner keeps the step with `executor: null` and flags the operator instead of routing around it — the prompt states the measurements are honest and that flagging an unreliable skill is correct, not a failure. The prompt also refuses rather than improvises: an empty mission, or one needing an action no skill in the index provides (e.g. washing, folding), returns empty steps with the gap flagged instead of a repurposed pick-and-place chain.

The model backend is the deployment's already-configured DeepSeek route: the API key is resolved per request through the credentials seam (`ctx.get('credentials')`, reference `DEEPSEEK_API_KEY`, the same reference `llm-deepseek` uses), never held on the config or logged; the model id defaults to the deployment route (`PH_BRAIN_MODEL` overrides). The plugin is wired into the web-app bundle beside the board bridge, shares `PH_BOARD_RUNS`, and disables itself without it so a plain `dsh web` still boots.

The GUI is the deliverable: the `大脑` console is a `sidebar.section` in `ui-ph-ops`. It runs the bounded loop over the existing transport — decompose → `board.submitBrief` → `board.briefStatus` → replan-on-failure, at most 3 replans — and renders each step's live state and the operator flags. The board bridge gains `briefStatus` (a verbatim `storecli brief_status` forward) for the watch half. The loop's pure core (`planner-loop.ts`) and the planner's request/parse half (`planner.ts`) are framework-free and unit-tested against a labeled `skill_index.json` fixture; the Remote owns the file read, credential resolution, and the one network call.

## Alternatives considered

- **Reuse the `llm` capability seam** (the `deepseek-official` adapter) for the planning call. Rejected: that seam is built for streaming, Session-bound agent conversations; a single non-streaming JSON completion is a direct OpenAI-compatible `fetch`, and dragging in the agent-loop machinery for it is the "no multi-turn agent framework" the mission ruled out.
- **Run the dispatch loop host-side** in the brain so it survives a closed tab. Deferred: the operator watches in the GUI, the submitted brief keeps running in the runtime regardless, and `briefStatus` is durable, so re-opening the panel and re-planning resumes cleanly. A resident host loop waits for an unattended-run need.
- **Add the planner to the board bridge.** Rejected: the board's charter is verbatim forwarding with zero interpretation; an LLM planner is interpretation and belongs in its own plugin.

## Consequences

The cockpit now has a mission-level planning surface that is honest about the data — a `0/10` skill surfaces as an operator decision, not a silent reroute. The cost is a second fork-only host plugin and a browser-driven loop that stops if the tab closes (the run does not). Each `plan` call re-sends the whole (compact) skill index with no cross-call cache; a replan re-sends it plus the accumulated failures.

## Testing

`packages/host/dsh-ph-brain/tests/planner.spec.ts` covers request assembly over the real skill-index shape and tolerant reply parsing (fenced JSON, budget clamp, null-executor retention, unparseable/malformed → error plan). `packages/client/ui-ph-ops/tests/planner-loop.client.spec.ts` covers the loop: advance-on-done, flag-a-null-executor-without-dispatch, stop after `MAX_REPLANS`, no-recovery-plan, and submit-error. The live GUI path against a booted session and a real DeepSeek call is the operator's UI test. `packages/host/dsh-ph-brain/bench/` is a plan-side benchmark: 10 missions across five classes (canonical/paraphrase/bilingual, partial, out-of-index, the place trap, adversarial) × 5 trials against the real DeepSeek endpoint and the committed fixture, scoring schema-validity, skill-hallucination, executor-choice, unreliable-skill handling, ordering, refusal, and adversarial resistance with committed raw JSONL and summary tables. That benchmark is what exposed and verified the refusal hardening above (empty-mission refusal 1/5 → 5/5).
