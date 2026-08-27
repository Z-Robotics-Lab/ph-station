/** `phlivegraph` namespace dictionaries: the 执行图谱 merged-graph tab label and
 * the graph / scrubber / evidence copy. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'phlivegraph'

/** The phlivegraph dictionary key set (source of truth for both locales). */
export type PhLiveGraphKey =
  | 'view.livegraph'
  | 'view.lab'
  | 'sub'
  | 'process'
  | 'processSub'
  | 'tickerEmpty'
  | 'tk.claimed'
  | 'tk.planned'
  | 'tk.replan'
  | 'tk.enter'
  | 'tk.stage'
  | 'tk.pass'
  | 'tk.fail'
  | 'tk.act'
  | 'tk.stepsUnit'
  | 'tk.verified'
  | 'tk.failed'
  | 'tk.done'
  | 'tk.taskFailed'
  | 'tk.current'
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
  | 'showFull'
  | 'showFullHint'
  | 'pendingMore'
  | 'keys'
  | 'live'
  | 'history'
  | 'liveOn'
  | 'liveOff'
  | 'run'
  | 'experiment'
  | 'replay'
  | 'play'
  | 'pause'
  | 'legend.pending'
  | 'legend.running'
  | 'legend.verified'
  | 'legend.failed'
  | 'legend.replanned'
  | 'sessionPick'
  | 'viewport'
  | 'viewportPick'
  | 'viewportFollow'
  | 'viewportAgo'
  | 'viewportNoFrame'
  | 'viewportWaiting'
  | 'fit'
  | 'minimapShow'
  | 'minimapHide'
  | 'relayout'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 执行图谱 merged execution-graph panel copy. */
    'phlivegraph': PhLiveGraphKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<PhLiveGraphKey, string> = {
  'view.livegraph': '执行图谱',
  'view.lab': '图谱·过程流',
  'sub': '计划 · 执行路线 · 当前步 · 结果，一张图看全',
  'process': '过程流',
  'processSub': '本次任务的事件时间线：规划→节点→阶段→结果',
  'tickerEmpty': '任务一开跑，这里就按时间列出：规划完成 → 进入节点 → 阶段通过/失败 → 结果。',
  'tk.claimed': '领取任务',
  'tk.planned': '规划完成',
  'tk.replan': '重规划',
  'tk.enter': '进入节点',
  'tk.stage': '阶段',
  'tk.pass': '通过',
  'tk.fail': '失败',
  'tk.act': '执行',
  'tk.stepsUnit': '步',
  'tk.verified': '节点通过',
  'tk.failed': '节点失败',
  'tk.done': '任务完成',
  'tk.taskFailed': '任务失败',
  'tk.current': '当前',
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
  'showFull': '显示完整计划',
  'showFullHint': '关闭渐进显露，一次铺开整张计划图（含尚未执行的节点）',
  'pendingMore': '待执行',
  'keys': '键盘：空格 播放/暂停 · ←→ 逐帧 · [ ] 切换实验 · Esc 收起证据',
  'live': 'LIVE',
  'history': 'HISTORY',
  'liveOn': '实时跟随中：显示最新事件',
  'liveOff': '已暂停在历史某刻，点此跳回实时',
  'run': '运行',
  'experiment': '实验',
  'replay': '回放',
  'play': '播放',
  'pause': '暂停',
  'legend.pending': '待执行',
  'legend.running': '执行中',
  'legend.verified': '已验证',
  'legend.failed': '失败',
  'legend.replanned': '已重规划',
  'sessionPick': '切换会话（● 有运行时）',
  'viewport': '取景窗',
  'viewportPick': '固定看某个 session（默认跟随共享选择）',
  'viewportFollow': '跟随',
  'viewportAgo': '前',
  'viewportNoFrame': '该 session 从未产出画面：runtime 启动时没带 --frames，或任务/标定还没跑过。',
  'viewportWaiting': '等待画面…',
  'fit': '适应',
  'minimapShow': '显示缩略图',
  'minimapHide': '收起缩略图',
  'relayout': '重新布局（清除手动调整）',
}

/** English dictionary. */
export const en: Record<PhLiveGraphKey, string> = {
  'view.livegraph': 'Execution Graph',
  'view.lab': 'Graph · Flow',
  'sub': 'Plan · route · current step · result, one canvas',
  'process': 'Process',
  'processSub': 'This task’s event timeline: plan → node → stage → result',
  'tickerEmpty': 'Once a task runs it lists here in order: plan built → node entered → stage passed/failed → result.',
  'tk.claimed': 'claimed',
  'tk.planned': 'plan built',
  'tk.replan': 'replan',
  'tk.enter': 'enter node',
  'tk.stage': 'stage',
  'tk.pass': 'passed',
  'tk.fail': 'failed',
  'tk.act': 'actuated',
  'tk.stepsUnit': 'steps',
  'tk.verified': 'node verified',
  'tk.failed': 'node failed',
  'tk.done': 'task done',
  'tk.taskFailed': 'task failed',
  'tk.current': 'current',
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
  'showFull': 'show full plan',
  'showFullHint': 'Turn off progressive reveal and lay out the whole plan at once (including not-yet-run nodes)',
  'pendingMore': 'pending',
  'keys': 'Keys: Space play/pause · ←→ step · [ ] switch run · Esc close evidence',
  'live': 'LIVE',
  'history': 'HISTORY',
  'liveOn': 'Following live: showing the newest events',
  'liveOff': 'Paused at a past moment — click to jump back to live',
  'run': 'run',
  'experiment': 'Experiment',
  'replay': 'REPLAY',
  'play': 'play',
  'pause': 'pause',
  'legend.pending': 'pending',
  'legend.running': 'running',
  'legend.verified': 'verified',
  'legend.failed': 'failed',
  'legend.replanned': 'replanned',
  'sessionPick': 'Switch session (● has runtime)',
  'viewport': 'Viewport',
  'viewportPick': 'Pin to one session (default: follow the shared selection)',
  'viewportFollow': 'Follow',
  'viewportAgo': 'ago',
  'viewportNoFrame': 'This session never produced a frame: the runtime was started without --frames, or no task/calibration has run yet.',
  'viewportWaiting': 'Waiting for a frame…',
  'fit': 'Fit',
  'minimapShow': 'Show minimap',
  'minimapHide': 'Hide minimap',
  'relayout': 'Re-layout (clear manual edits)',
}
