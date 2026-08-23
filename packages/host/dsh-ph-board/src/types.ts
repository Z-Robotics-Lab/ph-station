/** Wire types for the board Remote. @module @deepseek-ai/dsh-ph-board/types */

/** A name-addressed store read: the direct child name under runs/. */
export interface BoardStoreRequest {
  /** Campaign store directory name; storecli rejects a traversal name. */
  readonly name: string
}
