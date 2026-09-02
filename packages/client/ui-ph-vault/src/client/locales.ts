/** `phvault` namespace dictionaries: the 技能库 (Skill Library) wiki view copy. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'phvault'

/** The phvault dictionary key set (source of truth for both locales). */
export type PhVaultKey =
  | 'view.vault'
  | 'loading'
  | 'unavailable'
  | 'empty'
  | 'search.placeholder'
  | 'pane.tree'
  | 'pane.detail'
  | 'pane.collapse'
  | 'pane.expand'
  | 'tree.legacy'
  | 'tree.history'
  | 'filter.benchmark'
  | 'filter.embodiment'
  | 'filter.all'
  | 'detail.none'
  | 'kind.skill'
  | 'kind.class'
  | 'kind.benchmark'
  | 'kind.package'
  | 'kind.capability'
  | 'status.promoted'
  | 'status.candidate'
  | 'status.retired'
  | 'status.library'
  | 'privileged'
  | 'wontTransfer'
  | 'lib.contract'
  | 'lib.requires'
  | 'lib.ensures'
  | 'lib.clobbers'
  | 'lib.args'
  | 'lib.limits'
  | 'lib.bindings'
  | 'bind.embodiment'
  | 'bind.executor'
  | 'bind.transport'
  | 'bind.ref'
  | 'bind.sha'
  | 'lib.evidence'
  | 'lib.deps'
  | 'dep.out'
  | 'dep.in'
  | 'lib.benchmarks'
  | 'lib.failureModes'
  | 'lib.cards'
  | 'class.skills'
  | 'class.benchmarks'
  | 'class.dependsOn'
  | 'class.dependedBy'
  | 'bench.missions'
  | 'pkg.uses'
  | 'back'
  | 'bench.embodiment'
  | 'bench.tasks'
  | 'bench.arms'
  | 'bench.card'
  | 'bench.skills'
  | 'node.trigger'
  | 'node.recovery'
  | 'node.evidence'
  | 'node.heldout'
  | 'node.judgementDev'
  | 'node.ablation'
  | 'node.lineage'
  | 'node.governs'
  | 'node.requires'
  | 'node.backlinks'
  | 'node.provides'
  | 'node.binds'
  | 'node.campaigns'
  | 'node.bundles'
  | 'node.claim'
  | 'node.claimSealed'
  | 'node.flags'
  | 'node.contract'
  | 'node.doc'
  | 'node.note'
  | 'ev.governed'
  | 'ev.base'
  | 'ev.delta'
  | 'ev.p'
  | 'ev.n'
  | 'ev.fixed'
  | 'ev.noise'
  | 'ev.none'
  | 'legend.title'
  | 'legend.relations'
  | 'legend.capability'
  | 'legend.package'
  | 'legend.skill'
  | 'graph.hint'
  | 'graph.instances'
  | 'mode.cards'
  | 'mode.skills'
  | 'mode.all'
  | 'tog.DEPENDS_ON'
  | 'tog.CONTRACT'
  | 'tog.INSTANCE_OF'
  | 'tog.BOUND_TO'
  | 'tog.USES'
  | 'tog.PROVIDES'
  | 'tog.MOUNTED_IN'
  | 'tog.EVIDENCED_ON'
  | 'tog.HISTORY'
  | 'add.bound'
  | 'add.all'
  | 'add.clear'
  | 'col.capability'
  | 'col.package'
  | 'col.skill'
  | 'col.predicate'
  | 'group.embodiment'
  | 'group.provider'
  | 'group.mission'
  | 'group.other'
  | 'pkg.boundSkills'
  | 'cap.providedBy'
  | 'minimapShow'
  | 'minimapHide'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 技能库 skill-library wiki view copy. */
    'phvault': PhVaultKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<PhVaultKey, string> = {
  'view.vault': '技能库',
  'loading': '加载中…',
  'unavailable': '数据面不可用（board bridge 未挂载）',
  'empty': '技能库为空——尚无技能记录或机箱',
  'search.placeholder': '搜索技能 / 类 / 机箱…',
  'pane.tree': '分类',
  'pane.detail': '详情',
  'pane.collapse': '收起',
  'pane.expand': '展开',
  'tree.legacy': '卡片与能力',
  'tree.history': '历史记录',
  'filter.benchmark': '基准',
  'filter.embodiment': '具身',
  'filter.all': '全部',
  'detail.none': '在左侧或图谱中选一个节点',
  'kind.skill': '技能',
  'kind.class': '类',
  'kind.benchmark': '基准',
  'kind.package': '机箱',
  'kind.capability': '能力',
  'status.promoted': '已通过 (promoted)',
  'status.candidate': '候选',
  'status.retired': '已退役',
  'status.library': '技能库',
  'privileged': '特权',
  'wontTransfer': '依赖仿真特权读数——无法迁移到真实机器人',
  'lib.contract': '契约',
  'lib.requires': '前置',
  'lib.ensures': '保证',
  'lib.clobbers': '破坏',
  'lib.args': '参数',
  'lib.limits': '限制',
  'lib.bindings': '绑定与执行器',
  'bind.embodiment': '具身',
  'bind.executor': '执行器',
  'bind.transport': '传输',
  'bind.ref': '引用',
  'bind.sha': 'sha',
  'lib.evidence': '证据',
  'lib.deps': '依赖',
  'dep.out': '依赖于',
  'dep.in': '被依赖',
  'lib.benchmarks': '基准',
  'lib.failureModes': '失败模式',
  'lib.cards': '所在卡片',
  'class.skills': '技能',
  'class.benchmarks': '覆盖的基准',
  'class.dependsOn': '依赖的类',
  'class.dependedBy': '被依赖的类',
  'bench.missions': '覆盖的任务',
  'pkg.uses': '使用的技能',
  'back': '返回',
  'bench.embodiment': '具身',
  'bench.tasks': '任务',
  'bench.arms': '臂',
  'bench.card': '所在卡片',
  'bench.skills': '覆盖的技能',
  'node.trigger': '触发条件（affordance）',
  'node.recovery': '恢复策略',
  'node.evidence': '证据（逐字取自封存记录）',
  'node.heldout': '留出集',
  'node.judgementDev': '开发集裁定',
  'node.ablation': '特权消融梯度',
  'node.lineage': '血统（DESCENDS_FROM）',
  'node.governs': '治理过的任务节点',
  'node.requires': '依赖能力',
  'node.backlinks': '反向链接',
  'node.provides': '提供能力',
  'node.binds': '绑定任务',
  'node.campaigns': 'campaigns',
  'node.bundles': '覆盖层',
  'node.claim': '声明（可复跑半）',
  'node.claimSealed': '封存声明',
  'node.flags': '机箱标记',
  'node.contract': '契约',
  'node.doc': '说明',
  'node.note': '批注',
  'ev.governed': '受治理率',
  'ev.base': '基线率',
  'ev.delta': '增量',
  'ev.p': 'p 值',
  'ev.n': 'n',
  'ev.fixed': '修复数',
  'ev.noise': '噪声',
  'ev.none': '无',
  'legend.title': '图例：三层的边界',
  'legend.relations': '边',
  'legend.capability': '能力 = 内核的接口槽位（embodiment.env、policy.driver、task.planner 等 10 个固定名字）',
  'legend.package': '卡片 = 带 manifest 的插件目录，安装单元；提供（PROVIDES）能力，承载执行器',
  'legend.skill': '技能 = SkillRecord：符号契约（前置 / 保证 / 破坏）+ 绑定到某张卡片的执行器（BOUND_TO）+ 证据',
  'graph.hint': '单击节点选中——树与详情同步',
  'graph.instances': '实例',
  'mode.cards': '能力与卡片',
  'mode.skills': '技能',
  'mode.all': '全部',
  'tog.DEPENDS_ON': '依赖',
  'tog.CONTRACT': '前置/保证',
  'tog.INSTANCE_OF': '实例',
  'tog.BOUND_TO': '绑定',
  'tog.USES': '使用',
  'tog.PROVIDES': '提供',
  'tog.MOUNTED_IN': '挂载',
  'tog.EVIDENCED_ON': '证据',
  'tog.HISTORY': '历史',
  'add.bound': '添加技能',
  'add.all': '添加全部技能',
  'add.clear': '清空',
  'col.capability': '能力',
  'col.package': '卡片',
  'col.skill': '技能',
  'col.predicate': '谓词',
  'group.embodiment': '具身',
  'group.provider': '执行器 / 策略',
  'group.mission': '任务 / 基准',
  'group.other': '其他',
  'pkg.boundSkills': '绑定到它的技能',
  'cap.providedBy': '提供它的卡片',
  'minimapShow': '显示缩略图',
  'minimapHide': '隐藏缩略图',
}

