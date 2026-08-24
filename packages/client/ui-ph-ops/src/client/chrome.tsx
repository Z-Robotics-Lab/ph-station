/** A jargon label with a `?` badge that reveals a plain-language tooltip on
 * hover/focus, for the operator rail's stat labels. Kept local to this package —
 * the ph panel packages stay decoupled rather than share a chrome library. */

/* jscpd:ignore-start */
import type { ReactNode } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './ops.module.css'

/**
 * @param label - the visible term (string or node).
 * @param tip - the plain-Chinese one-liner shown in the tooltip bubble.
 */
export function Term({ label, tip }: { label: ReactNode; tip: string }) {
  return (
    <Tooltip label={tip} side="top" maxWidth={320}>
      <span className={css.term} tabIndex={0}>{label}<sup className={css.termMark}>?</sup></span>
    </Tooltip>
  )
}
/* jscpd:ignore-end */
