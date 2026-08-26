/** `phpanels` namespace dictionaries: tab labels + one-line subtitles, empty-state
 * explainers, jargon tooltips, and field labels for the 代际进化 / 能力卡 / 账本
 * panels, the status bar, and the 任务台 composer chips. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'phpanels'

/** The phpanels dictionary key set (source of truth for both locales). */
export type PhPanelsKey =
  | 'view.evolution'
  | 'view.cards'
  | 'view.ledger'
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

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 代际进化/能力卡/账本 tab labels, subtitles, field labels, and status-bar copy. */
    'phpanels': PhPanelsKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<PhPanelsKey, string> = {
  'view.evolution': '代际进化',
  'view.cards': '能力卡',
  'view.ledger': '账本',
  'view.rsi': '演化台',
  'sub.rsi': '自我进化侧的全景：战役进度、战报门禁、代际 Δpp 与预算账本',
  'rsi.battle': '战报',
  'sub.evolution': '每一代改动相对上一代的成绩变化和是否晋级',
  'sub.cards': '已装的技能/能力：驱动方式、是否需仿真、任务绑定',
  'sub.ledger': '各 seed 区块的预算占用：已烧 / 预留 / 计划',
  'loading': '加载中…',
  'unavailable': '数据面不可用（board bridge 未挂载）',
  'stores': '战役',
  'selectStore': '选择一个战役查看代际演进',
  'generations': '代际',
  'noGenerations': '无代际记录',
  'emptyStores': '还没有战役数据。战役 = 一次针对某任务的多代自我改进；每代会打 dev/盲测/留出集分数并判定是否晋级。',
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
  'campaigns': '战役',
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
  'promoted.tip': '晋级：这一代通过了 dev / 盲测 / 留出集的门槛，被采纳为新基线。',
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
  'chips.battle.template': '打开最新战报，用最近一次战役的 held-out 结果做小结。',
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
}

/** English dictionary. */
export const en: Record<PhPanelsKey, string> = {
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
}
