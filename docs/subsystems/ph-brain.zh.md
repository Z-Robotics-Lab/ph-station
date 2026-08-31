# PH Brain

[English](ph-brain.md) | 中文

[`@deepseek-ai/dsh-ph-brain`](../../packages/host/dsh-ph-brain) 是本 fork 的 LLM 规划器：一个 Remote，把一个任务（mission）拆成一串取自 harness skill index 的技能，并按实测成功率为每个技能挑 executor。runtime 引导会把 skill index 写到 `<session>/skill_index.json`；`plan` 读这一个文件作上下文，调用一次 DeepSeek 的 chat-completions API（key 经 credentials 面解析，从不存在这里），返回解析后的计划。驾驶舱的大脑面板随后把计划通过 `ctx.board`（`submitBrief` → `briefStatus`）派发，并带有界的失败重规划——本包做规划，board 是唯一的执行门。

规划器对实测数据诚实：当某个必需技能的所有 executor 都是空记录或低成功率时，它保留该步、把 `executor` 设为 `null` 并标记 operator，而不是绕过它。纯粹的请求拼装与回复解析在 [`packages/host/dsh-ph-brain/src/planner.ts`](../../packages/host/dsh-ph-brain/src/planner.ts)；wire 类型：[`packages/host/dsh-ph-brain/src/types.ts`](../../packages/host/dsh-ph-brain/src/types.ts)。

来源：[`packages/host/dsh-ph-brain/src/index.ts`](../../packages/host/dsh-ph-brain/src/index.ts)

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
