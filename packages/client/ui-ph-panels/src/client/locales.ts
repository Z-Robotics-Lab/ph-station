/** `phpanels` namespace dictionaries: tab labels + one-line subtitles, empty-state
 * explainers, jargon tooltips, and field labels for the 规划 / 技能库 / 代际进化 /
 * 能力卡 / 账本 panels, the status bar, and the 任务台 composer chips. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'phpanels'

/** The phpanels dictionary key set (source of truth for both locales). */
export type PhPanelsKey =
  | 'view.plan'
  | 'view.library'
  | 'view.evolution'
  | 'view.cards'
  | 'view.ledger'
  // 规划 (natural-language task -> skill chain)
  | 'sub.plan'
  | 'plan.instructionLabel'
  | 'plan.placeholder'
  | 'plan.simulator'
  | 'plan.simulatorAvailable'
  | 'plan.session'
  | 'plan.seed'
  | 'plan.plan'
  | 'plan.planning'
  | 'plan.error'
  | 'plan.empty'
  | 'plan.execute'
  | 'plan.submitting'
  | 'plan.cancel'
  | 'plan.status.executable'
  | 'plan.status.planning_only'
  | 'plan.status.rejected'
  | 'plan.status.no_match'
  | 'plan.planningOnlyNotice'
  | 'plan.channel'
  | 'plan.matched'
  | 'plan.catalogue'
  | 'plan.validation'
  | 'plan.composite'
  | 'plan.decomposition'
  | 'plan.expanded'
  | 'plan.terminal'
  | 'plan.node.skill'
  | 'plan.node.stage'
  | 'plan.node.args'
  | 'plan.node.after'
  | 'plan.node.taxonomy'
  | 'plan.node.binding'
  | 'plan.bound'
  | 'plan.unbound'
  | 'plan.missing'
  | 'plan.unboundOracles'
  | 'plan.graph'
  | 'plan.generatedGraph'
  | 'plan.graphFlow'
  | 'plan.graphHint'
  | 'plan.goal'
  | 'plan.task'
  | 'plan.compositeSkill'
  | 'plan.compositeCount'
  | 'plan.leafCount'
  | 'plan.brief'
  | 'plan.briefId'
  | 'plan.briefState'
  | 'plan.queue'
  | 'plan.submitRefused'
  | 'plan.brief.queued'
  | 'plan.brief.running'
  | 'plan.brief.stalled'
  | 'plan.brief.done'
  | 'plan.brief.failed'
  | 'plan.brief.cancelled'
  // unified annotation taxonomy + executable runtime catalogues
  | 'sub.library'
  | 'library.taxonomy'
  | 'library.runtime'
  | 'library.layout'
  | 'library.overallGraph'
  | 'library.outlineTree'
  | 'library.graphSource'
  | 'library.children'
  | 'library.search'
  | 'library.bindingFilter'
  | 'library.filter.all'
  | 'library.filter.bound'
  | 'library.filter.unbound'
  | 'library.refresh'
  | 'library.graphSkills'
  | 'library.directBound'
  | 'library.runtimeSkills'
  | 'library.tasks'
  | 'library.episodes'
  | 'library.noMatch'
  | 'library.selectSkill'
  | 'library.kind.root'
  | 'library.kind.category'
  | 'library.kind.observed_skill'
  | 'library.kind.canonical_skill'
  | 'library.categoryHint'
  | 'library.annotationExecutable'
  | 'library.stages'
  | 'library.decomposition'
  | 'library.bindingTasks'
  | 'library.noDirectBinding'
  | 'library.candidates'
  | 'library.datasets'
  | 'library.labels'
  | 'library.frames'
  | 'library.skillEpisodes'
  | 'library.none'
  | 'library.canonical'
  // 演化台 (Evolution Console): the aggregate RSI panel + its sub-tab labels
  | 'view.rsi'
  | 'sub.rsi'
  | 'rsi.battle'
  // one-line panel subtitles (rendered in the panel head under the tab name)
  | 'sub.evolution'
  | 'sub.cards'
  | 'sub.ledger'
  | 'loading'
  | 'unavailable'
  // 代际进化
  | 'stores'
  | 'selectStore'
  | 'generations'
  | 'noGenerations'
  | 'emptyStores'
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
  // 进行中 campaign progress card
  | 'progressSucceeded'
  | 'progressEta'
  | 'progressFirstDeath'
  // 能力卡
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
  | 'viewfinder'
  | 'on'
  | 'off'
  // jargon tooltips (plain-Chinese one-liners, hover a `?` badge)
  | 'mcnemar.tip'
  | 'firstDeath.tip'
  | 'heldout.tip'
  | 'promoted.tip'
  | 'delta.tip'
  | 'seedBlock.tip'
  | 'mountPlan.tip'
  | 'viewfinder.tip'
  // 任务台 chips
  | 'chips.title'
  | 'chips.stack'
  | 'chips.stack.template'
  | 'chips.lift'
  | 'chips.lift.template'
  | 'chips.battle'
  | 'chips.battle.template'
  | 'chips.recycle'
  | 'chips.recycle.template'
  | 'chips.packLunch'
  | 'chips.packLunch.template'
  | 'chips.steamPrep'
  | 'chips.steamPrep.template'
  | 'chips.rsi'
  | 'chips.rsi.template'
  // rsi chain stages (progress.json `stage`, folded python-side)
  | 'progressTargetNode'
  | 'stage.calibrate'
  | 'stage.gate'
  | 'stage.dev'
  | 'stage.done'
  | 'stage.stopped'
  // Run-RSI launcher + chain stepper (演化台 head)
  | 'rsi.run'
  | 'rsi.taskPick'
  | 'rsi.sessionPick'
  | 'rsi.noTasks'
  | 'rsi.noSessions'
  | 'rsi.stale'
  | 'rsi.submit'
  | 'rsi.submitting'
  | 'rsi.submitted'
  | 'rsi.followBelow'
  | 'rsi.submitFailed'
  | 'rsi.noChain'
  | 'rsi.criteria'
  | 'rsi.criteria.tip'
  | 'rsi.honestNoGo'
  | 'rsi.firstDeath'
  | 'rsi.step.allocate'
  | 'rsi.step.calibrate'
  | 'rsi.step.gate'
  | 'rsi.step.prereg'
  | 'rsi.step.dev'
  | 'rsi.step.heldout'
  | 'rsi.step.install'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 代际进化/能力卡/账本 tab labels, subtitles, field labels, and status-bar copy. */
    'phpanels': PhPanelsKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<PhPanelsKey, string> = {
  'view.plan': '规划',
  'view.library': '技能库',
  'sub.plan': '选择仿真器，把自然语言任务生成可视化技能图谱：图谱检索 → DeepSeek 规划 → 校验 → 技能展开 → 绑定检查',
  'plan.instructionLabel': '任务',
  'plan.placeholder': '例如：Prepare a cup of coffee.',
  'plan.simulator': '仿真器',
  'plan.simulatorAvailable': '可用',
  'plan.session': '会话',
  'plan.seed': 'seed',
  'plan.plan': '规划',
  'plan.planning': '规划中…',
  'plan.error': '规划失败',
  'plan.empty': '输入一句自然语言任务并点“规划”。后端从 RoboCasa 统一技能图谱检索相关技能子树，让 DeepSeek 只在这份紧凑目录里选技能，再用运行时同一个校验器检查、按 HAS_STAGE / DECOMPOSES_TO 展开。这里不会执行任何东西；只有每个叶子技能都有真实 policy/driver binding 时才允许“执行”。',
  'plan.execute': '执行',
  'plan.submitting': '提交中…',
  'plan.cancel': '取消',
  'plan.status.executable': '可执行',
  'plan.status.planning_only': '仅规划（无 binding）',
  'plan.status.rejected': '校验拒绝',
  'plan.status.no_match': '没有匹配的技能词表',
  'plan.planningOnlyNotice': '这条链只是符号计划：RoboCasa 标注里存在这些技能，但本仓库没有它们的 policy/driver binding。不能执行，也没有执行结果。',
  'plan.channel': '词表',
  'plan.matched': '命中',
  'plan.catalogue': '给模型的紧凑目录 / 图谱技能总数',
  'plan.validation': '校验器拒绝',
  'plan.composite': '组合计划（模型输出，已校验）',
  'plan.decomposition': '规范展开',
  'plan.expanded': '展开后的叶子链',
  'plan.terminal': '终止',
  'plan.node.skill': '技能',
  'plan.node.stage': '阶段',
  'plan.node.args': '参数',
  'plan.node.after': '依赖',
  'plan.node.taxonomy': '分类路径',
  'plan.node.binding': 'binding',
  'plan.bound': '有 binding',
  'plan.unbound': '无 binding',
  'plan.missing': '缺少 binding',
  'plan.unboundOracles': '符号 verify 谓词（无可执行 oracle）：',
  'plan.graph': '生成的技能图谱',
  'plan.generatedGraph': '技能图谱 · 已校验',
  'plan.graphFlow': '技能执行流程',
  'plan.graphHint': '组合技能从左到右，叶子技能在节点内自上而下展开',
  'plan.goal': '任务目标',
  'plan.task': '任务',
  'plan.compositeSkill': '组合技能',
  'plan.compositeCount': '个组合节点',
  'plan.leafCount': '个叶子技能',
  'plan.brief': '执行简报',
  'plan.briefId': 'brief',
  'plan.briefState': '状态',
  'plan.queue': '队列位置',
  'plan.submitRefused': '提交被拒绝',
  'plan.brief.queued': '排队中',
  'plan.brief.running': '运行中',
  'plan.brief.stalled': '停滞（该会话没有活的运行时）',
  'plan.brief.done': '完成',
  'plan.brief.failed': '失败',
  'plan.brief.cancelled': '已取消',
  'sub.library': '查看完整 RoboCasa 技能分类树、组合/阶段标注，以及真正有 policy/driver binding 的运行时技能',
  'library.taxonomy': '技能树',
  'library.runtime': '运行时技能',
  'library.layout': '技能树布局',
  'library.overallGraph': '总体技能树',
  'library.outlineTree': '目录树',
  'library.graphSource': '数据源 · unified_skill_graph.json',
  'library.children': '个子节点',
  'library.search': '搜索技能、数据集或阶段',
  'library.bindingFilter': 'binding 筛选',
  'library.filter.all': '全部',
  'library.filter.bound': '有直接 binding',
  'library.filter.unbound': '无直接 binding',
  'library.refresh': '刷新',
  'library.graphSkills': '图谱技能',
  'library.directBound': '直接绑定',
  'library.runtimeSkills': '运行时技能',
  'library.tasks': '任务 binding',
  'library.episodes': 'annotation episode',
  'library.noMatch': '没有符合筛选条件的技能',
  'library.selectSkill': '从左侧技能树选择一个节点，查看阶段、组合、label、数据集证据和 binding 状态。',
  'library.kind.root': '根',
  'library.kind.category': '分类',
  'library.kind.observed_skill': '观测技能',
  'library.kind.canonical_skill': '规范技能',
  'library.categoryHint': '这是分类节点，用来组织 IS_A 技能树，不是可调度技能。',
  'library.annotationExecutable': 'annotation 可执行标记',
  'library.stages': '阶段（HAS_STAGE / REALIZES）',
  'library.decomposition': '组合（DECOMPOSES_TO）',
  'library.bindingTasks': '直接绑定的任务',
  'library.noDirectBinding': '没有同名的运行时 binding，不能从图谱通道直接执行',
  'library.candidates': '同 canonical 的实现候选（不是直接 binding）',
  'library.datasets': '出现的数据集',
  'library.labels': 'annotation label',
  'library.frames': '标注帧数',
  'library.skillEpisodes': '覆盖 episode',
  'library.none': '无',
  'library.canonical': '对应 canonical',
  'view.evolution': '迭代记录',
  'view.cards': '能力卡',
  'view.ledger': '账本',
  'view.rsi': 'RSI 总览',
  'sub.rsi': 'RSI 全景：campaign 进度、held-out 门禁、每代 Δpp 与 seed 预算账本',
  'rsi.battle': '战报',
  'sub.evolution': '每一代改动相对上一代的成绩变化，以及是否通过门禁（promoted）',
  'sub.cards': '已装的技能/能力：驱动方式、是否需仿真、任务绑定',
  'sub.ledger': '各 seed 区块的预算占用：已烧 / 预留 / 计划',
  'loading': '加载中…',
  'unavailable': '数据面不可用（board bridge 未挂载）',
  'stores': 'Campaigns',
  'selectStore': '选择一个 campaign 查看各代成绩',
  'generations': '迭代',
  'noGenerations': '暂无迭代记录',
  'emptyStores': '还没有 campaign 数据。campaign = 针对某任务的一轮 RSI 多代改进；每代会打 dev / blind / held-out 分数并判定是否通过（promoted）。',
  'promoted': '通过 (promoted)',
  'rejected': '未通过',
  'generation': '代',
  'devDelta': 'dev Δpp',
  'blindDelta': 'blind Δpp',
  'heldoutDelta': 'held-out Δpp',
  'mcnemar': 'McNemar (修复/破坏)',
  'rule': '规则',
  'rounds': '轮次',
  'noRounds': 'progress.md 无轮次',
  'progressSucceeded': '成功',
  'progressEta': '预计剩余',
  'progressFirstDeath': '首死 top3',
  'noCards': '还没读到能力卡。每张卡来自一个已装插件的 manifest.toml，描述它提供的技能、驱动方式与任务绑定。',
  'actuation': '驱动',
  'needsSim': '需要仿真',
  'yes': '是',
  'no': '否',
  'contributes': '贡献',
  'mounts': '挂载',
  'taskBindings': '任务绑定',
  'campaigns': 'Campaigns',
  'bundles': '套件',
  'thirdParty': '第三方',
  'doctor': '体检',
  'doctorNotWired': '未接入',
  'noLedger': 'STATUS.md 里还没有区块预算。账本按 seed 区块记录预算的已烧/预留/计划。',
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
  'viewfinder': '取景窗',
  'on': '开',
  'off': '关',
  'mcnemar.tip': "McNemar 检验：只看被改动'修对'和'改坏'的题，判断这代改动是不是真变好（而非运气）。",
  'firstDeath.tip': '首死：一集里第一个失败的环节；这里显示当前批次里最常见的三个死因。',
  'heldout.tip': '留出集：训练时从没见过的题，用来诚实检验泛化，防止背答案刷分。',
  'promoted.tip': '通过（promoted）：这一代过了 dev / blind / held-out 三道门槛，被采纳为新基线。',
  'delta.tip': 'Δpp：相对上一代的成功率变化，单位百分点。',
  'seedBlock.tip': 'seed 区块：一段任务种子编号范围；预算按区块分配和消耗。',
  'mountPlan.tip': '挂载计划：本次启动装载的插件/技能组合的指纹（sha），用来确认跑的是哪一套配置。',
  'viewfinder.tip': '取景窗：机器人相机的实时画面渲染开关；开＝正在出图，关＝未渲染。',
  'chips.title': '任务台',
  'chips.stack': 'stack 任务',
  'chips.stack.template': '开始一个 stack 抓取任务：seed=0，渲染开启。先说明计划，再执行。',
  'chips.lift': 'lift_geometric 任务',
  'chips.lift.template': '开始一个 lift_geometric 任务：seed=0，渲染开启。先说明计划，再执行。',
  'chips.battle': '看最新战报',
  'chips.battle.template': '打开最新 held-out 战报，用最近一次 campaign 的结果做小结。',
  'chips.recycle': '回收易拉罐',
  'chips.recycle.template':
    '开始一个 recycle_cans 长程任务：seed=4243，session=session-robocasa，max_actuations=48。先说明计划，再执行。',
  'chips.packLunch': '打包午餐',
  'chips.packLunch.template':
    '开始一个 pack_lunch 长程任务：seed=4250，session=session-robocasa，max_actuations=48。先说明计划，再执行。',
  'chips.steamPrep': '蒸菜备餐',
  'chips.steamPrep.template':
    '开始一个 steam_prep 长程任务：seed=4250，session=session-robocasa，max_actuations=32。水龙头驱动未落地，预期在 water-on 诚实失败。先说明计划，再执行。',
  'chips.rsi': 'RSI 提升 kitchen_thaw',
  'chips.rsi.template':
    'RSI 提升 kitchen_thaw：投一张 {"kind":"rsi","task":"kitchen_thaw"} 到进化态 session。最小形态只要任务名——领块、标定、门禁、prereg、dev、held-out 由 runtime 自己走完；目标节点由首死归因选，不要替它挑。先说明计划，再执行。',
  'progressTargetNode': '目标节点',
  'stage.calibrate': '标定',
  'stage.gate': '门禁',
  'stage.dev': 'dev 世代',
  'stage.done': '完成',
  'stage.stopped': '停在门禁',
  'rsi.run': 'Run RSI',
  'rsi.taskPick': '选择 task',
  'rsi.sessionPick': '选择 evolution session',
  'rsi.noTasks': '没有能力卡声明 task_bindings——先装一个带任务绑定的插件。',
  'rsi.noSessions': '没有 evolution 模式的 runtime session——RSI brief 只有 evolution 态的 runtime 会认领。',
  'rsi.stale': 'runtime 可能已失活 (stale)',
  'rsi.submit': '提交 RSI brief',
  'rsi.submitting': '提交中…',
  'rsi.submitted': '已投递',
  'rsi.followBelow': '在下方链条 stepper 跟进',
  'rsi.submitFailed': '提交失败',
  'rsi.noChain': '还没有 RSI 链心跳。提交一个 RSI brief 后，链条进度会出现在这里。',
  'rsi.criteria': '门禁判据',
  'rsi.criteria.tip': '六条预登记判据 (c1..c6)：全绿才 GO；红色是被测量触发的判据。NO-GO 是诚实结果，不是错误。',
  'rsi.honestNoGo': '诚实 NO-GO（正常结果，不是错误）',
  'rsi.firstDeath': '首死分布',
  'rsi.step.allocate': '领块',
  'rsi.step.calibrate': '标定',
  'rsi.step.gate': '门禁',
  'rsi.step.prereg': 'prereg',
  'rsi.step.dev': 'dev',
  'rsi.step.heldout': 'held-out',
  'rsi.step.install': '装入',
}

