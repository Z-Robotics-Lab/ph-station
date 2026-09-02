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
  | 'expand'
  | 'collapse'
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
  | 'settled'
  | 'nodesPassed'
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
  | 'vram'
  | 'ram'
  | 'disk'
  | 'diskFree'
  | 'noGpu'
  | 'modelServer'
  | 'modelServer.note'
  | 'model.off'
  | 'model.loading'
  | 'model.stopping'
  | 'model.on'
  | 'modelStart'
  | 'modelStop'
  | 'policyServer'
  | 'policyServer.note'
  | 'policy.off'
  | 'policy.running'
  | 'policy.serving'
  | 'policyStart'
  | 'policyStop'
  | 'restart'
  | 'restart.confirm'
  | 'restart.build'
  | 'restart.restarting'
  | 'restart.last'
  | 'on'
  | 'off'
  | 'pid'
  | 'latestRound'
  | 'noRounds'
  | 'promoted'
  | 'noCampaign'
  // jargon tooltips (plain-Chinese one-liners, hover a `?` badge)
  | 'stagePass.tip'
  | 'replan.tip'
  | 'promoted.tip'
  | 'privileged.tip'
  | 'mountPlan.tip'
  | 'viewfinder.tip'
  | 'vram.tip'
  | 'modelServer.tip'
  | 'policyServer.tip'
  // brain console
  | 'brain.title'
  | 'brain.session'
  | 'brain.mission'
  | 'brain.missionHint'
  | 'brain.plan'
  | 'brain.planning'
  | 'brain.dispatch'
  | 'brain.dispatching'
  | 'brain.noExecutor'
  | 'brain.completed'
  | 'brain.stopped'
  | 'brain.transportFail'
  | 'brain.bound'
  | 'brain.phase.dispatching'
  | 'brain.phase.watching'
  | 'brain.phase.done'
  | 'brain.phase.failed'
  | 'brain.phase.flagged'
  // skills + evolve pages
  | 'view.skills'
  | 'view.evolve'
  | 'skills.name'
  | 'skills.embodiments'
  | 'skills.executors'
  | 'skills.evidence'
  | 'skills.limits'
  | 'skills.failureModes'
  | 'skills.byExecutor'
  | 'skills.empty'
  | 'evolve.task'
  | 'evolve.taskHint'
  | 'evolve.start'
  | 'evolve.starting'
  | 'evolve.stop'
  | 'evolve.resume'
  | 'evolve.empty'
  | 'evolve.select'
  | 'evolve.round'
  | 'evolve.tried'
  | 'evolve.before'
  | 'evolve.after'
  | 'evolve.best'
  | 'evolve.published'
  | 'evolve.status'
  | 'evolve.seeds'
  | 'evolve.arm'
  | 'evolve.chart'
  | 'evolve.log'
  | 'evolve.noLog'
  | 'evolve.media'
  | 'evolve.noMedia'

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
  'expand': '展开阶段',
  'collapse': '收起阶段',
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
  'settled': '本次终局',
  'nodesPassed': '节点通过',
  'rail.title': '运行台',
  'card.mission': '任务小图',
  'card.progress': '进度',
  'card.vitals': '运行体征',
  'card.evolution': 'RSI',
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
  'vram': '显存',
  'ram': '内存',
  'disk': '磁盘',
  'diskFree': '可用',
  'noGpu': '无 GPU',
  'modelServer': '本地模型',
  'modelServer.note': '只启停服务进程；用哪个模型在模型选择器里选。',
  'model.off': '停止',
  'model.loading': '加载中',
  'model.stopping': '停止中',
  'model.on': '运行中',
  'modelStart': '启动本地模型',
  'modelStop': '停止',
  'policyServer': 'pi0.5 策略',
  'policyServer.note': '默认不启动；约占 18 GB 显存，不能与本地模型共存。',
  'policy.off': '未启动',
  'policy.running': '运行中（未就绪）',
  'policy.serving': '服务中',
  'policyStart': '启动 pi0.5',
  'policyStop': '停止 pi0.5',
  'restart': '重启服务',
  'restart.confirm': '再点一次确认重启',
  'restart.build': '重建控制台后重启',
  'restart.restarting': '重启中，等待控制台恢复…',
  'restart.last': '上次重启',
  'on': '开',
  'off': '关',
  'pid': 'pid',
  'latestRound': '最新轮次',
  'noRounds': '无轮次',
  'promoted': '通过 (promoted)',
  'noCampaign': '暂无 campaign',
  'stagePass.tip': '阶段通过率：所有节点的阶段里通过的比例。',
  'replan.tip': '重规划：某节点失败后，规划器重新出计划再试一次。',
  'promoted.tip': '通过（promoted）：这一代过了 dev / blind / held-out 三道门槛，被采纳为新基线。',
  'privileged.tip': '特权能力：能执行高风险/越权操作（如直接驱动硬件）的能力，需额外授权。',
  'mountPlan.tip': '挂载计划：本次启动装载的插件/技能组合的指纹（sha），用来确认跑的是哪一套配置。',
  'viewfinder.tip': '取景窗：机器人相机的实时画面渲染开关；开＝正在出图，关＝未渲染。',
  'vram.tip': '显存：GPU 上已占用/总量，下方是占得最多的进程。打满会直接打爆常驻 runtime，所以超过 90% 会变红。',
  'modelServer.tip': '本地模型：本机上跑的模型服务进程（llama.cpp，127.0.0.1:30001）。这个开关只启停这个进程，不决定请求发给谁——用云端还是本地，在模型选择器里选。停掉它能把上面那条显存还给仿真。加载要 1–2 分钟，期间显示“加载中”。',
  'policyServer.tip': 'pi0.5 策略：端口 8000 上的 VLA 策略服务进程，旁边是它加载的 checkpoint sha。默认不启动；约占 18 GB 显存，和本地模型不能同时跑。',
  'brain.title': '大脑',
  'brain.session': '会话',
  'brain.mission': '任务',
  'brain.missionHint': '用一句话描述要机器人完成的任务',
  'brain.plan': '规划',
  'brain.planning': '规划中…',
  'brain.dispatch': '派发',
  'brain.dispatching': '派发中…',
  'brain.noExecutor': '无可靠 executor',
  'brain.completed': '全部完成',
  'brain.stopped': '已停止',
  'brain.transportFail': '调用失败',
  'brain.bound': '失败自动重规划，上限 {n} 次',
  'brain.phase.dispatching': '派发',
  'brain.phase.watching': '执行中',
  'brain.phase.done': '完成',
  'brain.phase.failed': '失败',
  'brain.phase.flagged': '需人工',
  'view.skills': '技能',
  'view.evolve': '演化',
  'skills.name': '技能',
  'skills.embodiments': '具身绑定',
  'skills.executors': '执行器',
  'skills.evidence': '证据',
  'skills.limits': '限制',
  'skills.failureModes': '失败模式',
  'skills.byExecutor': '按执行器的证据',
  'skills.empty': '暂无技能记录',
  'evolve.task': '任务',
  'evolve.taskHint': '例如 kitchen_thaw',
  'evolve.start': '启动演化',
  'evolve.starting': '启动中…',
  'evolve.stop': '停止',
  'evolve.resume': '续跑',
  'evolve.empty': '暂无演化 campaign',
  'evolve.select': '点击一个 campaign 查看详情',
  'evolve.round': '轮次',
  'evolve.tried': '尝试',
  'evolve.before': '前',
  'evolve.after': '后',
  'evolve.best': '最佳',
  'evolve.published': '已发布',
  'evolve.status': '状态',
  'evolve.seeds': '种子',
  'evolve.arm': 'arm',
  'evolve.chart': '每轮成功计数（前 / 后 / 最佳）',
  'evolve.log': '运行日志',
  'evolve.noLog': '暂无该 brief 的日志',
  'evolve.media': '关键帧 / 视频',
  'evolve.noMedia': '该轮无保留媒体',
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
  'expand': 'expand stages',
  'collapse': 'collapse stages',
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
  'settled': 'Final',
  'nodesPassed': 'nodes passed',
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
  'vram': 'VRAM',
  'ram': 'RAM',
  'disk': 'Disk',
  'diskFree': 'free',
  'noGpu': 'no GPU',
  'modelServer': 'Local model',
  'modelServer.note': 'Switches the service process only; pick the model in the model selector.',
  'model.off': 'stopped',
  'model.loading': 'loading',
  'model.stopping': 'stopping',
  'model.on': 'running',
  'modelStart': 'Start local model',
  'modelStop': 'Stop',
  'policyServer': 'pi0.5 policy',
  'policyServer.note': 'Not started by default; ~18 GB VRAM, cannot coexist with the local model.',
  'policy.off': 'not started',
  'policy.running': 'running (not serving)',
  'policy.serving': 'serving',
  'policyStart': 'Start pi0.5',
  'policyStop': 'Stop pi0.5',
  'restart': 'Restart services',
  'restart.confirm': 'Click again to confirm restart',
  'restart.build': 'rebuild console first',
  'restart.restarting': 'restarting, waiting for the console…',
  'restart.last': 'last restart',
  'on': 'on',
  'off': 'off',
  'pid': 'pid',
  'latestRound': 'Latest round',
  'noRounds': 'no rounds',
  'promoted': 'promoted',
  'noCampaign': 'no campaign',
  'stagePass.tip': "Stage pass rate: the fraction of all nodes' stages that passed.",
  'replan.tip': 'Replan: after a node fails, the planner produces a new plan and retries.',
  'promoted.tip': 'Promoted: this generation passed the dev / blind / held-out gates and became the new baseline.',
  'privileged.tip': 'Privileged capability: one that can perform high-risk or elevated actions (e.g. drive hardware directly); needs extra authorization.',
  'mountPlan.tip': 'Mount plan: fingerprint (sha) of the plugin/skill set loaded at boot — confirms which configuration is running.',
  'viewfinder.tip': "Viewfinder: the robot camera's live render toggle; on = rendering frames, off = not.",
  'vram.tip': 'VRAM: used/total on the GPU, with the biggest consumer below. A full card kills the resident runtime, so above 90% turns red.',
  'modelServer.tip': 'Local model: the model service process on this box (llama.cpp, 127.0.0.1:30001). This switch only starts and stops that process — whether a request goes to the cloud or to local is the model selector’s choice. Stopping it returns the VRAM above to the simulator. Loading takes 1-2 minutes, shown as "loading".',
  'policyServer.tip': 'pi0.5 policy: the VLA policy server process on port 8000, with the checkpoint sha it loaded. Not started by default; it holds ~18 GB VRAM and cannot run beside the local model.',
  'brain.title': 'Brain',
  'brain.session': 'Session',
  'brain.mission': 'Mission',
  'brain.missionHint': 'Describe in one line what the robot should do',
  'brain.plan': 'Plan',
  'brain.planning': 'Planning…',
  'brain.dispatch': 'Dispatch',
  'brain.dispatching': 'Dispatching…',
  'brain.noExecutor': 'no reliable executor',
  'brain.completed': 'All steps completed',
  'brain.stopped': 'Stopped',
  'brain.transportFail': 'call failed',
  'brain.bound': 'Auto-replans on failure, up to {n}',
  'brain.phase.dispatching': 'dispatching',
  'brain.phase.watching': 'running',
  'brain.phase.done': 'done',
  'brain.phase.failed': 'failed',
  'brain.phase.flagged': 'needs operator',
  'view.skills': 'Skills',
  'view.evolve': 'Evolve',
  'skills.name': 'Skill',
  'skills.embodiments': 'Embodiments',
  'skills.executors': 'Executors',
  'skills.evidence': 'Evidence',
  'skills.limits': 'Limits',
  'skills.failureModes': 'Failure modes',
  'skills.byExecutor': 'Evidence by executor',
  'skills.empty': 'No skill records',
  'evolve.task': 'Task',
  'evolve.taskHint': 'e.g. kitchen_thaw',
  'evolve.start': 'Start evolve',
  'evolve.starting': 'Starting…',
  'evolve.stop': 'Stop',
  'evolve.resume': 'Resume',
  'evolve.empty': 'No evolve campaigns',
  'evolve.select': 'Pick a campaign to see its rounds',
  'evolve.round': 'Round',
  'evolve.tried': 'Tried',
  'evolve.before': 'before',
  'evolve.after': 'after',
  'evolve.best': 'best',
  'evolve.published': 'published',
  'evolve.status': 'Status',
  'evolve.seeds': 'Seeds',
  'evolve.arm': 'arm',
  'evolve.chart': 'Success count per round (before / after / best)',
  'evolve.log': 'Runtime log',
  'evolve.noLog': 'No log lines for this brief yet',
  'evolve.media': 'Keyframes / videos',
  'evolve.noMedia': 'No media kept for this round',
}
