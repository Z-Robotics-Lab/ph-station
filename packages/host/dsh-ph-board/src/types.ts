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