/** English dictionary. */
export const en: Record<PhPanelsKey, string> = {
  'view.plan': 'Plan',
  'view.library': 'Skill Library',
  'sub.plan': 'Choose a simulator and turn a natural-language task into a visual skill graph: graph retrieval → DeepSeek planning → validation → skill expansion → binding check.',
  'plan.instructionLabel': 'Task',
  'plan.placeholder': 'e.g. Prepare a cup of coffee.',
  'plan.simulator': 'Simulator',
  'plan.simulatorAvailable': 'Available',
  'plan.session': 'Session',
  'plan.seed': 'seed',
  'plan.plan': 'Plan',
  'plan.planning': 'Planning…',
  'plan.error': 'Planning failed',
  'plan.empty': 'Type a natural-language task and press Plan. The harness retrieves the relevant subtree of the RoboCasa unified skill graph, lets DeepSeek select only from that compact catalogue, then checks the reply with the runtime\'s own validator and expands it by HAS_STAGE / DECOMPOSES_TO. Nothing executes here; Execute is enabled only when every leaf skill has a real policy/driver binding.',
  'plan.execute': 'Execute',
  'plan.submitting': 'Submitting…',
  'plan.cancel': 'Cancel',
  'plan.status.executable': 'Executable',
  'plan.status.planning_only': 'Planning only (unbound)',
  'plan.status.rejected': 'Validation rejected',
  'plan.status.no_match': 'No matching skill vocabulary',
  'plan.planningOnlyNotice': 'This chain is symbolic: the skills exist in the RoboCasa annotations, but this repository has no policy/driver binding for them. It cannot run, and there is no execution result.',
  'plan.channel': 'Vocabulary',
  'plan.matched': 'matched',
  'plan.catalogue': 'compact catalogue sent to the model / graph skills total',
  'plan.validation': 'Validator refused',
  'plan.composite': 'Composite plan (model output, validated)',
  'plan.decomposition': 'Canonical expansion',
  'plan.expanded': 'Expanded leaf chain',
  'plan.terminal': 'terminal',
  'plan.node.skill': 'skill',
  'plan.node.stage': 'stage',
  'plan.node.args': 'args',
  'plan.node.after': 'after',
  'plan.node.taxonomy': 'taxonomy',
  'plan.node.binding': 'binding',
  'plan.bound': 'bound',
  'plan.unbound': 'unbound',
  'plan.missing': 'Missing bindings',
  'plan.unboundOracles': 'Symbolic verify predicates (no executable oracle):',
  'plan.graph': 'Generated skill graph',
  'plan.generatedGraph': 'Skill graph · validated',
  'plan.graphFlow': 'Skill execution flow',
  'plan.graphHint': 'Composite skills flow left to right; leaf skills expand top to bottom inside each node',
  'plan.goal': 'Task goal',
  'plan.task': 'Task',
  'plan.compositeSkill': 'Composite skill',
  'plan.compositeCount': 'composite nodes',
  'plan.leafCount': 'leaf skills',
  'plan.brief': 'Execution brief',
  'plan.briefId': 'brief',
  'plan.briefState': 'state',
  'plan.queue': 'queue position',
  'plan.submitRefused': 'Submit refused',
  'plan.brief.queued': 'queued',
  'plan.brief.running': 'running',
  'plan.brief.stalled': 'stalled (no live runtime for this session)',
  'plan.brief.done': 'done',
  'plan.brief.failed': 'failed',
  'plan.brief.cancelled': 'cancelled',
  'sub.library': 'Browse the complete RoboCasa taxonomy, compositions and stages, alongside runtime skills with real policy/driver bindings.',
  'library.taxonomy': 'Skill tree',
  'library.runtime': 'Runtime skills',
  'library.layout': 'Skill tree layout',
  'library.overallGraph': 'Overall Skill Tree',
  'library.outlineTree': 'Outline Tree',
  'library.graphSource': 'Source · unified_skill_graph.json',
  'library.children': 'children',
  'library.search': 'Search skills, datasets, or stages',
  'library.bindingFilter': 'Binding filter',
  'library.filter.all': 'All',
  'library.filter.bound': 'Directly bound',
  'library.filter.unbound': 'Not directly bound',
  'library.refresh': 'Refresh',
  'library.graphSkills': 'Graph skills',
  'library.directBound': 'Direct bindings',
  'library.runtimeSkills': 'Runtime skills',
  'library.tasks': 'Task bindings',
  'library.episodes': 'Annotation episodes',
  'library.noMatch': 'No skills match the filters',
  'library.selectSkill': 'Select a node in the skill tree to inspect stages, composition, labels, dataset evidence, and binding state.',
  'library.kind.root': 'root',
  'library.kind.category': 'category',
  'library.kind.observed_skill': 'observed skill',
  'library.kind.canonical_skill': 'canonical skill',
  'library.categoryHint': 'This category organizes the IS_A taxonomy; it is not a dispatchable skill.',
  'library.annotationExecutable': 'annotation executable flag',
  'library.stages': 'Stages (HAS_STAGE / REALIZES)',
  'library.decomposition': 'Composition (DECOMPOSES_TO)',
  'library.bindingTasks': 'Directly bound tasks',
  'library.noDirectBinding': 'No same-name runtime binding; this graph node cannot execute directly.',
  'library.candidates': 'Same-canonical implementation candidates (not direct bindings)',
  'library.datasets': 'Observed datasets',
  'library.labels': 'Annotation labels',
  'library.frames': 'Annotated frames',
  'library.skillEpisodes': 'Episode support',
  'library.none': 'None',
  'library.canonical': 'Canonical concept',
  'view.evolution': 'Generations',
  'view.cards': 'Capability cards',
  'view.ledger': 'Ledger',
  'view.rsi': 'Evolution',
  'sub.rsi': 'The self-improvement side at a glance: campaign progress, battle gates, generation Δpp, and the budget ledger.',
  'rsi.battle': 'Battle report',
  'sub.evolution': "Each generation's score change vs the previous, and whether it was promoted.",
  'sub.cards': 'Installed skills/capabilities: actuation, whether sim is needed, task bindings.',
  'sub.ledger': 'Budget usage per seed block: burned / reserved / planned.',
  'loading': 'Loading…',
  'unavailable': 'Data plane unavailable (board bridge not mounted)',
  'stores': 'Campaigns',
  'selectStore': 'Select a campaign to see its generation evolution',
  'generations': 'Generations',
  'noGenerations': 'No generation records',
  'emptyStores': "No campaign data yet. A campaign is one task's multi-generation self-improvement; each generation scores dev / blind / held-out and is judged for promotion.",
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
  'progressSucceeded': 'succeeded',
  'progressEta': 'ETA',
  'progressFirstDeath': 'first-death top3',
  'noCards': "No capability cards yet. Each card comes from an installed plugin's manifest.toml — the skills it provides, its actuation, and its task bindings.",
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
  'noLedger': 'No block budget in STATUS.md yet. The ledger tracks budget burned / reserved / planned per seed block.',
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
  'viewfinder': 'Viewfinder',
  'on': 'on',
  'off': 'off',
  'mcnemar.tip': 'McNemar test: looks only at items this generation fixed vs broke, to judge whether the change is truly better (not luck).',
  'firstDeath.tip': 'First death: the first node that fails in an episode; shown here are the three most common causes in the current batch.',
  'heldout.tip': 'Held-out set: items never seen during training, used to honestly check generalization and prevent memorized answers.',
  'promoted.tip': 'Promoted: this generation passed the dev / blind / held-out gates and became the new baseline.',
  'delta.tip': 'Δpp: change in success rate vs the previous generation, in percentage points.',
  'seedBlock.tip': 'Seed block: a range of task seed numbers; budget is allocated and consumed per block.',
  'mountPlan.tip': 'Mount plan: fingerprint (sha) of the plugin/skill set loaded at boot — confirms which configuration is running.',
  'viewfinder.tip': "Viewfinder: the robot camera's live render toggle; on = rendering frames, off = not.",
  'chips.title': 'Task shortcuts',
  'chips.stack': 'stack task',
  'chips.stack.template': 'Start a stack grasp task: seed=0, render on. Outline the plan, then run.',
  'chips.lift': 'lift_geometric task',
  'chips.lift.template': 'Start a lift_geometric task: seed=0, render on. Outline the plan, then run.',
  'chips.battle': 'latest battle report',
  'chips.battle.template': "Open the latest battle report and summarize the most recent campaign's held-out result.",
  'chips.recycle': 'recycle cans',
  'chips.recycle.template':
    'Start a recycle_cans long-horizon task: seed=4243, session=session-robocasa, max_actuations=48. Outline the plan, then run.',
  'chips.packLunch': 'pack lunch',
  'chips.packLunch.template':
    'Start a pack_lunch long-horizon task: seed=4250, session=session-robocasa, max_actuations=48. Outline the plan, then run.',
  'chips.steamPrep': 'steam prep',
  'chips.steamPrep.template':
    'Start a steam_prep long-horizon task: seed=4250, session=session-robocasa, max_actuations=32. No sink driver yet -- expect an honest water-on failure. Outline the plan, then run.',
  'chips.rsi': 'RSI-improve kitchen_thaw',
  'chips.rsi.template':
    'RSI-improve kitchen_thaw: submit {"kind":"rsi","task":"kitchen_thaw"} to an evolution-mode session. The task name is the whole brief -- the runtime allocates the seed blocks, calibrates, scores the go/no-go gate, seals the prereg, runs dev and held-out. The target node comes from first-death attribution; do not pick it yourself. Outline the plan, then run.',
  'progressTargetNode': 'target node',
  'stage.calibrate': 'calibrate',
  'stage.gate': 'gate',
  'stage.dev': 'dev generations',
  'stage.done': 'done',
  'stage.stopped': 'stopped at gate',
  'rsi.run': 'Run RSI',
  'rsi.taskPick': 'pick a task',
  'rsi.sessionPick': 'pick an evolution session',
  'rsi.noTasks': 'No capability card declares task_bindings — install a plugin with a task binding first.',
  'rsi.noSessions': 'No evolution-mode runtime session — only an evolution-mode runtime claims an RSI brief.',
  'rsi.stale': 'runtime may be dead (stale)',
  'rsi.submit': 'Submit RSI brief',
  'rsi.submitting': 'Submitting…',
  'rsi.submitted': 'Submitted',
  'rsi.followBelow': 'follow it in the chain stepper below',
  'rsi.submitFailed': 'Submit failed',
  'rsi.noChain': 'No RSI chain heartbeat yet. Submit an RSI brief and the chain progress appears here.',
  'rsi.criteria': 'gate criteria',
  'rsi.criteria.tip': 'The six preregistered criteria (c1..c6): all green means GO; red is a criterion the measurement tripped. NO-GO is an honest result, not an error.',
  'rsi.honestNoGo': 'honest NO-GO (a normal result, not an error)',
  'rsi.firstDeath': 'first-death distribution',
  'rsi.step.allocate': 'allocate',
  'rsi.step.calibrate': 'calibrate',
  'rsi.step.gate': 'gate',
  'rsi.step.prereg': 'prereg',
  'rsi.step.dev': 'dev',
  'rsi.step.heldout': 'held-out',
  'rsi.step.install': 'install',
}
