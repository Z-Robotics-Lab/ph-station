/** `battle` namespace dictionaries for the 战报 panel: tab label + one-line
 * subtitle, an empty-state explainer, jargon tooltips, and field labels. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'battle'

/** The battle dictionary key set (the source of truth for both locales). */
export type BattleKey =
  | 'view.battle'
  | 'sub.battle'
  | 'loading'
  | 'empty'
  | 'unavailable'
  | 'stores'
  | 'task'
  | 'generations'
  | 'promoted'
  | 'rejected'
  | 'heldout'
  | 'heldoutBadge'
  | 'noHeldout'
  | 'judgementPass'
  | 'judgementFail'
  | 'prereg'
  | 'alpha'
  | 'devN'
  | 'heldoutN'
  | 'block'
  | 'generation'
  | 'devGate'
  | 'blindGate'
  | 'delta'
  | 'mcnemar'
  | 'pValue'
  | 'rule'
  | 'vsBlind'
  | 'blocks'
  | 'selectStore'
  // jargon tooltips (plain-Chinese one-liners, hover a `?` badge)
  | 'mcnemar.tip'
  | 'heldout.tip'
  | 'promoted.tip'
  | 'delta.tip'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 战报 view tab label, subtitle, and field labels. */
    'battle': BattleKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<BattleKey, string> = {
  'view.battle': 'Held-out 战报',
  'sub.battle': '最近一次 campaign 的 held-out 结果：promoted 判定与统计显著性',
  'loading': '加载中…',
  'empty': 'runs/ 下暂无 campaign。此面板汇总最近一次 campaign 在 held-out 上的成绩与 promoted 判定。',
  'unavailable': '战报数据面不可用（board bridge 未挂载）',
  'stores': 'Campaigns',
  'task': '任务',
  'generations': '代',
  'promoted': '通过 (promoted)',
  'rejected': '未通过',
  'heldout': '留出',
  'heldoutBadge': '留出判定',
  'noHeldout': '无留出结果',
  'judgementPass': '通过',
  'judgementFail': '未过',
  'prereg': '预注册',
  'alpha': 'α',
  'devN': 'dev n',
  'heldoutN': 'held-out n',
  'block': '区块',
  'generation': '代',
  'devGate': 'dev 门',
  'blindGate': 'blind 门',
  'delta': 'Δpp',
  'mcnemar': 'McNemar (修复/破坏)',
  'pValue': 'p 值',
  'rule': '规则',
  'vsBlind': 'vs blind',
  'blocks': '留出区块',
  'selectStore': '选择一个 campaign 查看详情',
  'mcnemar.tip': "McNemar 检验：只看被改动'修对'和'改坏'的题，判断这代改动是不是真变好（而非运气）。",
  'heldout.tip': '留出集：训练时从没见过的题，用来诚实检验泛化，防止背答案刷分。',
  'promoted.tip': '通过（promoted）：这一代过了 dev / blind / held-out 三道门槛，被采纳为新基线。',
  'delta.tip': 'Δpp：相对上一代的成功率变化，单位百分点。',
}

/** English dictionary. */
export const en: Record<BattleKey, string> = {
  'view.battle': 'Battle',
  'sub.battle': "The latest campaign's held-out result: promotion verdict and statistical significance.",
  'loading': 'Loading…',
  'empty': "No campaigns under runs/. The battle report summarizes the latest campaign's held-out result and promotion verdict.",
  'unavailable': 'Battle data plane unavailable (board bridge not mounted)',
  'stores': 'Campaigns',
  'task': 'Task',
  'generations': 'Gens',
  'promoted': 'promoted',
  'rejected': 'rejected',
  'heldout': 'held-out',
  'heldoutBadge': 'Held-out gate',
  'noHeldout': 'No held-out result',
  'judgementPass': 'PASS',
  'judgementFail': 'FAIL',
  'prereg': 'Prereg',
  'alpha': 'α',
  'devN': 'dev n',
  'heldoutN': 'held-out n',
  'block': 'block',
  'generation': 'Gen',
  'devGate': 'dev gate',
  'blindGate': 'blind gate',
  'delta': 'Δpp',
  'mcnemar': 'McNemar (fixed/broken)',
  'pValue': 'p-value',
  'rule': 'rule',
  'vsBlind': 'vs blind',
  'blocks': 'Held-out blocks',
  'selectStore': 'Select a campaign to see details',
  'mcnemar.tip': 'McNemar test: looks only at items this generation fixed vs broke, to judge whether the change is truly better (not luck).',
  'heldout.tip': 'Held-out set: items never seen during training, used to honestly check generalization and prevent memorized answers.',
  'promoted.tip': 'Promoted: this generation passed the dev / blind / held-out gates and became the new baseline.',
  'delta.tip': 'Δpp: change in success rate vs the previous generation, in percentage points.',
}
