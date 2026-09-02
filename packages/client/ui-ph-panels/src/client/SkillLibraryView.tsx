/** Skill Library view: the annotation-derived IS_A taxonomy, authored
 * compositions, and the installed runtime skill catalogues. The harness sends
 * one union record and owns every binding verdict; this component only filters,
 * selects, and renders it. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PhPanelsKey } from './locales.ts'
import { PanelFrame } from './chrome.tsx'
import css from './panels.module.css'

export interface SkillLibraryInjected {
  fetchSkillLibrary: () => Promise<RemoteResult<unknown>>
}

interface Stage { stage?: string; name?: string; realizes?: string | null }
interface EvidenceInstruction { text?: string; count?: number }
interface GraphNode {
  id: string
  name: string
  kind: 'root' | 'category' | 'observed_skill' | 'canonical_skill'
  parent?: string | null
  taxonomy_path?: string[]
  graph_executable?: boolean
  stages?: Stage[]
  decomposition?: string[]
  evidence?: { datasets?: string[]; instructions?: EvidenceInstruction[]; episodes?: number | null; frames?: number | null }
  bound?: boolean
  binding_tasks?: string[]
  implementation_candidates?: string[]
}
interface RuntimeBinding {
  task?: string
  policy?: string
  args?: Record<string, string>
  description?: string | null
}
interface RuntimeSkill { name: string; canonical?: string | null; bindings?: RuntimeBinding[] }
interface SkillLibraryResult {
  error?: string
  graph?: { root?: string; nodes?: GraphNode[]; recipes?: { skill?: string; steps?: string[] }[] }
  runtime_skills?: RuntimeSkill[]
  summary?: {
    graph_skills?: number
    graph_directly_bound?: number
    graph_unbound?: number
    runtime_skills?: number
    task_bindings?: number
  }
  provenance?: { datasets_analyzed?: number; episodes_analyzed?: number; sha256?: string }
}

type Mode = 'taxonomy' | 'runtime'
type TaxonomyLayout = 'graph' | 'outline'
type BindFilter = 'all' | 'bound' | 'unbound'

const kindKey = (kind: GraphNode['kind']): PhPanelsKey => `library.kind.${kind}`
const includesQuery = (node: GraphNode, query: string): boolean => {
  if (query === '') return true
  const haystack = [node.name, ...(node.taxonomy_path ?? []), ...(node.evidence?.datasets ?? []),
    ...(node.stages ?? []).flatMap(stage => [stage.stage ?? '', stage.realizes ?? ''])].join(' ').toLowerCase()
  return haystack.includes(query)
}

export function SkillLibraryView({ fetchSkillLibrary, t }:
  ConvViewProps & InjectFace<SkillLibraryInjected> & PropsLocale<'phpanels'>) {
  const [data, setData] = useState<SkillLibraryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('taxonomy')
  const [taxonomyLayout, setTaxonomyLayout] = useState<TaxonomyLayout>('graph')
  const [query, setQuery] = useState('')
  const [binding, setBinding] = useState<BindFilter>('all')
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const reply = await fetchSkillLibrary()
      if (!reply.ok) { setError(reply.error.message); return }
      const value = reply.value as SkillLibraryResult
      if (value.error !== undefined) { setError(value.error); return }
      setData(value); setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [fetchSkillLibrary])
  useEffect(() => { void load() }, [load])

  const nodes = useMemo(() => data?.graph?.nodes ?? [], [data])
  const byId = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes])
  const children = useMemo(() => {
    const map = new Map<string, GraphNode[]>()
    for (const node of nodes) {
      if (node.parent === null || node.parent === undefined) continue
      const rows = map.get(node.parent) ?? []
      rows.push(node); map.set(node.parent, rows)
    }
    for (const rows of map.values()) rows.sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [nodes])
  const q = query.trim().toLowerCase()
  const visibleIds = useMemo(() => {
    const visible = new Set<string>()
    const visit = (node: GraphNode): boolean => {
      const own = includesQuery(node, q)
        && (binding === 'all' || (binding === 'bound' ? node.bound === true : node.kind === 'root' || node.kind === 'category' || node.bound !== true))
      let descendant = false
      for (const child of children.get(node.id) ?? []) {
        if (visit(child)) descendant = true
      }
      if (own || descendant) visible.add(node.id)
      return own || descendant
    }
    const top = nodes.filter(node => node.parent === null || node.parent === undefined)
    for (const node of top) visit(node)
    return visible
  }, [nodes, children, q, binding])
  const nodeMatches = useCallback((node: GraphNode): boolean => visibleIds.has(node.id), [visibleIds])
  const root = data?.graph?.root ? byId.get(data.graph.root) : undefined
  const selectedNode = selected === null ? undefined : byId.get(selected)
  const runtime = (data?.runtime_skills ?? []).filter((row) => {
    if (q === '') return true
    return [row.name, row.canonical ?? '', ...(row.bindings ?? []).flatMap(b => [b.task ?? '', b.policy ?? ''])]
      .join(' ').toLowerCase().includes(q)
  })

  return (
    <PanelFrame title={t('view.library')} sub={t('sub.library')}>
      {data === null ? <div className={css.state}>{error === null ? t('loading') : `${t('unavailable')} — ${error}`}</div> : (
        <div className={css.libraryBody}>
          <div className={css.libraryToolbar}>
            <button type="button" className={`${css.libraryTab} ${mode === 'taxonomy' ? css.libraryTabActive : ''}`} onClick={() => { setMode('taxonomy') }}>{t('library.taxonomy')}</button>
            <button type="button" className={`${css.libraryTab} ${mode === 'runtime' ? css.libraryTabActive : ''}`} onClick={() => { setMode('runtime') }}>{t('library.runtime')}</button>
            <input className={css.librarySearch} aria-label={t('library.search')}
              placeholder={t('library.search')} value={query}
              onChange={(e) => { setQuery(e.target.value) }} />
            {mode === 'taxonomy' ? (
              <>
                <div className={css.libraryLayoutSwitch} aria-label={t('library.layout')}>
                  <button type="button" className={`${css.libraryTab} ${taxonomyLayout === 'graph' ? css.libraryTabActive : ''}`}
                    onClick={() => { setTaxonomyLayout('graph') }}>{t('library.overallGraph')}</button>
                  <button type="button" className={`${css.libraryTab} ${taxonomyLayout === 'outline' ? css.libraryTabActive : ''}`}
                    onClick={() => { setTaxonomyLayout('outline') }}>{t('library.outlineTree')}</button>
                </div>
                <select className={css.librarySelect} aria-label={t('library.bindingFilter')}
                  value={binding} onChange={(e) => { setBinding(e.target.value as BindFilter) }}>
                  <option value="all">{t('library.filter.all')}</option>
                  <option value="bound">{t('library.filter.bound')}</option>
                  <option value="unbound">{t('library.filter.unbound')}</option>
                </select>
              </>
            ) : null}
            <button type="button" className={css.libraryTab} onClick={() => { void load() }}>{t('library.refresh')}</button>
          </div>
          <div className={css.libraryStats}>
            <Stat label={t('library.graphSkills')} value={data.summary?.graph_skills} />
            <Stat label={t('library.directBound')} value={data.summary?.graph_directly_bound} />
            <Stat label={t('library.runtimeSkills')} value={data.summary?.runtime_skills} />
            <Stat label={t('library.tasks')} value={data.summary?.task_bindings} />
            <Stat label={t('library.episodes')} value={data.provenance?.episodes_analyzed} />
          </div>
          {mode === 'taxonomy' ? (
            <div className={`${css.librarySplit} ${taxonomyLayout === 'graph' ? css.librarySplitGraph : ''}`}>
              <div className={taxonomyLayout === 'graph' ? css.skillMapViewport : css.libraryTree}
                aria-label={taxonomyLayout === 'graph' ? t('library.overallGraph') : t('library.outlineTree')}>
                {root === undefined || !nodeMatches(root) ? <div className={css.state}>{t('library.noMatch')}</div>
                  : taxonomyLayout === 'graph'
                    ? (
                      <div className={css.skillMapCanvas}>
                        <div className={css.skillMapSource}>{t('library.graphSource')}</div>
                        <ul className={css.skillMapTree}>
                          <SkillMapNode node={root} children={children} matches={nodeMatches}
                            selected={selected} onSelect={setSelected} t={t} />
                        </ul>
                      </div>
                    )
                    : <TreeNode node={root} children={children} matches={nodeMatches} selected={selected} onSelect={setSelected} t={t} />}
              </div>
              <div className={css.libraryDetail}>
                {selectedNode === undefined ? <div className={css.state}>{t('library.selectSkill')}</div> : <GraphDetail node={selectedNode} t={t} />}
              </div>
            </div>
          ) : (
            <div className={css.runtimeGrid}>
              {runtime.length === 0 ? <div className={css.state}>{t('library.noMatch')}</div> : runtime.map(row => <RuntimeCard key={row.name} row={row} t={t} />)}
            </div>
          )}
        </div>
      )}
    </PanelFrame>
  )
}

const mapKindClass = (kind: GraphNode['kind']): string => {
  if (kind === 'root') return css.skillMapNodeRoot ?? ''
  if (kind === 'category') return css.skillMapNodeCategory ?? ''
  if (kind === 'canonical_skill') return css.skillMapNodeCanonical ?? ''
  return css.skillMapNodeObserved ?? ''
}

function SkillMapNode({ node, children, matches, selected, onSelect, t }: {
  node: GraphNode
  children: Map<string, GraphNode[]>
  matches: (n: GraphNode) => boolean
  selected: string | null
  onSelect: (id: string) => void
} & PropsLocale<'phpanels'>) {
  const rows = (children.get(node.id) ?? []).filter(matches)
  return (
    <li>
      <button type="button"
        className={`${css.skillMapNode} ${mapKindClass(node.kind)} ${selected === node.id ? css.skillMapNodeActive : ''}`}
        onClick={() => { onSelect(node.id) }}>
        <span className={css.skillMapNodeKind}>{t(kindKey(node.kind))}</span>
        <strong>{node.name}</strong>
        {node.kind === 'observed_skill' || node.kind === 'canonical_skill' ? (
          <span className={css.skillMapBinding}>
            <i className={node.bound === true ? css.skillMapBound : css.skillMapUnbound} />
            {node.bound === true ? t('plan.bound') : t('plan.unbound')}
          </span>
        ) : <span className={css.skillMapChildren}>{rows.length} {t('library.children')}</span>}
      </button>
      {rows.length > 0 ? (
        <ul>
          {rows.map(row => <SkillMapNode key={row.id} node={row} children={children}
            matches={matches} selected={selected} onSelect={onSelect} t={t} />)}
        </ul>
      ) : null}
    </li>
  )
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return <span className={css.libraryStat}><span>{label}</span><strong>{value ?? '—'}</strong></span>
}

function TreeNode({ node, children, matches, selected, onSelect, t }: {
  node: GraphNode
  children: Map<string, GraphNode[]>
  matches: (n: GraphNode) => boolean
  selected: string | null
  onSelect: (id: string) => void
} & PropsLocale<'phpanels'>) {
  const rows = (children.get(node.id) ?? []).filter(matches)
  const branch = rows.length > 0
  const label = (
    <button type="button" className={`${css.treeRow} ${selected === node.id ? css.treeRowActive : ''}`} onClick={() => { onSelect(node.id) }}>
      <span className={css.treeName}>{node.name}</span>
      <span className={css.treeKind}>{t(kindKey(node.kind))}</span>
      {node.kind === 'observed_skill' || node.kind === 'canonical_skill' ? (
        <span className={`${css.planChip} ${node.bound === true ? css.planChipBound : css.planChipUnbound}`}>{node.bound === true ? t('plan.bound') : t('plan.unbound')}</span>
      ) : null}
    </button>
  )
  if (!branch) return <div className={css.treeLeaf}>{label}</div>
  return (
    <details className={css.treeBranch} open>
      <summary>{label}</summary>
      <div className={css.treeChildren}>
        {rows.map(row => <TreeNode key={row.id} node={row} children={children}
          matches={matches} selected={selected} onSelect={onSelect} t={t} />)}
      </div>
    </details>
  )
}

function GraphDetail({ node, t }: { node: GraphNode } & PropsLocale<'phpanels'>) {
  return (
    <div className={css.skillDetailCard}>
      <div className={css.skillDetailHead}>
        <span className={css.title}>{node.name}</span>
        <span className={css.badge}>{t(kindKey(node.kind))}</span>
      </div>
      <div className={css.skillPath}>{node.taxonomy_path?.join(' › ') ?? '—'}</div>
      {node.kind === 'root' || node.kind === 'category' ? <p className={css.planMeta}>{t('library.categoryHint')}</p> : (
        <>
          <div className={css.badgeRow}>
            <span className={`${css.planChip} ${node.bound === true ? css.planChipBound : css.planChipUnbound}`}>{node.bound === true ? t('plan.bound') : t('plan.unbound')}</span>
            <span className={css.badge}>{t('library.annotationExecutable')}: {node.graph_executable === true ? t('yes') : t('no')}</span>
          </div>
          <DetailSection title={t('library.stages')} empty={t('library.none')} rows={(node.stages ?? []).map(s => `${s.stage ?? '—'}${s.realizes ? ` → ${s.realizes}` : ''}`)} />
          <DetailSection title={t('library.decomposition')} empty={t('library.none')} rows={(node.decomposition ?? []).length > 0 ? [(node.decomposition ?? []).join(' → ')] : []} />
          <DetailSection title={t('library.bindingTasks')} empty={t('library.noDirectBinding')} rows={node.binding_tasks ?? []} />
          <DetailSection title={t('library.candidates')} empty={t('library.none')} rows={node.implementation_candidates ?? []} />
          <DetailSection title={t('library.datasets')} empty={t('library.none')} rows={node.evidence?.datasets ?? []} />
          <DetailSection title={t('library.labels')} empty={t('library.none')} rows={(node.evidence?.instructions ?? []).map(i => `${i.text ?? '—'} × ${i.count ?? '—'}`)} />
          <div className={css.planMeta}>{t('library.skillEpisodes')}: {node.evidence?.episodes ?? '—'}</div>
          <div className={css.planMeta}>{t('library.frames')}: {node.evidence?.frames ?? '—'}</div>
        </>
      )}
    </div>
  )
}

function DetailSection({ title, rows, empty }: { title: string; rows: string[]; empty: string }) {
  return <section><div className={css.sectionHead}>{title}</div>{rows.length === 0 ? <div className={css.planMeta}>{empty}</div> : <ul className={css.skillDetailList}>{rows.map((row, i) => <li key={`${row}-${i}`}>{row}</li>)}</ul>}</section>
}

function RuntimeCard({ row, t }: { row: RuntimeSkill } & PropsLocale<'phpanels'>) {
  return (
    <div className={css.card}>
      <div className={css.skillDetailHead}><span className={css.cardName}>{row.name}</span><span className={`${css.planChip} ${css.planChipBound}`}>{t('plan.bound')}</span></div>
      {row.canonical ? <div className={css.planMeta}>{t('library.canonical')}: {row.canonical}</div> : null}
      {(row.bindings ?? []).map((binding, i) => (
        <div key={`${binding.task ?? ''}-${i}`} className={css.runtimeBinding}>
          <strong>{binding.task ?? '—'}</strong>
          <span className={css.planMono}>{binding.policy ?? '—'}</span>
          <span className={css.planMeta}>{t('plan.node.args')}: {JSON.stringify(binding.args ?? {})}</span>
          {binding.description ? <span>{binding.description}</span> : null}
        </div>
      ))}
    </div>
  )
}
