/** `phops` namespace dictionaries: the mission-cockpit / skills / RSI tabs + the
 * operator-rail card copy (mission graph, progress, runtime vitals, RSI ticker). */

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
  // skills + RSI pages
  | 'view.rsi'
  | 'skills.failureModes'
  | 'evolve.task'
  | 'evolve.taskHint'
  | 'evolve.start'
  | 'evolve.starting'
  | 'evolve.submitted'
  | 'evolve.unclaimed'
  | 'evolve.claimed'
  | 'evolve.stop'
  | 'evolve.mode'
  | 'evolve.continuous'
  | 'evolve.finite'
  | 'evolve.cycleLimit'
  | 'evolve.continuousHelp'
  | 'evolve.finiteHelp'
  | 'rsi.cycle.current'
  | 'rsi.cycle.continuing'
  | 'rsi.cycle.outcome'
  | 'rsi.cycle.stop'
  | 'rsi.run.running'
  | 'rsi.run.stop'
  | 'evolve.round'
  | 'evolve.before'
  | 'evolve.after'
  | 'evolve.best'
  | 'evolve.chart'
  | 'evolve.noLog'
  | 'evolve.noMedia'
  | 'yes'
  | 'no'
  | 'rsi.statusLine'
  | 'rsi.roundN'
  | 'rsi.sec.frames'
  | 'rsi.sec.log'
  | 'rsi.saw'
  | 'rsi.tried'
  | 'rsi.result'
  | 'rsi.published'
  | 'rsi.needs'
  | 'rsi.seed'
  | 'rsi.firstDeath'
  | 'rsi.noPerSeed'
  | 'rsi.tried.executor'
  | 'rsi.tried.tunables'
  | 'rsi.tried.card'
  | 'rsi.tried.plan'
  | 'rsi.planEvidence'
  | 'rsi.tried.none'
  | 'rsi.dropped'
  | 'rsi.confirm'
  | 'rsi.confirm.line'
  | 'rsi.confirm.pass'
  | 'rsi.confirm.fail'
  | 'rsi.usage'
  | 'rsi.strict'
  | 'rsi.strictNote'
  | 'rsi.tab.evolution'
  | 'rsi.tab.battle'
  | 'rsi.tab.ledger'
  | 'rsi.faceError'
  | 'rsi.guide'
  | 'rsi.noLive'
  | 'rsi.status.running'
  | 'rsi.status.done'
  | 'rsi.status.cancelled'
  | 'rsi.phase.baseline'
  | 'rsi.phase.propose'
  | 'rsi.phase.retest'
  | 'rsi.phase.confirm'
  | 'rsi.phase.publish'
  | 'rsi.seedLine'
  | 'rsi.elapsed'
  | 'rsi.eta'
  | 'rsi.etaNone'
  | 'rsi.sec.live'
  | 'rsi.seedBoard'
  | 'rsi.seed.queued'
  | 'rsi.seed.running'
  | 'rsi.seed.died'
  | 'rsi.noFrame'
  | 'rsi.roundRunning'
  | 'rsi.learning.history'
  | 'rsi.learning.epoch'
  | 'rsi.learning.allEpochs'
  | 'rsi.learning.singlePoint'
  | 'rsi.learning.boundary'
  | 'rsi.learning.overview'
  | 'rsi.learning.metric'
  | 'rsi.learning.unidentified'
  | 'rsi.learning.follow'
  | 'rsi.learning.policy'
  | 'rsi.learning.candidate'
  | 'rsi.learning.chart'
  | 'rsi.learning.accepted'
  | 'rsi.learning.error'
  | 'rsi.learning.untested'
  | 'rsi.learning.noUpdate'
  | 'rsi.learning.pick'
  | 'rsi.learning.contract'
  | 'rsi.learning.unknown'
  | 'rsi.learning.result'
  | 'rsi.learning.cost'
  | 'rsi.learning.page'
  | 'rsi.learning.newer'
  | 'rsi.learning.older'
  | 'rsi.chartEmpty'
  | 'rsi.log.claimed'
  | 'rsi.log.done'
  | 'rsi.log.failed'
  | 'rsi.log.cancelled'
  | 'rsi.log.raw'
  | 'rsi.nodes'
  | 'rsi.node.steps'
  | 'rsi.messages'
  | 'rsi.matrix.baseline'
  | 'rsi.matrix.trial'
  | 'rsi.matrix.elapsed'
  | 'rsi.chart.task'
  | 'rsi.evaluation'
  | 'rsi.obligations'
  | 'rsi.acceptance'
  | 'rsi.accepted'
  | 'rsi.rejected'
  | 'rsi.installation'
  | 'rsi.notEvaluated'
  | 'rsi.diagnosis'
  | 'rsi.experience'
  | 'rsi.transfer'
  | 'rsi.transfer.line'
  | 'rsi.transfer.censored'
  | 'rsi.transfer.context'
  | 'rsi.transfer.cost.scope'
  | 'rsi.transfer.cost.line'
  | 'rsi.transfer.cost.total'
  | 'rsi.transfer.cost.first'
  | 'rsi.transfer.cost.notAccepted'
  | 'rsi.transfer.cost.cycle'
  | 'rsi.chart.objective'
  | 'rsi.observations'
  | 'rsi.identities'
  | 'rsi.heat'
  | 'rsi.heat.cell'
  | 'rsi.summary.nodes'
  | 'rsi.summary.tasks'
  | 'rsi.analysis'
  | 'rsi.phase.proposing'
  | 'rsi.tabs'
  | 'rsi.tab.run'
  | 'rsi.tab.models'
  | 'rsi.models.next'
  | 'rsi.models.help'
  | 'rsi.models.model'
  | 'rsi.models.effort'
  | 'rsi.models.defaultModel'
  | 'rsi.models.defaultEffort'
  | 'rsi.models.providerDefault'
  | 'rsi.models.refresh'
  | 'rsi.models.manual'
  | 'rsi.models.error'
  | 'rsi.models.selection'
  | 'rsi.models.recorded'
  | 'rsi.models.unrecorded'
  | 'rsi.models.request'
  | 'rsi.llmOnly'
  | 'rsi.notRetested'
  | 'rsi.failed'
  | 'rsi.llm.audit'
  | 'rsi.llm.proposed'
  | 'rsi.llm.abstained'
  | 'rsi.llm.noCandidate'
  | 'rsi.llm.budgetExhausted'
  | 'rsi.llm.rejected'
  | 'rsi.llm.error'
  | 'rsi.llm.identity'
  | 'rsi.llm.errorDetail'
  | 'rsi.llm.raw'
  | 'rsi.llm.counts'
  | 'rsi.llm.bytes'
  | 'rsi.llm.readLimit'
  | 'rsi.llm.output'
  | 'rsi.llm.incompleteUsage'
  | 'rsi.llm.stop'
  | 'rsi.budget.brief'
  | 'rsi.budget.cycle'
  | 'rsi.budget.unlimited'
  | 'rsi.budget.scope'
  | 'rsi.budget.used'
  | 'rsi.budget.evaluations'
  | 'rsi.policy'
  | 'rsi.policy.program'
  | 'rsi.policy.updated'
  | 'rsi.policy.versions'
  | 'rsi.policy.parent'
  | 'rsi.learning'
  | 'rsi.learning.scope'
  | 'rsi.proposer.llm'
  | 'rsi.proposer.rules'
  | 'rsi.proposer.inbox'

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
  'skills.failureModes': '失败模式',
  'view.rsi': 'RSI',
  'evolve.task': '任务',
  'evolve.taskHint': '例如 kitchen_thaw',
  'evolve.start': '开始 / 继续',
  'evolve.starting': '启动中…',
  'evolve.submitted': '已投递 {brief} · 等待 runtime 认领 · {s} 秒',
  'evolve.unclaimed': '已投递 {brief} · 60 秒内没有被认领：检查 runtime 是否在线（健康面板）· {s} 秒',
  'evolve.claimed': '{brief} 已认领',
  'evolve.stop': '停止',
  'evolve.mode': '运行模式',
  'evolve.continuous': '持续运行',
  'evolve.finite': '有限周期',
  'evolve.cycleLimit': '周期上限',
  'evolve.continuousHelp': '无更新也会继续下一周期，直到停止或发生外部错误。每周期保留调用、字节与采样上限；累计投入持续增加。',
  'evolve.finiteHelp': '最多运行指定周期数，同时受本次简报的累计预算限制。',
  'rsi.cycle.current': '当前周期 {cycle}',
  'rsi.cycle.continuing': '本周期结束，将继续下一周期 · 等待 {seconds}s',
  'rsi.cycle.outcome': '周期 {cycle} 结果 {outcome}',
  'rsi.cycle.stop': '本周期结束原因 {reason}',
  'rsi.run.running': '整体仍在运行',
  'rsi.run.stop': '整体结束原因 {reason}',
  'evolve.round': '轮次',
  'evolve.before': '前',
  'evolve.after': '后',
  'evolve.best': '最佳',
  'evolve.chart': '后端评估与任务结果',
  'evolve.noLog': '暂无该 brief 的日志',
  'evolve.noMedia': '该轮无保留媒体',
  'yes': '是',
  'no': '否',
  'rsi.statusLine': '第 {r} 轮 · 最佳 {k}/{n} · {status}',
  'rsi.roundN': '第 {r} 轮',
  'rsi.sec.frames': '关键片段',
  'rsi.sec.log': '日志',
  'rsi.saw': '看到了什么',
  'rsi.tried': '试了什么',
  'rsi.result': '结果',
  'rsi.published': '历史发布记录',
  'rsi.needs': '还缺什么',
  'rsi.seed': '种子',
  'rsi.firstDeath': '首死节点',
  'rsi.noPerSeed': '没有逐种子记录',
  'rsi.tried.executor': '{node} 换用 {to} 执行器',
  'rsi.tried.tunables': '把 {node} 的 {path} {from} → {to}',
  'rsi.tried.plan': '调整执行计划',
  'rsi.planEvidence': '计划提案',
  'rsi.tried.card': '{node} 挂候选卡 {to}',
  'rsi.tried.none': '未提交候选：{reason}',
  'rsi.dropped': '未留下片段',
  'rsi.confirm': '历史确认记录',
  'rsi.confirm.line': '确认种子 {seeds} · {b}/{n} → {a}/{n} · {verdict}',
  'rsi.confirm.pass': '历史已发布',
  'rsi.confirm.fail': '历史未发布',
  'rsi.usage': 'LLM tokens {tokens} · 仿真 {s} s',
  'rsi.strict': '严格评测（prereg / 盲双胞胎 / held-out）',
  'rsi.strictNote': '可选的规则型纪律，只对 plugins/rsi 的 rule 型 RSI 有意义。',
  'rsi.tab.evolution': '迭代记录',
  'rsi.tab.battle': '战报',
  'rsi.tab.ledger': '账本',
  'rsi.faceError': '读取失败 {calls}——页面上的空白不是「还没数据」，是这条调用挂了。',
  'rsi.guide': '还没有演化：输入任务名，按「开始 / 继续」。',
  'rsi.noLive': '该运行早于实时进度功能，只有整轮结果',
  'rsi.status.running': '运行中',
  'rsi.status.done': '已完成',
  'rsi.status.cancelled': '已取消',
  'rsi.phase.baseline': '看（基线评测）',
  'rsi.phase.propose': '试（提议）',
  'rsi.phase.retest': '复测',
  'rsi.phase.confirm': '额外开发种子复测',
  'rsi.phase.publish': '接受判定',
  'rsi.seedLine': '种子 {i}/{n} · 当前 seed {seed} · 节点 {node}',
  'rsi.elapsed': '已用时 {t}',
  'rsi.eta': '预计剩余 {t}',
  'rsi.etaNone': '首轮无估计',
  'rsi.sec.live': '实时',
  'rsi.seedBoard': '本轮种子',
  'rsi.seed.queued': '排队',
  'rsi.seed.running': '运行中',
  'rsi.seed.died': '首死 {node}',
  'rsi.noFrame': '暂无画面',
  'rsi.roundRunning': '本轮进行中，完成后显示结果',
  'rsi.learning.history': '轮次历史',
  'rsi.learning.epoch': '评测版本',
  'rsi.learning.allEpochs': '全部历史 · 按评测版本分段',
  'rsi.learning.singlePoint': '本评测版本仅完成第 {r} 轮，暂显示一个点；完成更多轮次后形成曲线。',
  'rsi.learning.boundary': '第 {r} 轮起使用新的评测版本',
  'rsi.learning.overview': '历史记录保留。虚线为评测版本切换，跨版本不连线、不比较升降；缺测处断线。可选择单个版本查看本次学习效果。',
  'rsi.learning.metric': '指标',
  'rsi.learning.unidentified': '未标识',
  'rsi.learning.follow': '跟随最新',
  'rsi.learning.policy': '当前策略',
  'rsi.learning.candidate': '候选复测',
  'rsi.learning.chart': '训练曲线',
  'rsi.learning.accepted': '已接受',
  'rsi.learning.error': '错误',
  'rsi.learning.untested': '未复测',
  'rsi.learning.noUpdate': '未更新',
  'rsi.learning.pick': '点选轮次查看数值与证据',
  'rsi.learning.contract': '仅比较同一连续评测周期；策略线仅在明确接受后使用候选值，菱形为候选复测，细线连接其配对基线。缺测处断线。',
  'rsi.learning.unknown': '缺少评测标识，观测不可跨轮比较；历史未测值显示 —。',
  'rsi.learning.result': '结果',
  'rsi.learning.cost': '本轮投入',
  'rsi.learning.page': '第 {page}/{pages} 页 · {count} 轮',
  'rsi.learning.newer': '较新',
  'rsi.learning.older': '较早',
  'rsi.chartEmpty': '第一轮完成后出现折线',
  'rsi.log.claimed': '认领了 {task} 的演化 {brief}',
  'rsi.log.done': '完成',
  'rsi.log.failed': '失败：{error}',
  'rsi.log.cancelled': '已取消',
  'rsi.log.raw': '原始',
  'rsi.nodes': '当前种子节点',
  'rsi.node.steps': '{n} 步',
  'rsi.messages': '消息流',
  'rsi.matrix.baseline': '基线',
  'rsi.matrix.trial': '试探',
  'rsi.matrix.elapsed': '用时',
  'rsi.chart.task': '整任务成功',
  'rsi.evaluation': '固定任务评估',
  'rsi.obligations': '固定条件数量',
  'rsi.acceptance': '开发评测接受',
  'rsi.accepted': '已接受',
  'rsi.rejected': '未接受',
  'rsi.installation': '验证安装',
  'rsi.notEvaluated': '尚未评估安装',
  'rsi.diagnosis': '诊断证据',
  'rsi.experience': '经验检索与记录',
  'rsi.transfer': '跨任务迁移',
  'rsi.transfer.line': '先前任务 {prior} · 首次接受轮次 {first} · 尝试 {trials}',
  'rsi.transfer.censored': '截至当前尚未观察到接受',
  'rsi.transfer.context': '条件 {condition} · 经验检索截点 {prefix}',
  'rsi.transfer.cost.scope': '当前开发周期 · 已接受改进 {accepted} 次',
  'rsi.transfer.cost.line': 'episode 尝试 {episodes} · 模型调用 {calls} · 输入 {bytes} B · LLM {tokens} tokens · 仿真 {sim} s · 经过时间 {wall} s',
  'rsi.transfer.cost.total': '累计投入',
  'rsi.transfer.cost.first': '首次接受改进投入',
  'rsi.transfer.cost.notAccepted': '尚未接受',
  'rsi.transfer.cost.cycle': '最近接受之后的投入（包含本轮）',
  'rsi.chart.objective': '固定任务进度',
  'rsi.observations': '原始验证观测',
  'rsi.identities': '版本与证据标识',
  'rsi.heat': '按子任务',
  'rsi.heat.cell': '第 {r} 轮 · {task} 通过 {k}/{n}',
  'rsi.summary.nodes': '节点通过 {b} → {a}',
  'rsi.summary.tasks': '子任务',
  'rsi.analysis': 'LLM 分析',
  'rsi.phase.proposing': 'LLM 分析中',
  'rsi.tabs': 'RSI 页面',
  'rsi.tab.run': '运行',
  'rsi.tab.models': '模型设置',
  'rsi.models.next': '下次运行的模型',
  'rsi.models.help': '选择仅随下一次“开始 / 继续”提交。切换页签会保留草稿，不会修改或重启当前运行。',
  'rsi.models.model': '模型',
  'rsi.models.effort': '推理强度',
  'rsi.models.defaultModel': '后端默认（{model}）',
  'rsi.models.defaultEffort': '后端默认（{effort}）',
  'rsi.models.providerDefault': '由服务端选择',
  'rsi.models.refresh': '刷新可选模型',
  'rsi.models.manual': '模型列表来自当前 harness 服务。可直接输入模型 ID；留空使用后端默认。off 关闭思考。',
  'rsi.models.error': '模型列表读取失败：{error}。仍可使用默认值或手动输入模型 ID。',
  'rsi.models.selection': '模型：{model} · 推理强度：{effort}',
  'rsi.models.recorded': '当前运行已记录配置',
  'rsi.models.unrecorded': '此运行尚无已记录的模型配置。',
  'rsi.models.request': '本轮请求模型：{model} · 推理强度：{effort}',
  'rsi.llmOnly': 'LLM 提议 · 无自动回退',
  'rsi.notRetested': '未复测',
  'rsi.failed': '运行失败',
  'rsi.llm.audit': 'LLM 审计',
  'rsi.llm.proposed': '已提出候选',
  'rsi.llm.abstained': '模型主动放弃提案',
  'rsi.llm.noCandidate': '本轮未提出候选',
  'rsi.llm.budgetExhausted': '模型决策预算耗尽',
  'rsi.llm.rejected': '候选校验预算耗尽',
  'rsi.llm.error': '模型调用失败',
  'rsi.llm.identity': '模型 {model} · 提示摘要 {prompt}',
  'rsi.llm.errorDetail': '阶段 {stage} · {type} · {message}',
  'rsi.llm.raw': '原始模型审计',
  'rsi.llm.counts': '模型调用 {calls}/{limit} · 取证 {reads} 次 · 探索试验 {trials} 次',
  'rsi.llm.bytes': '累计请求 {used}/{total} B · 单次请求上限 {request} B · 累计工具结果 {toolUsed} B（单次上限 {tool} B）',
  'rsi.llm.readLimit': '每次新实测采样之间的批量只读调用上限 {limit}；缓存结果或错误不重置',
  'rsi.llm.output': '累计输出 {used} tokens · 每次输出上限 {limit} tokens',
  'rsi.llm.incompleteUsage': '模型返回的 token 用量不完整',
  'rsi.llm.stop': '结束原因 {reason}',
  'rsi.budget.brief': '本次简报累计预算',
  'rsi.budget.cycle': '周期 {cycle} 预算',
  'rsi.budget.unlimited': '无总上限',
  'rsi.budget.scope': '预算作用域 {scope}',
  'rsi.budget.used': '模型调用 {calls}/{callsLimit} · 输入 {bytes}/{bytesLimit} B · 探索 episode {probes}/{probesLimit}',
  'rsi.budget.evaluations': '候选全种子评测 {full} 次 · 每次输出上限 {output} tokens',
  'rsi.policy': '程序策略版本',
  'rsi.policy.program': '程序策略在线改进（非权重训练）',
  'rsi.policy.updated': '策略已更新：{updated}',
  'rsi.policy.versions': '基线 {before} → 候选 {candidate} · 当前 {active}',
  'rsi.policy.parent': '父版本 {parent}',
  'rsi.learning': '探索试验记录',
  'rsi.learning.scope': 'Probe 是探索反馈；配对评测接受与验证安装由上方独立结果给出。',
  'rsi.proposer.llm': 'LLM',
  'rsi.proposer.rules': '历史规则',
  'rsi.proposer.inbox': '收件箱',
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
  'skills.failureModes': 'Failure modes',
  'view.rsi': 'RSI',
  'evolve.task': 'Task',
  'evolve.taskHint': 'e.g. kitchen_thaw',
  'evolve.start': 'Start / resume',
  'evolve.starting': 'Starting…',
  'evolve.submitted': 'Submitted {brief} · waiting for the runtime to claim it · {s}s',
  'evolve.unclaimed': 'Submitted {brief} · not claimed within 60 s: check the runtime is online (health panel) · {s}s',
  'evolve.claimed': '{brief} claimed',
  'evolve.stop': 'Stop',
  'evolve.mode': 'Run mode',
  'evolve.continuous': 'Continuous',
  'evolve.finite': 'Finite cycles',
  'evolve.cycleLimit': 'Cycle limit',
  'evolve.continuousHelp': 'Continue after cycles without updates until stopped or an external error occurs. Each cycle keeps its call, byte and sampling limits; total resources keep accumulating.',
  'evolve.finiteHelp': 'Run at most this many cycles, also bounded by the submitted brief’s cumulative budget.',
  'rsi.cycle.current': 'Current cycle {cycle}',
  'rsi.cycle.continuing': 'Cycle ended; continuing to the next cycle · waiting {seconds}s',
  'rsi.cycle.outcome': 'Cycle {cycle} outcome {outcome}',
  'rsi.cycle.stop': 'Cycle stop reason {reason}',
  'rsi.run.running': 'Overall run is still active',
  'rsi.run.stop': 'Overall stop reason {reason}',
  'evolve.round': 'Round',
  'evolve.before': 'before',
  'evolve.after': 'after',
  'evolve.best': 'best',
  'evolve.chart': 'Backend evaluation and task outcomes',
  'evolve.noLog': 'No log lines for this brief yet',
  'evolve.noMedia': 'No media kept for this round',
  'yes': 'yes',
  'no': 'no',
  'rsi.statusLine': 'Round {r} · best {k}/{n} · {status}',
  'rsi.roundN': 'Round {r}',
  'rsi.sec.frames': 'Key clips',
  'rsi.sec.log': 'Log',
  'rsi.saw': 'What it saw',
  'rsi.tried': 'What it tried',
  'rsi.result': 'Result',
  'rsi.published': 'Historical publication',
  'rsi.needs': 'What is missing',
  'rsi.seed': 'Seed',
  'rsi.firstDeath': 'First death',
  'rsi.noPerSeed': 'No per-seed record',
  'rsi.tried.executor': '{node}: switch executor to {to}',
  'rsi.tried.tunables': '{node}: {path} {from} → {to}',
  'rsi.tried.plan': 'Revise execution plan',
  'rsi.planEvidence': 'Proposed plan',
  'rsi.tried.card': '{node}: mount candidate card {to}',
  'rsi.tried.none': 'No candidate: {reason}',
  'rsi.dropped': 'no clip kept',
  'rsi.confirm': 'Historical confirmation',
  'rsi.confirm.line': 'Confirm seeds {seeds} · {b}/{n} → {a}/{n} · {verdict}',
  'rsi.confirm.pass': 'historically published',
  'rsi.confirm.fail': 'not historically published',
  'rsi.usage': 'LLM tokens {tokens} · sim {s} s',
  'rsi.strict': 'Strict evaluation (prereg / blind twin / held-out)',
  'rsi.strictNote': 'Optional rule-type discipline; only meaningful for the rule-type RSI under plugins/rsi.',
  'rsi.tab.evolution': 'Generations',
  'rsi.tab.battle': 'Battle report',
  'rsi.tab.ledger': 'Ledger',
  'rsi.faceError': 'Read failed {calls} — the blank below is a broken call, not "no data yet".',
  'rsi.guide': 'No evolve yet: type a task and press Start / resume.',
  'rsi.noLive': 'This run predates live progress; only whole-round results are available',
  'rsi.status.running': 'running',
  'rsi.status.done': 'done',
  'rsi.status.cancelled': 'cancelled',
  'rsi.phase.baseline': 'Look (baseline)',
  'rsi.phase.propose': 'Try (propose)',
  'rsi.phase.retest': 'Retest',
  'rsi.phase.confirm': 'Additional development seeds',
  'rsi.phase.publish': 'Accept decision',
  'rsi.seedLine': 'Seed {i}/{n} · seed {seed} · node {node}',
  'rsi.elapsed': 'Elapsed {t}',
  'rsi.eta': 'ETA {t}',
  'rsi.etaNone': 'no estimate on the first round',
  'rsi.sec.live': 'Live',
  'rsi.seedBoard': 'Seeds this round',
  'rsi.seed.queued': 'queued',
  'rsi.seed.running': 'running',
  'rsi.seed.died': 'died at {node}',
  'rsi.noFrame': 'No frame yet',
  'rsi.roundRunning': 'Round in progress; results show when it completes',
  'rsi.learning.history': 'Round history',
  'rsi.learning.epoch': 'Evaluation version',
  'rsi.learning.allEpochs': 'All history · segmented by evaluator',
  'rsi.learning.singlePoint': 'Only round {r} has completed in this evaluation version. More completed rounds will form a curve.',
  'rsi.learning.boundary': 'A new evaluator begins at round {r}',
  'rsi.learning.overview': 'History is retained. Dashed lines mark evaluator changes; lines and improvement comparisons never cross versions. Missing measurements leave gaps. Select one version to inspect its learning progress.',
  'rsi.learning.metric': 'Metric',
  'rsi.learning.unidentified': 'Unidentified',
  'rsi.learning.follow': 'Follow latest',
  'rsi.learning.policy': 'Current policy',
  'rsi.learning.candidate': 'Candidate retest',
  'rsi.learning.chart': 'Training curve',
  'rsi.learning.accepted': 'Accepted',
  'rsi.learning.error': 'Error',
  'rsi.learning.untested': 'Not retested',
  'rsi.learning.noUpdate': 'No update',
  'rsi.learning.pick': 'Select a round for values and evidence',
  'rsi.learning.contract': 'Only one contiguous evaluator epoch is comparable. The policy uses a candidate only after explicit acceptance; diamonds are candidate retests, paired to their baseline. Missing evaluations break the line.',
  'rsi.learning.unknown': 'Without evaluator identity, observations cannot be compared across rounds. Unmeasured historical values remain —.',
  'rsi.learning.result': 'Result',
  'rsi.learning.cost': 'Round cost',
  'rsi.learning.page': 'Page {page}/{pages} · {count} rounds',
  'rsi.learning.newer': 'Newer',
  'rsi.learning.older': 'Older',
  'rsi.chartEmpty': 'The line appears after the first round completes',
  'rsi.log.claimed': 'claimed the evolve of {task} {brief}',
  'rsi.log.done': 'done',
  'rsi.log.failed': 'failed: {error}',
  'rsi.log.cancelled': 'cancelled',
  'rsi.log.raw': 'raw',
  'rsi.nodes': 'Nodes of this seed',
  'rsi.node.steps': '{n} steps',
  'rsi.messages': 'Messages',
  'rsi.matrix.baseline': 'Baseline',
  'rsi.matrix.trial': 'Trial',
  'rsi.matrix.elapsed': 'Elapsed',
  'rsi.chart.task': 'Whole-task success',
  'rsi.evaluation': 'Fixed task evaluation',
  'rsi.obligations': 'Fixed obligations',
  'rsi.acceptance': 'Development acceptance',
  'rsi.accepted': 'Accepted',
  'rsi.rejected': 'Not accepted',
  'rsi.installation': 'Verified installation',
  'rsi.notEvaluated': 'Installation not evaluated',
  'rsi.diagnosis': 'Diagnosis evidence',
  'rsi.experience': 'Experience retrieval and record',
  'rsi.transfer': 'Cross-task transfer',
  'rsi.transfer.line': 'Prior tasks {prior} · first accepted round {first} · trials {trials}',
  'rsi.transfer.censored': 'No acceptance observed within this budget',
  'rsi.transfer.context': 'Condition {condition} · experience cutoff {prefix}',
  'rsi.transfer.cost.scope': 'Current development epoch · accepted updates {accepted}',
  'rsi.transfer.cost.line': 'Episode attempts {episodes} · model calls {calls} · input {bytes} B · LLM {tokens} tokens · simulation {sim} s · elapsed {wall} s',
  'rsi.transfer.cost.total': 'Total resources',
  'rsi.transfer.cost.first': 'First accepted update cost',
  'rsi.transfer.cost.notAccepted': 'Not yet accepted',
  'rsi.transfer.cost.cycle': 'Resources since the preceding acceptance (including this round)',
  'rsi.chart.objective': 'Fixed task progress',
  'rsi.observations': 'Raw verification observations',
  'rsi.identities': 'Version and evidence IDs',
  'rsi.heat': 'By subtask',
  'rsi.heat.cell': 'Round {r} · {task} passed {k}/{n}',
  'rsi.summary.nodes': 'Nodes passed {b} → {a}',
  'rsi.summary.tasks': 'Subtasks',
  'rsi.analysis': 'LLM analysis',
  'rsi.phase.proposing': 'LLM analyzing',
  'rsi.tabs': 'RSI pages',
  'rsi.tab.run': 'Run',
  'rsi.tab.models': 'Model settings',
  'rsi.models.next': 'Model for the next run',
  'rsi.models.help': 'Selections are submitted with the next Start / resume. Switching tabs keeps the draft and does not change or restart the current run.',
  'rsi.models.model': 'Model',
  'rsi.models.effort': 'Reasoning effort',
  'rsi.models.defaultModel': 'Backend default ({model})',
  'rsi.models.defaultEffort': 'Backend default ({effort})',
  'rsi.models.providerDefault': 'provider-selected',
  'rsi.models.refresh': 'Refresh model options',
  'rsi.models.manual': 'Models come from the configured harness provider. You can enter a model ID directly; leave it empty for the backend default. off disables thinking.',
  'rsi.models.error': 'Model discovery failed: {error}. You can still use defaults or enter a model ID.',
  'rsi.models.selection': 'Model: {model} · effort: {effort}',
  'rsi.models.recorded': 'Recorded run configuration',
  'rsi.models.unrecorded': 'This run has no recorded model configuration.',
  'rsi.models.request': 'Round requested model: {model} · effort: {effort}',
  'rsi.llmOnly': 'LLM proposals · no automatic fallback',
  'rsi.notRetested': 'Not retested',
  'rsi.failed': 'Run failed',
  'rsi.llm.audit': 'LLM audit',
  'rsi.llm.proposed': 'Candidate proposed',
  'rsi.llm.abstained': 'Model abstained',
  'rsi.llm.noCandidate': 'No candidate proposed this round',
  'rsi.llm.budgetExhausted': 'Model decision budget exhausted',
  'rsi.llm.rejected': 'Candidate validation budget exhausted',
  'rsi.llm.error': 'Model call failed',
  'rsi.llm.identity': 'Model {model} · Prompt digest {prompt}',
  'rsi.llm.errorDetail': 'Stage {stage} · {type} · {message}',
  'rsi.llm.raw': 'Raw model audit',
  'rsi.llm.counts': 'Model calls {calls}/{limit} · evidence reads {reads} · exploratory trials {trials}',
  'rsi.llm.bytes': 'Total request {used}/{total} B · per-request limit {request} B · total tool results {toolUsed} B (per-result limit {tool} B)',
  'rsi.llm.readLimit': 'Batched read-call limit between newly measured probes: {limit}; cached results and errors do not reset it',
  'rsi.llm.output': 'Total output {used} tokens · per-call output limit {limit} tokens',
  'rsi.llm.incompleteUsage': 'Model token usage is incomplete',
  'rsi.llm.stop': 'Stop reason {reason}',
  'rsi.budget.brief': 'Cumulative budget for this submitted brief',
  'rsi.budget.cycle': 'Cycle {cycle} budget',
  'rsi.budget.unlimited': 'no total cap',
  'rsi.budget.scope': 'Budget scope {scope}',
  'rsi.budget.used': 'Model calls {calls}/{callsLimit} · input {bytes}/{bytesLimit} B · probe episodes {probes}/{probesLimit}',
  'rsi.budget.evaluations': 'Full candidate evaluations {full} · per-call output limit {output} tokens',
  'rsi.policy': 'Program policy versions',
  'rsi.policy.program': 'Online program-policy improvement (no weight training)',
  'rsi.policy.updated': 'Policy updated: {updated}',
  'rsi.policy.versions': 'Baseline {before} → candidate {candidate} · active {active}',
  'rsi.policy.parent': 'Parent version {parent}',
  'rsi.learning': 'Exploratory trial record',
  'rsi.learning.scope': 'Probes provide exploration feedback; paired acceptance and verified installation are reported separately above.',
  'rsi.proposer.llm': 'LLM',
  'rsi.proposer.rules': 'Historical rules',
  'rsi.proposer.inbox': 'Inbox',
}
