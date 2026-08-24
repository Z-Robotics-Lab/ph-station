/** Panel chrome for the 战报 tab: a self-explanatory title + one-line subtitle
 * head, an empty-state explainer card, and a jargon label with a `?` tooltip
 * badge. Kept local to this package — the ph panel packages stay decoupled
 * rather than share a chrome library (mirrors ui-ph-panels' own copy). */

/* jscpd:ignore-start */
import type { ReactNode } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './BattleView.module.css'

/** Title + one-line subtitle over a panel body; the body fills the rest. */
export function PanelFrame({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className={css.frame}>
      <div className={css.frameHead}>
        <span className={css.frameTitle}>{title}</span>
        <span className={css.frameSub}>{sub}</span>
      </div>
      {children}
    </div>
  )
}

/** An explainer shown in place of data when the panel has nothing to show yet. */
export function EmptyCard({ children }: { children: ReactNode }) {
  return <div className={css.emptyCard}>{children}</div>
}

/**
 * A jargon label with a hover/focus `?` badge revealing a plain-language tip.
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
