/** `phops` namespace dictionaries: the mission-cockpit tab + the operator-rail
 * card copy (mission graph, progress, runtime vitals, evolution ticker). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'phops'

/** The phops dictionary key set (source of truth for both locales). */
export type PhOpsKey =
  | 'view.mission'
  | 'loading'
  | 'unavailable'
  | 'noSession'
  | 'idle'
  // cockpit
  | 'goal'
  | 'runs'
  | 'run'
  | 'graph.execution'
  | 'graph.wiring'
  | 'graph.empty'
  | 'stages'
  | 'node'
  | 'stage'
  | 'capability'
  | 'provider'
  | 'privileged'
  | 'consumer'
  | 'selectNode'
  | 'chain'
  | 'faults'
  | 'noFaults'
  | 'replans'
  | 'actuations'
  | 'success'
  | 'failure'
  // rail section + cards
  | 'rail.title'
  | 'card.mission'
  | 'card.progress'
  | 'card.vitals'
  | 'card.evolution'
  | 'tasks'
  | 'stagePass'
  | 'taskErrors'
  | 'mode'
  | 'modeUnknown'
  | 'heartbeat'
  | 'ago'
  | 'skills'
  | 'mountPlan'
  | 'viewfinder'
  | 'on'
  | 'off'
  | 'pid'
  | 'latestRound'
  | 'noRounds'
  | 'promoted'
  | 'noCampaign'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The mission cockpit tab + operator-rail card copy. */
    'phops': PhOpsKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<PhOpsKey, string> = {
  'view.mission': '任务图',
  'loading': '加载中…',
  'unavailable': '数据面不可用（board bridge 未挂载）',
  'noSession': '无会话',
  'idle': '空闲',
  'goal': '目标',
  'runs': '任务运行',
  'run': '运行',
  'graph.execution': '执行图（任务 › 节点 › 阶段）',
  'graph.wiring': '能力接线',
  'graph.empty': '暂无已封存的任务运行',
  'stages': '阶段',
  'node': '节点',
  'stage': '阶段',
  'capability': '能力',
  'provider': '提供方',
  'privileged': '特权',
  'consumer': '消费方',
  'selectNode': '点击图中节点查看证据',
  'chain': '链路构成',
  'faults': '故障',
  'noFaults': '无故障',
  'replans': '重规划',
  'actuations': '驱动次数',
  'success': '成功',
  'failure': '失败',
  'rail.title': '运行台',
  'card.mission': '任务小图',
  'card.progress': '进度',
  'card.vitals': '运行体征',
  'card.evolution': '演进',
  'tasks': '任务',
  'stagePass': '阶段通过率',
  'taskErrors': '拒绝的简报',
  'mode': '模式',
  'modeUnknown': '未知',
  'heartbeat': '心跳',
  'ago': '前',
  'skills': '技能',
  'mountPlan': '挂载计划',
  'viewfinder': '取景窗',
  'on': '开',
  'off': '关',
  'pid': 'pid',
  'latestRound': '最新轮次',
  'noRounds': '无轮次',
  'promoted': '晋级',
  'noCampaign': '暂无战役',
}

/** English dictionary. */
export const en: Record<PhOpsKey, string> = {
  'view.mission': 'Mission',
  'loading': 'Loading…',
  'unavailable': 'Data plane unavailable (board bridge not mounted)',
  'noSession': 'no session',
  'idle': 'idle',
  'goal': 'Goal',
  'runs': 'Task runs',
  'run': 'run',
  'graph.execution': 'Execution (task › node › stage)',
  'graph.wiring': 'Capability wiring',
  'graph.empty': 'No sealed task run yet',
  'stages': 'stages',
  'node': 'Node',
  'stage': 'Stage',
  'capability': 'Capability',
  'provider': 'Provider',
  'privileged': 'privileged',
  'consumer': 'consumer',
  'selectNode': 'Click a node in the graph to see its evidence',
  'chain': 'Chain composition',
  'faults': 'Faults',
  'noFaults': 'No faults',
  'replans': 'replans',
  'actuations': 'actuations',
  'success': 'success',
  'failure': 'failure',
  'rail.title': 'Operations',
  'card.mission': 'Mission map',
  'card.progress': 'Progress',
  'card.vitals': 'Runtime vitals',
  'card.evolution': 'Evolution',
  'tasks': 'Tasks',
  'stagePass': 'Stage pass rate',
  'taskErrors': 'Rejected briefs',
  'mode': 'MODE',
  'modeUnknown': 'unknown',
  'heartbeat': 'Heartbeat',
  'ago': 'ago',
  'skills': 'skills',
  'mountPlan': 'mount plan',
  'viewfinder': 'Viewfinder',
  'on': 'on',
  'off': 'off',
  'pid': 'pid',
  'latestRound': 'Latest round',
  'noRounds': 'no rounds',
  'promoted': 'promoted',
  'noCampaign': 'no campaign',
}
