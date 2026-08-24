/** `phlivegraph` namespace dictionaries: the 执行图 tab label and graph copy. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'phlivegraph'

/** The phlivegraph dictionary key set (source of truth for both locales). */
export type PhLiveGraphKey =
  | 'view.livegraph'
  | 'loading'
  | 'unavailable'
  | 'noSession'
  | 'liveFeed'
  | 'sealedFallback'
  | 'idle'
  | 'running'
  | 'done'
  | 'failed'
  | 'goal'
  | 'task'
  | 'seed'
  | 'replans'
  | 'steps'
  | 'routing'
  | 'plan'
  | 'privileged'
  | 'legend.pending'
  | 'legend.running'
  | 'legend.verified'
  | 'legend.failed'
  | 'legend.replanned'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 执行图 live execution-graph panel copy. */
    'phlivegraph': PhLiveGraphKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<PhLiveGraphKey, string> = {
  'view.livegraph': '执行图',
  'loading': '加载中…',
  'unavailable': '数据面不可用（board bridge 未挂载）',
  'noSession': '无运行时会话',
  'liveFeed': '实时流',
  'sealedFallback': '实时流不可用（运行时早于 runtime_events）— 显示链上最后一次任务',
  'idle': '空闲',
  'running': '执行中',
  'done': '完成',
  'failed': '失败',
  'goal': '目标',
  'task': '任务',
  'seed': '种子',
  'replans': '重规划',
  'steps': '步数',
  'routing': '能力路由',
  'plan': '任务计划',
  'privileged': '特权',
  'legend.pending': '待执行',
  'legend.running': '执行中',
  'legend.verified': '已验证',
  'legend.failed': '失败',
  'legend.replanned': '已重规划',
}

/** English dictionary. */
export const en: Record<PhLiveGraphKey, string> = {
  'view.livegraph': 'Live Graph',
  'loading': 'Loading…',
  'unavailable': 'Data plane unavailable (board bridge not mounted)',
  'noSession': 'No runtime session',
  'liveFeed': 'live feed',
  'sealedFallback': 'Live feed unavailable (runtime pre-dates runtime_events) — showing the last sealed task',
  'idle': 'idle',
  'running': 'running',
  'done': 'done',
  'failed': 'failed',
  'goal': 'goal',
  'task': 'task',
  'seed': 'seed',
  'replans': 'replans',
  'steps': 'steps',
  'routing': 'capability routing',
  'plan': 'task plan',
  'privileged': 'privileged',
  'legend.pending': 'pending',
  'legend.running': 'running',
  'legend.verified': 'verified',
  'legend.failed': 'failed',
  'legend.replanned': 'replanned',
}
