/** Wire types for the brain Remote. @module @deepseek-ai/dsh-ph-brain/types */

/**
 * One row of a skill's records in `skill_index.json`: the digest that names the
 * sealed SkillRecord, the provider `binding` a task brief would select, the
 * preconditions/effects the harness composes edges over, and the honest
 * measured tally (`successes` of `n`, nulls included). Mirrors
 * `harness.skill_record.skill_index()`; read as data, never reconstructed.
 */
export interface SkillIndexRecord {
  readonly digest: string
  readonly binding: Record<string, unknown>
  readonly preconditions: readonly string[]
  readonly effects: readonly string[]
  readonly measured: { readonly successes: number; readonly n: number }
}

/**
 * The planner's one-read view of the library: `skills` maps a selectable
 * catalogue name to its records, `edges` are set-containment links the harness
 * computed. This is the exact JSON the runtime boot writes to
 * `<session>/skill_index.json`.
 */
export interface SkillIndex {
  readonly skills: Record<string, readonly SkillIndexRecord[]>
  readonly edges: ReadonlyArray<{ readonly from: string; readonly to: string; readonly via: readonly string[] }>
}

/**
 * One planned step the model decomposed the mission into. `task` is a name that
 * MUST exist in the skill index; `executor` is the chosen binding digest (or
 * `null` when no executor for that skill has a trustworthy measured record —
 * that is a decision to flag the operator, not a routing failure). The budgets
 * are the brief's; `seed` is a scratch seed (never a ledger block).
 */
export interface BrainStep {
  readonly task: string
  readonly executor: string | null
  readonly seed: number
  readonly max_replans: number
  readonly max_actuations: number
  readonly rationale: string
}

/**
 * The model's decomposition of a mission. `steps` is the ordered plan; `flags`
 * are operator-facing warnings (an unreliable skill, a mission the index cannot
 * cover); `note` is a one-line summary. On failure the same reply carries
 * `error` and no steps.
 */
export interface BrainPlan {
  readonly steps: readonly BrainStep[]
  readonly flags: readonly string[]
  readonly note: string
  readonly error?: string
}
