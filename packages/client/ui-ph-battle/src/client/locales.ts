/** `battle` namespace dictionaries for the 战报 panel (tab label + field labels). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'battle'

/** The battle dictionary key set (the source of truth for both locales). */
export type BattleKey =
  | 'view.battle'
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

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 战报 view tab label and field labels. */
    'battle': BattleKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<BattleKey, string> = {
  'view.battle': '战报',
  'loading': '加载中…',
  'empty': 'runs/ 下暂无战役',
  'unavailable': '战报数据面不可用（board bridge 未挂载）',
  'stores': '战役',
  'task': '任务',
  'generations': '代',
  'promoted': '晋级',
  'rejected': '未晋级',
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
  'selectStore': '选择一个战役查看详情',
}

/** English dictionary. */
export const en: Record<BattleKey, string> = {
  'view.battle': 'Battle',
  'loading': 'Loading…',
  'empty': 'No campaigns under runs/',
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
}
