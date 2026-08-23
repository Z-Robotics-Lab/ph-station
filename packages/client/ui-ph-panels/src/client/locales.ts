/** `phpanels` namespace dictionaries: tab labels + field labels for the
 * 演进 / 机箱 / 账本 panels and the status bar. One namespace, four views. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'phpanels'

/** The phpanels dictionary key set (source of truth for both locales). */
export type PhPanelsKey =
  | 'view.evolution'
  | 'view.cards'
  | 'view.ledger'
  | 'loading'
  | 'unavailable'
  // 演进
  | 'stores'
  | 'selectStore'
  | 'generations'
  | 'noGenerations'
  | 'promoted'
  | 'rejected'
  | 'generation'
  | 'devDelta'
  | 'blindDelta'
  | 'heldoutDelta'
  | 'mcnemar'
  | 'rule'
  | 'rounds'
  | 'noRounds'
  // 机箱
  | 'noCards'
  | 'actuation'
  | 'needsSim'
  | 'yes'
  | 'no'
  | 'contributes'
  | 'mounts'
  | 'taskBindings'
  | 'campaigns'
  | 'bundles'
  | 'thirdParty'
  | 'doctor'
  | 'doctorNotWired'
  // 账本
  | 'noLedger'
  | 'range'
  | 'state'
  | 'source'
  | 'burned'
  | 'reserved'
  | 'planned'
  // status bar
  | 'mode'
  | 'modeUnknown'
  | 'active'
  | 'ago'
  | 'boardOnline'
  | 'boardOffline'
  | 'skills'
  | 'mountPlan'
  | 'noSession'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 演进/机箱/账本 tab labels, field labels, and status-bar copy. */
    'phpanels': PhPanelsKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<PhPanelsKey, string> = {
  'view.evolution': '演进',
  'view.cards': '机箱',
  'view.ledger': '账本',
  'loading': '加载中…',
  'unavailable': '数据面不可用（board bridge 未挂载）',
  'stores': '战役',
  'selectStore': '选择一个战役查看代际演进',
  'generations': '代际',
  'noGenerations': '无代际记录',
  'promoted': '晋级',
  'rejected': '未晋级',
  'generation': '代',
  'devDelta': 'dev Δpp',
  'blindDelta': 'blind Δpp',
  'heldoutDelta': 'held-out Δpp',
  'mcnemar': 'McNemar (修复/破坏)',
  'rule': '规则',
  'rounds': '轮次',
  'noRounds': 'progress.md 无轮次',
  'noCards': '暂无机箱卡',
  'actuation': '驱动',
  'needsSim': '需要仿真',
  'yes': '是',
  'no': '否',
  'contributes': '贡献',
  'mounts': '挂载',
  'taskBindings': '任务绑定',
  'campaigns': '战役',
  'bundles': '套件',
  'thirdParty': '第三方',
  'doctor': '体检',
  'doctorNotWired': '未接入',
  'noLedger': 'STATUS.md 无区块预算',
  'range': '区块',
  'state': '状态',
  'source': '来源',
  'burned': '已烧',
  'reserved': '预留',
  'planned': '计划',
  'mode': '模式',
  'modeUnknown': '未知',
  'active': '活跃',
  'ago': '前',
  'boardOnline': 'board 在线',
  'boardOffline': 'board 离线',
  'skills': '技能',
  'mountPlan': '挂载计划',
  'noSession': '无会话',
}

/** English dictionary. */
export const en: Record<PhPanelsKey, string> = {
  'view.evolution': 'Evolution',
  'view.cards': 'Chassis',
  'view.ledger': 'Ledger',
  'loading': 'Loading…',
  'unavailable': 'Data plane unavailable (board bridge not mounted)',
  'stores': 'Campaigns',
  'selectStore': 'Select a campaign to see its generation evolution',
  'generations': 'Generations',
  'noGenerations': 'No generation records',
  'promoted': 'promoted',
  'rejected': 'rejected',
  'generation': 'Gen',
  'devDelta': 'dev Δpp',
  'blindDelta': 'blind Δpp',
  'heldoutDelta': 'held-out Δpp',
  'mcnemar': 'McNemar (fixed/broken)',
  'rule': 'rule',
  'rounds': 'Rounds',
  'noRounds': 'No rounds in progress.md',
  'noCards': 'No chassis cards',
  'actuation': 'actuation',
  'needsSim': 'needs sim',
  'yes': 'yes',
  'no': 'no',
  'contributes': 'Contributes',
  'mounts': 'mounts',
  'taskBindings': 'task bindings',
  'campaigns': 'campaigns',
  'bundles': 'bundles',
  'thirdParty': 'third-party',
  'doctor': 'Doctor',
  'doctorNotWired': 'not wired',
  'noLedger': 'No block budget in STATUS.md',
  'range': 'Range',
  'state': 'State',
  'source': 'Source',
  'burned': 'burned',
  'reserved': 'reserved',
  'planned': 'planned',
  'mode': 'MODE',
  'modeUnknown': 'unknown',
  'active': 'active',
  'ago': 'ago',
  'boardOnline': 'board online',
  'boardOffline': 'board offline',
  'skills': 'skills',
  'mountPlan': 'mount plan',
  'noSession': 'no session',
}
