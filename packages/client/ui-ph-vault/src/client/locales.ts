/** `phvault` namespace dictionaries: the 技能库 (Skill Vault) wiki view copy. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'phvault'

/** The phvault dictionary key set (source of truth for both locales). */
export type PhVaultKey =
  | 'view.vault'
  | 'loading'
  | 'unavailable'
  | 'empty'
  | 'search.placeholder'
  | 'back'
  | 'filter.kind'
  | 'filter.status'
  | 'filter.rel'
  | 'kind.skill'
  | 'kind.package'
  | 'kind.capability'
  | 'status.promoted'
  | 'status.candidate'
  | 'status.retired'
  | 'privileged'
  | 'wontTransfer'
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
  | 'legend.node'
  | 'legend.title'
  | 'legend.relations'
  | 'graph.hint'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 技能库 skill-vault wiki view copy. */
    'phvault': PhVaultKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<PhVaultKey, string> = {
  'view.vault': '技能库',
  'loading': '加载中…',
  'unavailable': '数据面不可用（board bridge 未挂载）',
  'empty': '技能库为空——尚无封存技能或机箱',
  'search.placeholder': '搜索技能 / 任务 / 机箱…',
  'back': '← 返回图谱',
  'filter.kind': '类型',
  'filter.status': '状态',
  'filter.rel': '关系',
  'kind.skill': '技能',
  'kind.package': '机箱',
  'kind.capability': '能力',
  'status.promoted': '已晋级',
  'status.candidate': '候选',
  'status.retired': '已退役',
  'privileged': '特权',
  'wontTransfer': '依赖仿真特权读数——无法迁移到真实机器人',
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
  'legend.node': '节点',
  'legend.title': '图例',
  'legend.relations': '关系',
  'graph.hint': '单击节点聚焦其连边 · 双击打开词条页',
}

/** English dictionary. */
export const en: Record<PhVaultKey, string> = {
  'view.vault': 'Skill Vault',
  'loading': 'Loading…',
  'unavailable': 'Data plane unavailable (board bridge not mounted)',
  'empty': 'Vault empty — no sealed skills or cards yet',
  'search.placeholder': 'Search skills / tasks / cards…',
  'back': '← Back to graph',
  'filter.kind': 'Kind',
  'filter.status': 'Status',
  'filter.rel': 'Relation',
  'kind.skill': 'skill',
  'kind.package': 'card',
  'kind.capability': 'capability',
  'status.promoted': 'promoted',
  'status.candidate': 'candidate',
  'status.retired': 'retired',
  'privileged': 'privileged',
  'wontTransfer': 'Leans on a simulator-only privileged read — will not transfer to a real robot',
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
  'legend.node': 'node',
  'legend.title': 'Legend',
  'legend.relations': 'Relations',
  'graph.hint': 'Click a node to focus its edges · double-click for its wiki page',
}
