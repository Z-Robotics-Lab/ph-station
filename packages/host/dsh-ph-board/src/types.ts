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

/** A brief-status read: the brief id in a runtime session, with an optional
 * long-poll budget for the state to change. */
export interface BoardBriefStatusRequest {
  /** The brief id `submitBrief` returned (its `submitted` field). */
  readonly briefId: string
  /** Runtime session directory name; storecli rejects a traversal name. */
  readonly session: string
  /** Long-poll budget in ms: storecli blocks up to this long (capped
   * board-side) for the brief's STATE to change before answering; waiting out
   * the cap is not an error, the reply just still reads `running`. Omitted or 0
   * answers immediately. */
  readonly waitMs?: number
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
