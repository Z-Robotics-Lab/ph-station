/** `phlivegraph` namespace dictionaries: the 执行图谱 merged-graph tab label and
 * the graph / scrubber / evidence copy. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'phlivegraph'

/** The phlivegraph dictionary key set (source of truth for both locales). */
export type PhLiveGraphKey =
  | 'view.livegraph'
  | 'sub'
  | 'loading'
  | 'unavailable'
  | 'sealedFallback'
  | 'emptyGraph'
  | 'idle'
  | 'running'
  | 'done'
  | 'failed'
  | 'goal'
  | 'replans'
  | 'steps'
  | 'faults'
  | 'duration'
  | 'attempt'
  | 'args'
  | 'node'
  | 'stages'
  | 'status'
  | 'verify'
  | 'current'
  | 'privileged'
  | 'showRouting'
  | 'routingHint'
  | 'live'
  | 'history'
  | 'liveOn'
  | 'liveOff'
  | 'run'
  | 'play'
  | 'pause'
  | 'legend.pending'
  | 'legend.running'
  | 'legend.verified'
  | 'legend.failed'
  | 'legend.replanned'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 执行图谱 merged execution-graph panel copy. */
    'phlivegraph': PhLiveGraphKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<PhLiveGraphKey, string> = {
  'view.livegraph': '执行图谱',
  'sub': '计划 · 执行路线 · 当前步 · 结果，一张图看全',
  'loading': '加载中…',
  'unavailable': '数据面不可用（board bridge 未挂载）',
  'sealedFallback': '实时流不可用（运行时早于 runtime_events）— 显示链上最后一次任务',
  'emptyGraph': '还没有任务在跑。在下方输入框发一条任务（如 stack 抓取），这里会实时长出规划图和执行路线。',
  'idle': '空闲',
  'running': '执行中',
  'done': '完成',
  'failed': '失败',
  'goal': '目标',
  'replans': '重规划',
  'steps': '步数',
  'faults': '故障',
  'duration': '耗时',
  'attempt': '尝试',
  'args': '参数',
  'node': '节点',
  'stages': '阶段',
  'status': '状态',
  'verify': '验证谓词',
  'current': '当前',
  'privileged': '特权',
  'showRouting': '显示能力接线',
  'routingHint': '把能力路由（消费方→能力→提供方）叠加到图上',
  'live': 'LIVE',
  'history': 'HISTORY',
  'liveOn': '实时跟随中：显示最新事件',
  'liveOff': '已暂停在历史某刻，点此跳回实时',
  'run': '运行',
  'play': '播放',
  'pause': '暂停',
  'legend.pending': '待执行',
  'legend.running': '执行中',
  'legend.verified': '已验证',
  'legend.failed': '失败',
  'legend.replanned': '已重规划',
}

/** English dictionary. */
export const en: Record<PhLiveGraphKey, string> = {
  'view.livegraph': 'Execution Graph',
  'sub': 'Plan · route · current step · result, one canvas',
  'loading': 'Loading…',
  'unavailable': 'Data plane unavailable (board bridge not mounted)',
  'sealedFallback': 'Live feed unavailable (runtime pre-dates runtime_events) — showing the last sealed task',
  'emptyGraph': 'No task is running yet. Send a task (e.g. a stack grasp) in the composer below and the plan and execution route will grow here live.',
  'idle': 'idle',
  'running': 'running',
  'done': 'done',
  'failed': 'failed',
  'goal': 'goal',
  'replans': 'replans',
  'steps': 'steps',
  'faults': 'faults',
  'duration': 'duration',
  'attempt': 'attempt',
  'args': 'args',
  'node': 'node',
  'stages': 'stages',
  'status': 'status',
  'verify': 'verify predicate',
  'current': 'current',
  'privileged': 'privileged',
  'showRouting': 'show wiring',
  'routingHint': 'Overlay capability routing (consumer → capability → provider)',
  'live': 'LIVE',
  'history': 'HISTORY',
  'liveOn': 'Following live: showing the newest events',
  'liveOff': 'Paused at a past moment — click to jump back to live',
  'run': 'run',
  'play': 'play',
  'pause': 'pause',
  'legend.pending': 'pending',
  'legend.running': 'running',
  'legend.verified': 'verified',
  'legend.failed': 'failed',
  'legend.replanned': 'replanned',
}
