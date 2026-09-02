/** Wire types for the board Remote. @module @deepseek-ai/dsh-ph-board/types */

/** A name-addressed store read: the direct child name under runs/. */
export interface BoardStoreRequest {
  /** Campaign store directory name; storecli rejects a traversal name. */
  readonly name: string
}

/** A name-addressed runtime-session read: the direct child name under runs/. */
export interface BoardSessionRequest {
  /** Runtime session directory name; storecli rejects a traversal name. */
  readonly name: string
}

/** A name-addressed runtime-events read with an incremental poll cursor. */
export interface BoardRuntimeEventsRequest {
  /** Runtime session directory name; storecli rejects a traversal name. */
  readonly name: string
  /** Return only events with seq > afterSeq; omitted or 0 reads the whole feed. */
  readonly afterSeq?: number
}

/** A name-addressed runtime-frame read with the poller's timestamp cursor. */
export interface BoardRuntimeFrameRequest {
  /** Runtime session directory name; storecli rejects a traversal name. */
  readonly name: string
  /** The frame `ts` last displayed; an unchanged file returns the short
   * `{unchanged, ts, age_s}` reply with no image bytes. Omitted or 0 reads the
   * full frame. */
  readonly afterTs?: number
  /** Long-poll budget in ms: storecli blocks up to this long (capped
   * board-side at 2s) for the frame to change past `afterTs` before answering,
   * so a viewport that re-issues on reply tracks the writer's frame rate with
   * zero idle polling. Omitted or 0 answers immediately. */
  readonly waitMs?: number
}

/** A keyframe still read: the session plus the runtime-events seq it is pinned to. */
export interface BoardRuntimeKeyframeRequest {
  /** Runtime session directory name; storecli rejects a traversal name. */
  readonly name: string
  /** The `runtime_events` seq whose still to fetch; a seq holding none returns
   * `{error: 'no keyframe'}`. */
  readonly seq: number
}

/** A vault node read: the content-addressed node id (skill digest, package dir, or capability seam). */
export interface BoardVaultNodeRequest {
  /** Node id; an unknown id returns board.vault's {error: 'unknown node'} dict. */
  readonly id: string
}

/** A vault adjacency read: one node id, optionally restricted to a single relation. */
export interface BoardVaultNeighborsRequest {
  /** Node id; an unknown id returns board.vault's {error: 'unknown node'} dict. */
  readonly id: string
  /** Restrict adjacency to one `rel` (DESCENDS_FROM, GOVERNS, REQUIRES, …); omitted returns all. */
  readonly relation?: string
}

/** A natural-language planning request. Read-only: the harness plans, validates,
 * and expands the chain but executes nothing and writes nothing. */
export interface BoardPlanSkillTaskRequest {
  /** The task in natural language (bounded harness-side like a brief instruction). */
  readonly instruction: string
  /** Runtime session a later execute would route to; default `session-robocasa`. */
  readonly session?: string
  /** Pin one vocabulary (`robocasa_skill_graph` or a task name) instead of retrieval routing; default `auto`. */
  readonly channel?: string
  /** `false` skips the server-side leaf expansion; default expands. */
  readonly expand?: boolean
  /** Task seed; default the harness scratch seed (never burns the ledger). */
  readonly seed?: number
}

/** Execute a `plan_skill_task` result: the `composite_plan` record, re-verified harness-side. */
export interface BoardSubmitSkillPlanRequest {
  /** The `composite_plan` object as a JSON string, forwarded verbatim; the harness re-validates it from scratch. */
  readonly plan: string
  /** Runtime session whose inbox receives the brief; default `session-robocasa`. */
  readonly session?: string
  /** Task seed; default the harness scratch seed. */
  readonly seed?: number
  /** Brief budget override. */
  readonly maxReplans?: number
  /** Brief budget override. */
  readonly maxActuations?: number
}

/** A brief lifecycle call addressed by session and brief id. */
export interface BoardBriefRequest {
  /** Runtime session directory name; storecli rejects a traversal name. */
  readonly session: string
  /** The brief id a submit handed back (`brief-<hex>.json`). */
  readonly briefId: string
  /** `briefStatus` only: long-poll up to this many ms for the state to change (capped board-side). */
  readonly waitMs?: number
}
