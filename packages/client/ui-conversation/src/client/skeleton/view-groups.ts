/** ph cockpit tab-strip taxonomy: which conversation.view entries are kept out
 * of the flat tab strip (still registered — docked by the 实验台 dashboard and
 * embedded by the unified RSI page — just not shown as their own top tab), and
 * which visible tab belongs to which operator-facing group. Kept beside the
 * strip render as the same kind of central id map as VIEW_TAB_ICONS; a build
 * contributing its own views is unaffected (an unmapped id defaults to the
 * execution group and is shown). */

/** conversation.view entry ids kept out of the tab strip: the standalone
 * 执行图谱/过程流 (superseded by the combined 图谱·过程流 `lab`) and the 严格评测
 * launcher + 战报/迭代记录/账本 panels the unified RSI page embeds under its
 * collapsed strict-evaluation section. All stay registered for docking. */
export const HIDDEN_STRIP_VIEW_IDS: ReadonlySet<string> = new Set([
  'livegraph', 'ticker', 'rsi-strict', 'battle', 'evolution', 'ledger',
])

/** The two operator-facing halves of the cockpit: harness execution vs RSI evolution. */
export type ViewGroup = 'exec' | 'evo'

/** Visible tab id → its group. Unmapped ids fall in `exec` (shown, leftmost). */
export const VIEW_GROUP: Readonly<Record<string, ViewGroup>> = {
  dash: 'exec',
  lab: 'exec',
  chat: 'exec',
  trajectory: 'exec',
  viewport: 'exec',
  rsi: 'evo',
  vault: 'evo',
}
