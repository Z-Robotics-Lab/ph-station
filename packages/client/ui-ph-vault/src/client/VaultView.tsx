/**
 * 技能库 (Skill Vault) — the browsable wiki over the harness's sealed skills,
 * packages, and capabilities. One React Flow canvas of the typed relation
 * graph (edges labeled by relation), plus per-node wiki pages that quote the
 * sealed evidence verbatim and expose typed backlinks.
 *
 * Renders only: the graph, every status, and every number come from the board
 * vault fold (board/vault.py); this component filters, lays out (graph.ts),
 * and paints — it computes no statistic. The vault is small (single-digit
 * stores, nine cards, nine capabilities), so it is fetched whole once and the
 * node pages derive from it client-side (the same edges board.vault.node would
 * return), with a slow background refresh.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, Handle, Position, ReactFlow } from '@xyflow/react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  ALL_KINDS, ALL_RELS, ALL_STATUSES, backlinks, indexNodes, layout, NODE_SIZE, outEdges,
} from './graph.ts'
import type {
  CapabilityNode, EvidenceBlock, PackageNode, SkillNode, SkillStatus,
  VaultEdge, VaultFilters, VaultGraph, VaultKind, VaultNode, VaultRel,
} from './graph.ts'
import css from './VaultView.module.css'

/** The single board read this view drives. */
export interface VaultInjected {
  fetchVault: () => Promise<RemoteResult<unknown>>
}

/** Background refresh: the vault changes only when a campaign seals (rare). */
const REFRESH_MS = 15000

/** Edge stroke per relation (kept legible in both themes via the token sheet). */
const REL_COLOR: Record<VaultRel, string> = {
  DESCENDS_FROM: 'var(--dsw-alias-state-business-primary)',
  GOVERNS: 'var(--dsw-alias-state-success-primary, #2e9e5b)',
  REQUIRES: 'var(--dsw-alias-state-error-primary, #d94040)',
  PROVIDES: 'var(--dsw-alias-label-secondary)',
  BINDS: 'var(--dsw-alias-label-tertiary)',
  EVIDENCED_BY: 'var(--dsw-alias-label-tertiary)',
  CLAIMS: 'var(--dsw-alias-state-business-primary)',
  SUPERSEDES: 'var(--dsw-alias-state-warning-primary, #d98a1f)',
  MOUNTED_IN: 'var(--dsw-alias-label-tertiary)',
}

/** Show a board number exactly as it arrived (no rounding the fold did not do). */
function fmt(v: number | undefined | null): string {
  return v === undefined || v === null ? '—' : String(v)
}

// --- custom graph nodes ------------------------------------------------------

/** Left target + right source handles: React Flow v12 drops any edge whose
 * endpoints expose no handle, so every custom node must carry them (LR flow →
 * target on the left, source on the right). Non-interactive and visually muted. */
function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} className={css.handle} />
      <Handle type="source" position={Position.Right} isConnectable={false} className={css.handle} />
    </>
  )
}

function SkillGraphNode({ data }: { data: { node: VaultNode; dimmed: boolean } }) {
  const n = data.node as SkillNode
  return (
    <div className={`${css.gnode} ${css.gskill} ${css[`st_${n.status}`] ?? ''} ${data.dimmed ? css.dim : ''}`}>
      <NodeHandles />
      <div className={css.gnodeTitle}>{n.label ?? n.id.slice(0, 10)}</div>
      <div className={css.gnodeSub}>
        <span className={css.gbadge}>{n.status}</span>
        {n.privilege ? <span className={`${css.gbadge} ${css.gbadgePriv}`}>priv {n.privilege}</span> : null}
      </div>
    </div>
  )
}

function PackageGraphNode({ data }: { data: { node: VaultNode; dimmed: boolean } }) {
  const n = data.node as PackageNode
  return (
    <div className={`${css.gnode} ${css.gpackage} ${data.dimmed ? css.dim : ''}`}>
      <NodeHandles />
      <div className={css.gnodeTitle}>{n.name ?? n.id}</div>
      <div className={`${css.gnodeSub} ${css.mono}`}>{n.id}</div>
    </div>
  )
}

