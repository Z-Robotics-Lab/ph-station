# PH Brain

English | [中文](ph-brain.zh.md)

[`@deepseek-ai/dsh-ph-brain`](../../packages/host/dsh-ph-brain) is this fork's LLM planner: a Remote that turns a mission into an ordered plan of skills drawn from the harness skill index, choosing each executor by measured success rate. The runtime boot writes the skill index to `<session>/skill_index.json`; `plan` reads that one file as context, calls DeepSeek's chat-completions API once (the key resolved through the credentials seam, never held here), and returns the parsed plan. The cockpit's 大脑 panel then dispatches the plan through `ctx.board` (`submitBrief` → `briefStatus`) with bounded replan-on-failure — this package plans, the board is the one execution door.

The planner is honest about the measurements: when every executor for a needed skill has a null or low record, it keeps the step with `executor: null` and flags the operator rather than routing around it. The pure request assembly and reply parsing live in [`packages/host/dsh-ph-brain/src/planner.ts`](../../packages/host/dsh-ph-brain/src/planner.ts); wire types: [`packages/host/dsh-ph-brain/src/types.ts`](../../packages/host/dsh-ph-brain/src/types.ts).

Source: [`packages/host/dsh-ph-brain/src/index.ts`](../../packages/host/dsh-ph-brain/src/index.ts)

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxbrain--brain"></a>

### `ctx.brain` — `Brain`

Remote planner over DeepSeek's chat-completions API. One method, `plan`; the gateway auto-serves it at POST /api/brain/plan.

```ts cordis-catalog
/**
 * Decompose a mission into a plan of harness skills, choosing each executor by
 * measured success. Reads `<runsDir>/<session>/skill_index.json` as context
 * and calls the model once; on a replan the caller passes the prior failures.
 * @param mission - the operator's mission text.
 * @param session - runtime session whose skill index to read (e.g. `session-main`).
 * @param priorFailuresJson - JSON array of prior failed attempts, or `''`/`'[]'`
 * on the first turn; forwarded to the model verbatim as failure evidence.
 * @returns a {@link BrainPlan} as JSON (`steps`/`flags`/`note`), or the same
 * shape with an `error` key when the index is missing, the credential is
 * unconfigured, or the model call fails.
 */
@Remote('plan') async plan(mission: string, session: string, priorFailuresJson: string): Promise<JsonValue>
```

Source: [`packages/host/dsh-ph-brain/src/index.ts`](../../packages/host/dsh-ph-brain/src/index.ts)
<!-- END GENERATED cordis-surface -->