/** English dictionary. */
export const en: Record<PhVaultKey, string> = {
  'view.vault': 'Skill Library',
  'loading': 'Loading…',
  'unavailable': 'Data plane unavailable (board bridge not mounted)',
  'empty': 'Library empty — no skill records or cards yet',
  'search.placeholder': 'Search skills / classes / cards…',
  'pane.tree': 'Classes',
  'pane.detail': 'Detail',
  'pane.collapse': 'Collapse',
  'pane.expand': 'Expand',
  'tree.legacy': 'Cards & capabilities',
  'tree.history': 'History',
  'filter.benchmark': 'Benchmark',
  'filter.embodiment': 'Embodiment',
  'filter.all': 'all',
  'detail.none': 'Pick a node in the tree or the graph',
  'kind.skill': 'skill',
  'kind.class': 'class',
  'kind.benchmark': 'benchmark',
  'kind.package': 'card',
  'kind.capability': 'capability',
  'status.promoted': 'promoted',
  'status.candidate': 'candidate',
  'status.retired': 'retired',
  'status.library': 'library',
  'privileged': 'privileged',
  'wontTransfer': 'Leans on a simulator-only privileged read — will not transfer to a real robot',
  'lib.contract': 'Contract',
  'lib.requires': 'requires',
  'lib.ensures': 'ensures',
  'lib.clobbers': 'clobbers',
  'lib.args': 'Args',
  'lib.limits': 'Limits',
  'lib.bindings': 'Bindings & executors',
  'bind.embodiment': 'embodiment',
  'bind.executor': 'executor',
  'bind.transport': 'transport',
  'bind.ref': 'ref',
  'bind.sha': 'sha',
  'lib.evidence': 'Evidence',
  'lib.deps': 'Dependencies',
  'dep.out': 'depends on',
  'dep.in': 'depended on by',
  'lib.benchmarks': 'Benchmarks',
  'lib.failureModes': 'Failure modes',
  'lib.cards': 'Cards',
  'class.skills': 'Skills',
  'class.benchmarks': 'Benchmarks covered',
  'class.dependsOn': 'Depends on classes',
  'class.dependedBy': 'Depended on by classes',
  'bench.missions': 'Missions covered',
  'pkg.uses': 'Skills used',
  'back': 'Back',
  'bench.embodiment': 'embodiment',
  'bench.tasks': 'Tasks',
  'bench.arms': 'Arms',
  'bench.card': 'Card',
  'bench.skills': 'Skills covered',
  'node.trigger': 'Trigger (affordance)',
  'node.recovery': 'Recovery',
  'node.evidence': 'Evidence (verbatim from the sealed record)',
  'node.heldout': 'Held-out',
  'node.judgementDev': 'Dev judgement',
  'node.ablation': 'Privilege ablation ladder',
  'node.lineage': 'Lineage (DESCENDS_FROM)',
  'node.governs': 'Governed task nodes',
  'node.requires': 'Requires capability',
  'node.backlinks': 'Backlinks',
  'node.provides': 'Provides capability',
  'node.binds': 'Binds task',
  'node.campaigns': 'campaigns',
  'node.bundles': 'bundles',
  'node.claim': 'Claim (re-runnable half)',
  'node.claimSealed': 'Sealed claim',
  'node.flags': 'Card flags',
  'node.contract': 'Contract',
  'node.doc': 'Doc',
  'node.note': 'Note',
  'ev.governed': 'governed rate',
  'ev.base': 'base rate',
  'ev.delta': 'delta',
  'ev.p': 'p-value',
  'ev.n': 'n',
  'ev.fixed': 'fixed',
  'ev.noise': 'noise',
  'ev.none': 'none',
  'legend.title': 'Legend: the three layers',
  'legend.relations': 'Edges',
  'legend.capability': 'Capability = a kernel interface slot (10 fixed names such as embodiment.env, policy.driver, task.planner)',
  'legend.package': 'Card = a plugin directory with a manifest, the install unit; PROVIDES capabilities and hosts executors',
  'legend.skill': 'Skill = a SkillRecord: symbolic contract (requires / ensures / clobbers) + binding to a card\'s executor (BOUND_TO) + evidence',
  'graph.hint': 'Click a node to select it — the tree and detail follow',
  'graph.instances': 'instances',
  'mode.cards': 'Capabilities & cards',
  'mode.skills': 'Skills',
  'mode.all': 'All',
  'tog.DEPENDS_ON': 'depends',
  'tog.CONTRACT': 'requires/ensures',
  'tog.INSTANCE_OF': 'instances',
  'tog.BOUND_TO': 'bound',
  'tog.USES': 'uses',
  'tog.PROVIDES': 'provides',
  'tog.MOUNTED_IN': 'mounted',
  'tog.EVIDENCED_ON': 'evidence',
  'tog.HISTORY': 'history',
  'add.bound': 'Add skills',
  'add.all': 'Add all skills',
  'add.clear': 'Clear',
  'col.capability': 'Capabilities',
  'col.package': 'Cards',
  'col.skill': 'Skills',
  'col.predicate': 'Predicates',
  'group.embodiment': 'embodiment',
  'group.provider': 'executor / policy',
  'group.mission': 'mission / benchmark',
  'group.other': 'other',
  'pkg.boundSkills': 'Skills bound to it',
  'cap.providedBy': 'Provided by cards',
  'minimapShow': 'Show minimap',
  'minimapHide': 'Hide minimap',
}