function CapabilityGraphNode({ data }: { data: { node: VaultNode; dimmed: boolean } }) {
  const n = data.node as CapabilityNode
  return (
    <div className={`${css.gnode} ${css.gcapability} ${n.privileged ? css.gcapPriv : ''} ${data.dimmed ? css.dim : ''}`}>
      <NodeHandles />
      <div className={`${css.gnodeTitle} ${css.mono}`}>{n.id}</div>
      {n.privileged ? <div className={css.gnodeSub}>privileged</div> : null}
    </div>
  )
}

// --- chip helpers ------------------------------------------------------------

function Chip({ on, color, label, onClick }: { on: boolean; color?: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${css.chip} ${on ? css.chipOn : ''}`}
      style={on && color ? { borderColor: color, color } : undefined}
      onClick={onClick}
    >
      {color ? <span className={css.chipDot} style={{ background: color }} /> : null}
      {label}
    </button>
  )
}

function toggle<T>(set: ReadonlySet<T>, v: T): Set<T> {
  const next = new Set(set)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  return next
}

// --- evidence renderers ------------------------------------------------------

function EvidenceRow({ label, block, t }: { label: string; block?: EvidenceBlock | undefined } & PropsLocale<'phvault'>) {
  if (!block) return null
  return (
    <div className={css.evRow}>
      <span className={css.evLabel}>{label}</span>
      <span className={css.evNums}>
        <span>{t('ev.governed')} <b>{fmt(block.governed_rate)}</b></span>
        <span>{t('ev.base')} {fmt(block.base_rate)}</span>
        {block.fixed !== undefined ? <span>{t('ev.fixed')} {fmt(block.fixed)}</span> : null}
        {block.n !== undefined ? <span>{t('ev.n')} {fmt(block.n)}</span> : null}
        <span>{t('ev.p')} {fmt(block.p_value)}</span>
      </span>
    </div>
  )
}

// --- node wiki page ----------------------------------------------------------

/** One typed-edge backlink/out row, a clickable jump to the other endpoint. */
function EdgeLink({ e, self, open }: { e: VaultEdge; self: string; open: (id: string) => void }) {
  const other = e.src === self ? e.dst : e.src
  const dir = e.src === self ? '→' : '←'
  return (
    <button type="button" className={css.edgeLink} onClick={() => { open(other) }} title={`${e.rule} · ${e.via}`}>
      <span className={css.edgeRel} style={{ color: REL_COLOR[e.rel] }}>{e.rel}</span>
      <span className={css.edgeDir}>{dir}</span>
      <span className={`${css.edgeOther} ${css.mono}`}>{other.length > 24 ? `${other.slice(0, 24)}…` : other}</span>
    </button>
  )
}

function SkillPage({ node, graph, open, t }: { node: SkillNode; graph: VaultGraph; open: (id: string) => void } & PropsLocale<'phvault'>) {
  const out = outEdges(graph, node.id)
  const back = backlinks(graph, node.id)
  const requires = out.filter(e => e.rel === 'REQUIRES')
  const lineage = [...out, ...back].filter(e => e.rel === 'DESCENDS_FROM')
  const governs = out.filter(e => e.rel === 'GOVERNS')
  const rest = back.filter(e => e.rel !== 'DESCENDS_FROM')
    .concat(out.filter(e => e.rel !== 'REQUIRES' && e.rel !== 'DESCENDS_FROM' && e.rel !== 'GOVERNS'))
  const ev = node.evidence ?? {}
  const byId = indexNodes(graph)
  return (
    <div className={css.page}>
      <div className={css.pageHead}>
        <h2 className={css.pageTitle}>{node.label ?? node.id}</h2>
        <div className={css.pageBadges}>
          <span className={`${css.badge} ${css[`st_${node.status}`] ?? ''}`}>{t(`status.${node.status}` as const)}</span>
          {node.task ? <span className={css.badge}>{node.task}</span> : null}
          {node.privilege ? <span className={`${css.badge} ${css.badgePriv}`}>{t('privileged')} {node.privilege}</span> : null}
        </div>
        <div className={`${css.pageId} ${css.mono}`}>{node.id}</div>
      </div>

      <section className={css.sect}>
        <h3>{t('node.trigger')}</h3>
        <pre className={css.pre}>{JSON.stringify(node.trigger ?? {}, null, 2)}</pre>
      </section>

      <section className={css.sect}>
        <h3>{t('node.evidence')}</h3>
        <EvidenceRow label={t('node.heldout')} block={ev.heldout} t={t} />
        <EvidenceRow label={t('node.judgementDev')} block={ev.judgement_dev} t={t} />
        {ev.heldout_delta !== undefined
          ? <div className={css.evRow}><span className={css.evLabel}>{t('ev.delta')}</span><span className={css.evNums}><b>{fmt(ev.heldout_delta)}</b></span></div>
          : null}
        {ev.ablation && ev.ablation.length > 0 ? (
          <div className={css.ablation}>
            <span className={css.evLabel}>{t('node.ablation')}</span>
            <div className={css.ablationRungs}>
              {ev.ablation.map(([noise, r], i) => (
                <span key={i} className={css.rung}>
                  {t('ev.noise')} {fmt(noise)} · {t('ev.governed')} {fmt(r.governed_rate)} · {t('ev.fixed')} {fmt(r.fixed)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {requires.length > 0 ? (
        <section className={css.sect}>
          <h3>{t('node.requires')}</h3>
          {requires.map((e) => {
            const cap = byId.get(e.dst) as CapabilityNode | undefined
            const priv = cap?.privileged
            return (
              <div key={e.dst} className={css.reqRow}>
                <button type="button" className={`${css.capChip} ${priv ? css.capChipPriv : ''} ${css.mono}`} onClick={() => { open(e.dst) }}>
                  {e.dst}
                </button>
                {priv ? <span className={css.wontTransfer}>{t('wontTransfer')}</span> : null}
              </div>
            )
          })}
        </section>
      ) : null}

      {lineage.length > 0 ? (
        <section className={css.sect}>
          <h3>{t('node.lineage')}</h3>
          <div className={css.linkRow}>{lineage.map(e => <EdgeLink key={`${e.rel}${e.src}${e.dst}`} e={e} self={node.id} open={open} />)}</div>
        </section>
      ) : null}

      {governs.length > 0 ? (
        <section className={css.sect}>
          <h3>{t('node.governs')}</h3>
          <div className={css.linkRow}>{governs.map(e => <EdgeLink key={`${e.rel}${e.dst}`} e={e} self={node.id} open={open} />)}</div>
        </section>
      ) : null}

      {rest.length > 0 ? (
        <section className={css.sect}>
          <h3>{t('node.backlinks')}</h3>
          <div className={css.linkRow}>{rest.map(e => <EdgeLink key={`${e.rel}${e.src}${e.dst}`} e={e} self={node.id} open={open} />)}</div>
        </section>
      ) : null}

      {node.annotations?.note ? (
        <section className={css.sect}><h3>{t('node.note')}</h3><p>{node.annotations.note}</p></section>
      ) : null}
    </div>
  )
}

function PackagePage({ node, graph, open, t }: { node: PackageNode; graph: VaultGraph; open: (id: string) => void } & PropsLocale<'phvault'>) {
  const out = outEdges(graph, node.id)
  const back = backlinks(graph, node.id)
  const links = [...out, ...back]
  return (
    <div className={css.page}>
      <div className={css.pageHead}>
        <h2 className={css.pageTitle}>{node.name ?? node.id}</h2>
        <div className={css.pageBadges}>
          <span className={css.badge}>{t('kind.package')}</span>
          {node.actuation ? <span className={css.badge}>{node.actuation}</span> : null}
          {node.needs_sim ? <span className={css.badge}>needs_sim</span> : null}
          {node.enabled === false ? <span className={`${css.badge} ${css.badgeMuted}`}>disabled</span> : null}
        </div>
        <div className={`${css.pageId} ${css.mono}`}>{node.id}</div>
      </div>

      {(node.provides ?? []).length > 0 ? (
        <section className={css.sect}><h3>{t('node.provides')}</h3>
          <div className={css.linkRow}>{(node.provides ?? []).map(c => (
            <button key={c} type="button" className={`${css.capChip} ${css.mono}`} onClick={() => { open(c) }}>{c}</button>
          ))}</div></section>
      ) : null}

      {((node.binds?.tasks ?? []).length + (node.binds?.campaigns ?? []).length) > 0 ? (
        <section className={css.sect}><h3>{t('node.binds')}</h3>
          <div className={css.tagRow}>
            {(node.binds?.tasks ?? []).map(x => <span key={`t${x}`} className={css.tag}>{x}</span>)}
            {(node.binds?.campaigns ?? []).map(x => <span key={`c${x}`} className={`${css.tag} ${css.tagAlt}`}>{x}</span>)}
          </div></section>
      ) : null}

      {node.claim ? (
        <section className={css.sect}><h3>{t('node.claim')}</h3>
          <pre className={css.pre}>{JSON.stringify(node.claim, null, 2)}</pre></section>
      ) : null}

      {node.claim_sealed ? (
        <section className={css.sect}><h3>{t('node.claimSealed')}</h3>
          <div className={css.kv}><span className={css.kvLabel}>store</span> <span className={css.mono}>{node.claim_sealed.store ?? '—'}</span></div>
          <div className={css.linkRow}>{(node.claim_sealed.skills ?? []).map(s => (
            <button key={s} type="button" className={`${css.edgeLink} ${css.mono}`} onClick={() => { open(s) }}>{s.slice(0, 24)}…</button>
          ))}</div></section>
      ) : null}

      {(node.third_party ?? []).length > 0 ? (
        <section className={css.sect}><h3>{t('node.flags')}</h3>
          <div className={css.tagRow}>{(node.third_party ?? []).map(x => <span key={x} className={css.tag}>{x}</span>)}</div></section>
      ) : null}

      {links.length > 0 ? (
        <section className={css.sect}><h3>{t('node.backlinks')}</h3>
          <div className={css.linkRow}>{links.map(e => <EdgeLink key={`${e.rel}${e.src}${e.dst}`} e={e} self={node.id} open={open} />)}</div></section>
      ) : null}
    </div>
  )
}

function CapabilityPage({ node, graph, open, t }: { node: CapabilityNode; graph: VaultGraph; open: (id: string) => void } & PropsLocale<'phvault'>) {
  const back = backlinks(graph, node.id)
  return (
    <div className={css.page}>
      <div className={css.pageHead}>
        <h2 className={`${css.pageTitle} ${css.mono}`}>{node.id}</h2>
        <div className={css.pageBadges}>
          <span className={css.badge}>{t('kind.capability')}</span>
          {node.privileged ? <span className={`${css.badge} ${css.badgePriv}`}>{t('privileged')}</span> : null}
        </div>
      </div>
      <section className={css.sect}>
        <div className={css.kv}><span className={css.kvLabel}>{t('node.contract')}</span> <span className={css.mono}>{node.contract ?? '—'}</span></div>
        {node.doc ? <p className={css.doc}>{node.doc}</p> : null}
      </section>
      {back.length > 0 ? (
        <section className={css.sect}><h3>{t('node.backlinks')}</h3>
          <div className={css.linkRow}>{back.map(e => <EdgeLink key={`${e.rel}${e.src}`} e={e} self={node.id} open={open} />)}</div></section>
      ) : null}
    </div>
  )
}

// --- the view ----------------------------------------------------------------

export function VaultView({
  fetchVault, t,
}: ConvViewProps & InjectFace<VaultInjected> & PropsLocale<'phvault'>) {
  const [online, setOnline] = useState<boolean | null>(null)
  const [graph, setGraph] = useState<VaultGraph | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [kinds, setKinds] = useState<ReadonlySet<VaultKind>>(new Set())
  const [statuses, setStatuses] = useState<ReadonlySet<SkillStatus>>(new Set())
  const [rels, setRels] = useState<ReadonlySet<VaultRel>>(new Set())
  const [search, setSearch] = useState('')
  const errRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetchVault()
      if (!r.ok) { errRef.current = r.error.message; setOnline(false); return }
      setOnline(true)
      setGraph(r.value as VaultGraph)
    } catch (cause) {
      errRef.current = cause instanceof Error ? cause.message : String(cause)
      setOnline(false)
    }
  }, [fetchVault])

  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      if (!live) return
      if (!document.hidden) await load()
      if (!live) return
      timer = setTimeout(tick, REFRESH_MS)
    }
    // First load runs regardless of visibility — the vault is static data that
    // must appear the moment its tab opens, even if the OS window is not
    // frontmost. Only the recurring refresh is visibility-gated, and a
    // background→foreground transition triggers an immediate refetch.
    void (async () => { await load(); if (live) timer = setTimeout(tick, REFRESH_MS) })()
    const onVisible = () => { if (!document.hidden) void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      live = false
      if (timer !== undefined) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const filters: VaultFilters = useMemo(() => ({ kinds, statuses, rels, search }), [kinds, statuses, rels, search])
  const flow = useMemo(() => (graph === null ? null : layout(graph, filters)), [graph, filters])
  const byId = useMemo(() => (graph === null ? new Map<string, VaultNode>() : indexNodes(graph)), [graph])
  const nodeTypes = useMemo(() => ({
    skill: SkillGraphNode, package: PackageGraphNode, capability: CapabilityGraphNode,
  }), [])

  if (online === false) return <div className={css.empty}>{t('unavailable')} — {errRef.current}</div>
  if (graph === null || flow === null) return <div className={css.empty}>{t('loading')}</div>
  if (graph.nodes.length === 0) return <div className={css.empty}>{t('empty')}</div>

  const current = selected === null ? undefined : byId.get(selected)
  if (current !== undefined) {
    return (
      <div className={css.panel}>
        <div className={css.pageBar}>
          <button type="button" className={css.backBtn} onClick={() => { setSelected(null) }}>{t('back')}</button>
        </div>
        <div className={css.pageScroll}>
          {current.kind === 'skill' ? <SkillPage node={current} graph={graph} open={setSelected} t={t} />
            : current.kind === 'package' ? <PackagePage node={current} graph={graph} open={setSelected} t={t} />
              : <CapabilityPage node={current} graph={graph} open={setSelected} t={t} />}
        </div>
      </div>
    )
  }

  return (
    <div className={css.panel}>
      <div className={css.toolbar}>
        <input
          className={css.search}
          value={search}
          placeholder={t('search.placeholder')}
          onChange={(e) => { setSearch(e.target.value) }}
        />
        <div className={css.chipGroup}>
          <span className={css.chipLabel}>{t('filter.kind')}</span>
          {ALL_KINDS.map(k => (
            <Chip key={k} on={kinds.has(k)} label={t(`kind.${k}` as const)} onClick={() => { setKinds(toggle(kinds, k)) }} />
          ))}
        </div>
        <div className={css.chipGroup}>
          <span className={css.chipLabel}>{t('filter.status')}</span>
          {ALL_STATUSES.map(s => (
            <Chip key={s} on={statuses.has(s)} label={t(`status.${s}` as const)} onClick={() => { setStatuses(toggle(statuses, s)) }} />
          ))}
        </div>
        <div className={css.chipGroup}>
          <span className={css.chipLabel}>{t('filter.rel')}</span>
          {ALL_RELS.map(r => (
            <Chip key={r} on={rels.has(r)} color={REL_COLOR[r]} label={r} onClick={() => { setRels(toggle(rels, r)) }} />
          ))}
        </div>
      </div>
      <div className={css.canvas}>
        <ReactFlow
          nodes={flow.nodes.map(n => ({
            id: n.id, type: n.type, position: n.position, data: n.data,
            // Fixed dimensions so React Flow routes edges without waiting on its
            // ResizeObserver (which never fires in a backgrounded/headless tab,
            // leaving nodes measurement-hidden and every edge unrendered).
            width: NODE_SIZE[n.type].width, height: NODE_SIZE[n.type].height,
            draggable: false, connectable: false, selectable: true,
          }))}
          edges={flow.edges.map(e => ({
            id: e.id, source: e.source, target: e.target,
            type: 'default', label: e.label,
            labelShowBg: true,
            labelBgPadding: [4, 2] as [number, number],
            labelBgStyle: { fill: 'var(--dsw-alias-bg-layer-1, #fff)', fillOpacity: 0.85 },
            labelStyle: { fill: REL_COLOR[e.rel], fontSize: 9, fontWeight: 600 },
            style: { stroke: REL_COLOR[e.rel], strokeWidth: 1.4 },
            markerEnd: { type: 'arrowclosed', color: REL_COLOR[e.rel], width: 14, height: 14 } as unknown as string,
            animated: e.rel === 'DESCENDS_FROM',
          }))}
          nodeTypes={nodeTypes}
          onNodeClick={(_e, node) => { setSelected(node.id) }}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
          minZoom={0.15}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnScroll={false}
          panOnScroll
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={18} size={1} />
        </ReactFlow>
        <div className={css.graphHint}>{t('graph.hint')}</div>
      </div>
    </div>
  )
}
