/**
 * 技能库 (Skill Library) — the one browsable page over the harness's skill
 * graph: a class tree on the left (每个 class 下面是它的 skills, filtered by
 * benchmark / embodiment / search), the wiki graph of the selection's
 * neighborhood in the center, and a wiki-style detail page on the right.
 * Selection is one state shared by all three columns.
 *
 * Renders only: the graph, every status, and every number come from the board
 * vault fold (board/vault.py); this component indexes, filters, lays out
 * (graph.ts), and paints — it computes no statistic. The vault is small, so it
 * is fetched whole once and everything derives from it client-side, with a
 * slow background refresh.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  classTree, DENSE_RELS, embodiments, evidenceSummary, genericOf, indexGraph, inTo, isLibrary,
  neighborhood, outOf, REL_COLOR, renderableRels,
} from './graph.ts'
import type {
  BenchmarkNode, CapabilityNode, ClassNode, EvidenceBlock, LegacySkillNode, LibrarySkillNode,
  PackageNode, VaultEdge, VaultFilters, VaultGraph, VaultIndex, VaultKind, VaultNode, VaultRel,
} from './graph.ts'
import { KindGlyph, VaultGraphCanvas } from './VaultGraphCanvas.tsx'
import css from './VaultView.module.css'

/** The single board read this view drives. */
export interface VaultInjected {
  fetchVault: () => Promise<RemoteResult<unknown>>
}

/** Background refresh: the vault changes only when a record lands (rare). */
const REFRESH_MS = 15000

/** The bound locale reader for this view's namespace. */
type Tr = PropsLocale<'phvault'>['t']

/** Select-a-node callback shared by the tree, the canvas, and every link. */
type Open = (id: string) => void

/** Show a board number exactly as it arrived (no rounding the fold did not do). */
function fmt(v: number | undefined | null): string {
  return v === undefined || v === null ? '—' : String(v)
}

/** A skill kind's one-glyph mark for the tree rows (segment / verify / decide / perceive / plan). */
const KIND_MARK: Record<string, string> = { segment: '▶', verify: '✓', decide: '⑂', perceive: '◉', plan: '☰' }

/** A node's display name (library name, card name, legacy label, or id). */
function nameOf(n: VaultNode): string {
  const x = n as { name?: string; label?: string }
  return x.name ?? x.label ?? n.id
}

// --- links -------------------------------------------------------------------

/** A wiki link that selects another node; `sub` is small trailing text. */
function NodeLink({ id, idx, open, sub, title }: {
  id: string
  idx: VaultIndex
  open: Open
  sub?: string | undefined
  title?: string | undefined
}) {
  const n = idx.byId.get(id)
  return (
    <button type="button" className={css.edgeLink} onClick={() => { open(id) }} title={title ?? id}>
      {n ? <KindGlyph kind={n.kind} size={12} /> : null}
      <span className={css.edgeOther}>{n ? nameOf(n) : id}</span>
      {sub ? <span className={css.depRule}>{sub}</span> : null}
    </button>
  )
}

/** One typed-edge backlink/out row (legacy pages), a clickable jump to the other endpoint. */
function EdgeLink({ e, self, open }: { e: VaultEdge; self: string; open: Open }) {
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

function Sect({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={css.sect}><h3>{title}</h3>{children}</section>
}

function Tags({ items, alt }: { items: readonly string[] | undefined; alt?: boolean }) {
  if (!items || items.length === 0) return null
  return <div className={css.tagRow}>{items.map(x => <span key={x} className={`${css.tag} ${alt ? css.tagAlt : ''}`}>{x}</span>)}</div>
}

// --- library skill / class / benchmark pages ---------------------------------

/** k/n summary of one evidence row. */
const kn = (e: { n?: number | null; k?: number | null }): string => `${fmt(e.k)}/${fmt(e.n)}`

function LibrarySkillPage({ node, idx, open, t }: { node: LibrarySkillNode; idx: VaultIndex; open: Open; t: Tr }) {
  const deps = outOf(idx, node.id, 'DEPENDS_ON')
  const dependents = inTo(idx, node.id, 'DEPENDS_ON')
  const benches = outOf(idx, node.id, 'EVIDENCED_ON')
  const cards = outOf(idx, node.id, 'BOUND_TO')
  const contract: Array<['lib.requires' | 'lib.ensures' | 'lib.clobbers', readonly string[] | undefined]> = [
    ['lib.requires', node.requires], ['lib.ensures', node.ensures], ['lib.clobbers', node.clobbers],
  ]
  const bindings = Object.entries(node.bindings ?? {}).flatMap(([emb, execs]) =>
    Object.entries(execs).map(([key, b]) => ({ emb, key, ...b })))
  const args = Object.entries(node.args ?? {})
  const limits = Object.entries(node.limits ?? {})
  return (
    <div className={css.page}>
      <div className={css.pageHead}>
        <h2 className={css.pageTitle}>{node.name}</h2>
        <div className={css.pageBadges}>
          {node.class ? (
            <button type="button" className={`${css.badge} ${css.badgeLink}`} onClick={() => { open(`class:${node.class}`) }}>
              <KindGlyph kind="class" size={11} /> {node.class}
            </button>
          ) : null}
          <span className={css.badge}>{node.skill_kind ?? 'segment'}</span>
          <span className={css.badge}>{t('status.library')}</span>
        </div>
        {node.description ? <p className={css.doc}>{node.description}</p> : null}
        <div className={`${css.pageId} ${css.mono}`}>{node.id}</div>
      </div>

      <Sect title={t('lib.contract')}>
        {contract.map(([key, items]) => (
          <div key={key} className={css.contractRow}>
            <span className={css.evLabel}>{t(key)}</span>
            <span className={css.tagRow}>
              {(items ?? []).length === 0 ? <span className={css.none}>{t('ev.none')}</span>
                : (items ?? []).map(p => <span key={p} className={`${css.tag} ${css.mono}`}>{p}</span>)}
            </span>
          </div>
        ))}
      </Sect>

      {args.length + limits.length > 0 ? (
        <Sect title={`${t('lib.args')} · ${t('lib.limits')}`}>
          <div className={css.kvGrid}>
            {args.map(([k, v]) => <div key={`a${k}`} className={css.kv}><span className={css.kvLabel}>{k}</span><span className={css.mono}>{v}</span></div>)}
            {limits.map(([k, v]) => <div key={`l${k}`} className={css.kv}><span className={css.kvLabel}>{k}</span><span className={css.mono}>{JSON.stringify(v)}</span></div>)}
          </div>
        </Sect>
      ) : null}

      <Sect title={t('lib.bindings')}>
        {bindings.length === 0 ? <span className={css.none}>{t('ev.none')}</span> : (
          <table className={css.table}>
            <thead><tr><th>{t('bind.embodiment')}</th><th>{t('bind.executor')}</th><th>{t('bind.transport')}</th><th>{t('bind.ref')}</th><th>{t('bind.sha')}</th></tr></thead>
            <tbody>
              {bindings.map(b => (
                <tr key={`${b.emb}/${b.key}`}>
                  <td>{b.emb}</td><td>{b.key}</td><td>{b.transport ?? '—'}</td>
                  <td className={css.mono}>{b.ref ?? '—'}</td>
                  <td className={css.mono}>{b.checkpoint_sha ? b.checkpoint_sha.slice(0, 8) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sect>

      <Sect title={t('lib.evidence')}>
        {Object.keys(node.evidence ?? {}).length === 0 ? <span className={css.none}>{t('ev.none')}</span>
          : Object.entries(node.evidence ?? {}).map(([emb, ev]) => (
            <div key={emb} className={css.evBlock}>
              <div className={css.evRow}><span className={css.evLabel}>{emb}</span><b>{kn(ev)}</b></div>
              {Object.entries(ev.by_executor ?? {}).map(([key, e]) => (
                <div key={key} className={`${css.evRow} ${css.evSub}`}><span className={css.evLabel}>{key}</span><span>{kn(e)}</span></div>
              ))}
            </div>
          ))}
      </Sect>

      {deps.length + dependents.length > 0 ? (
        <Sect title={t('lib.deps')}>
          {deps.length > 0 ? (
            <div className={css.evRow}><span className={css.evLabel}>{t('dep.out')}</span>
              <span className={css.linkRow}>{deps.map(e => <NodeLink key={e.dst} id={e.dst} idx={idx} open={open} sub={e.rule} title={`${e.rule} · ${e.via}`} />)}</span></div>
          ) : null}
          {dependents.length > 0 ? (
            <div className={css.evRow}><span className={css.evLabel}>{t('dep.in')}</span>
              <span className={css.linkRow}>{dependents.map(e => <NodeLink key={e.src} id={e.src} idx={idx} open={open} sub={e.rule} title={`${e.rule} · ${e.via}`} />)}</span></div>
          ) : null}
        </Sect>
      ) : null}

      {benches.length > 0 ? (
        <Sect title={t('lib.benchmarks')}>
          <div className={css.linkRow}>{benches.map(e => (
            <NodeLink key={e.dst} id={e.dst} idx={idx} open={open} sub={e.n !== undefined && e.n !== null ? kn(e) : undefined} title={`${e.rule} · ${e.via}`} />
          ))}</div>
        </Sect>
      ) : null}

      {(node.failure_modes ?? []).length > 0 ? <Sect title={t('lib.failureModes')}><Tags items={node.failure_modes} /></Sect> : null}

      {cards.length > 0 ? (
        <Sect title={t('lib.cards')}>
          <div className={css.linkRow}>{cards.map(e => <NodeLink key={e.dst} id={e.dst} idx={idx} open={open} title={`${e.rule} · ${e.via}`} />)}</div>
        </Sect>
      ) : null}

      {node.annotations?.note ? <Sect title={t('node.note')}><p>{node.annotations.note}</p></Sect> : null}
    </div>
  )
}

/** A tree/list row for one library skill: kind mark · name · k/n. */
function SkillRow({ node, on, open, nested }: { node: LibrarySkillNode; on: boolean; open: Open; nested?: boolean }) {
  const ev = evidenceSummary(node)
  return (
    <button type="button" className={`${css.rowBtn} ${css.skillRow} ${nested ? css.instRow : ''} ${on ? css.rowOn : ''}`} onClick={() => { open(node.id) }} title={node.description ?? node.id}>
      <span className={css.kmark} title={node.skill_kind ?? 'segment'}>{KIND_MARK[node.skill_kind ?? 'segment'] ?? '·'}</span>
      <span className={css.rowName}>{node.name}</span>
      <span className={css.rowEv}>{ev.k}/{ev.n}</span>
    </button>
  )
}

function ClassPage({ node, idx, open, t }: { node: ClassNode; idx: VaultIndex; open: Open; t: Tr }) {
  const skills = inTo(idx, node.id, 'IN_CLASS').map(e => idx.byId.get(e.src)).filter(isLibrary)
  const benches = [...new Set(skills.flatMap(s => outOf(idx, s.id, 'EVIDENCED_ON').map(e => e.dst)))]
  return (
    <div className={css.page}>
      <div className={css.pageHead}>
        <h2 className={css.pageTitle}>{node.name ?? node.id}</h2>
        <div className={css.pageBadges}><span className={css.badge}>{t('kind.class')}</span><span className={css.badge}>{skills.length}</span></div>
      </div>
      <Sect title={t('class.skills')}>
        <div className={css.list}>{skills.map(s => <SkillRow key={s.id} node={s} on={false} open={open} />)}</div>
      </Sect>
      {benches.length > 0 ? (
        <Sect title={t('class.benchmarks')}>
          <div className={css.linkRow}>{benches.map(b => <NodeLink key={b} id={b} idx={idx} open={open} />)}</div>
        </Sect>
      ) : null}
    </div>
  )
}

function BenchmarkPage({ node, idx, open, t }: { node: BenchmarkNode; idx: VaultIndex; open: Open; t: Tr }) {
  const covered = inTo(idx, node.id, 'EVIDENCED_ON')
  return (
    <div className={css.page}>
      <div className={css.pageHead}>
        <h2 className={css.pageTitle}>{node.name ?? node.id}</h2>
        <div className={css.pageBadges}>
          <span className={css.badge}>{t('kind.benchmark')}</span>
          {node.embodiment ? <span className={css.badge}>{t('bench.embodiment')}: {node.embodiment}</span> : null}
        </div>
        <div className={`${css.pageId} ${css.mono}`}>{node.id}</div>
      </div>
      {(node.tasks ?? []).length > 0 ? <Sect title={t('bench.tasks')}><Tags items={node.tasks} /></Sect> : null}
      {(node.arms ?? []).length > 0 ? <Sect title={t('bench.arms')}><Tags items={node.arms} alt /></Sect> : null}
      {node.card ? <Sect title={t('bench.card')}><NodeLink id={node.card} idx={idx} open={open} /></Sect> : null}
      <Sect title={t('bench.skills')}>
        {covered.length === 0 ? <span className={css.none}>{t('ev.none')}</span> : (
          <div className={css.linkRow}>{covered.map(e => (
            <NodeLink key={e.src} id={e.src} idx={idx} open={open} sub={e.n !== undefined && e.n !== null ? kn(e) : undefined} />
          ))}</div>
        )}
      </Sect>
    </div>
  )
}

// --- legacy pages (sealed skills, cards, capabilities) -----------------------

function EvidenceRow({ label, block, t }: { label: string; block?: EvidenceBlock | undefined; t: Tr }) {
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

function SkillPage({ node, idx, open, t }: { node: LegacySkillNode; idx: VaultIndex; open: Open; t: Tr }) {
  const out = outOf(idx, node.id)
  const back = inTo(idx, node.id)
  const requires = out.filter(e => e.rel === 'REQUIRES')
  const lineage = [...out, ...back].filter(e => e.rel === 'DESCENDS_FROM')
  const governs = out.filter(e => e.rel === 'GOVERNS')
  const rest = back.filter(e => e.rel !== 'DESCENDS_FROM')
    .concat(out.filter(e => e.rel !== 'REQUIRES' && e.rel !== 'DESCENDS_FROM' && e.rel !== 'GOVERNS'))
  const ev = node.evidence ?? {}
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

      <Sect title={t('node.trigger')}><pre className={css.pre}>{JSON.stringify(node.trigger ?? {}, null, 2)}</pre></Sect>

      <Sect title={t('node.evidence')}>
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
      </Sect>

      {requires.length > 0 ? (
        <Sect title={t('node.requires')}>
          {requires.map((e) => {
            const cap = idx.byId.get(e.dst) as CapabilityNode | undefined
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
        </Sect>
      ) : null}

      {lineage.length > 0 ? (
        <Sect title={t('node.lineage')}>
          <div className={css.linkRow}>{lineage.map(e => <EdgeLink key={`${e.rel}${e.src}${e.dst}`} e={e} self={node.id} open={open} />)}</div>
        </Sect>
      ) : null}

      {governs.length > 0 ? (
        <Sect title={t('node.governs')}>
          <div className={css.linkRow}>{governs.map(e => <EdgeLink key={`${e.rel}${e.dst}`} e={e} self={node.id} open={open} />)}</div>
        </Sect>
      ) : null}

      {rest.length > 0 ? (
        <Sect title={t('node.backlinks')}>
          <div className={css.linkRow}>{rest.map(e => <EdgeLink key={`${e.rel}${e.src}${e.dst}`} e={e} self={node.id} open={open} />)}</div>
        </Sect>
      ) : null}

      {node.annotations?.note ? <Sect title={t('node.note')}><p>{node.annotations.note}</p></Sect> : null}
    </div>
  )
}

/** A card's manifest fields (what the former 能力卡 page showed) plus its typed links. */
function PackagePage({ node, idx, open, t }: { node: PackageNode; idx: VaultIndex; open: Open; t: Tr }) {
  const links = [...outOf(idx, node.id), ...inTo(idx, node.id)]
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
        <Sect title={t('node.provides')}>
          <div className={css.linkRow}>{(node.provides ?? []).map(c => (
            <button key={c} type="button" className={`${css.capChip} ${css.mono}`} onClick={() => { open(c) }}>{c}</button>
          ))}</div>
        </Sect>
      ) : null}

      {((node.binds?.tasks ?? []).length + (node.binds?.campaigns ?? []).length) > 0 ? (
        <Sect title={t('node.binds')}>
          <div className={css.tagRow}>
            {(node.binds?.tasks ?? []).map(x => <span key={`t${x}`} className={css.tag}>{x}</span>)}
            {(node.binds?.campaigns ?? []).map(x => <span key={`c${x}`} className={`${css.tag} ${css.tagAlt}`}>{x}</span>)}
          </div>
        </Sect>
      ) : null}

      {(node.bundles ?? []).length > 0 ? <Sect title={t('node.bundles')}><Tags items={node.bundles} /></Sect> : null}

      {node.claim ? <Sect title={t('node.claim')}><pre className={css.pre}>{JSON.stringify(node.claim, null, 2)}</pre></Sect> : null}

      {node.claim_sealed ? (
        <Sect title={t('node.claimSealed')}>
          <div className={css.kv}><span className={css.kvLabel}>store</span> <span className={css.mono}>{node.claim_sealed.store ?? '—'}</span></div>
          <div className={css.linkRow}>{(node.claim_sealed.skills ?? []).map(s => (
            <button key={s} type="button" className={`${css.edgeLink} ${css.mono}`} onClick={() => { open(s) }}>{s.slice(0, 24)}…</button>
          ))}</div>
        </Sect>
      ) : null}

      {(node.third_party ?? []).length > 0 ? <Sect title={t('node.flags')}><Tags items={node.third_party} /></Sect> : null}

      {links.length > 0 ? (
        <Sect title={t('node.backlinks')}>
          <div className={css.linkRow}>{links.map(e => <EdgeLink key={`${e.rel}${e.src}${e.dst}`} e={e} self={node.id} open={open} />)}</div>
        </Sect>
      ) : null}
    </div>
  )
}

function CapabilityPage({ node, idx, open, t }: { node: CapabilityNode; idx: VaultIndex; open: Open; t: Tr }) {
  const back = inTo(idx, node.id)
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
        <Sect title={t('node.backlinks')}>
          <div className={css.linkRow}>{back.map(e => <EdgeLink key={`${e.rel}${e.src}`} e={e} self={node.id} open={open} />)}</div>
        </Sect>
      ) : null}
    </div>
  )
}

function Detail({ node, idx, open, t }: { node: VaultNode | undefined; idx: VaultIndex; open: Open; t: Tr }) {
  if (node === undefined) return <div className={css.empty}>{t('detail.none')}</div>
  if (isLibrary(node)) return <LibrarySkillPage node={node} idx={idx} open={open} t={t} />
  switch (node.kind) {
    case 'skill': return <SkillPage node={node} idx={idx} open={open} t={t} />
    case 'class': return <ClassPage node={node} idx={idx} open={open} t={t} />
    case 'benchmark': return <BenchmarkPage node={node} idx={idx} open={open} t={t} />
    case 'package': return <PackagePage node={node} idx={idx} open={open} t={t} />
    default: return <CapabilityPage node={node} idx={idx} open={open} t={t} />
  }
}

// --- side pane chrome --------------------------------------------------------

function Side({ title, side, open, setOpen, t, children }: {
  title: string
  side: 'left' | 'right'
  open: boolean
  setOpen: (v: boolean) => void
  t: Tr
  children: React.ReactNode
}) {
  return (
    <aside className={`${css.side} ${side === 'left' ? css.sideLeft : css.sideRight} ${open ? '' : css.sideClosed}`}>
      <div className={css.sideHead}>
        {open ? <span>{title}</span> : null}
        <button type="button" className={css.chev} onClick={() => { setOpen(!open) }} title={t(open ? 'pane.collapse' : 'pane.expand')} aria-label={`${title}: ${t(open ? 'pane.collapse' : 'pane.expand')}`}>
          {open === (side === 'left') ? '‹' : '›'}
        </button>
      </div>
      {open ? <div className={css.sideBody}>{children}</div> : null}
    </aside>
  )
}

// --- the view ----------------------------------------------------------------

export function VaultView({
  fetchVault, t,
}: ConvViewProps & InjectFace<VaultInjected> & PropsLocale<'phvault'>) {
  const [online, setOnline] = useState<boolean | null>(null)
  const [graph, setGraph] = useState<VaultGraph | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [benchmark, setBenchmark] = useState('')
  const [embodiment, setEmbodiment] = useState('')
  const [search, setSearch] = useState('')
  const [rels, setRels] = useState<ReadonlySet<VaultRel>>(new Set())
  const [openClasses, setOpenClasses] = useState<ReadonlySet<string>>(new Set())
  // Generic skills whose instances unfold — one state for the tree and the canvas badge.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [deep, setDeep] = useState(false)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const errRef = useRef<string | null>(null)
  const seededRels = useRef(false)

  const load = useCallback(async () => {
    try {
      const r = await fetchVault()
      if (!r.ok) { errRef.current = r.error.message; setOnline(false); return }
      setOnline(true)
      const g = r.value as VaultGraph
      setGraph(g)
      // Seed the relation filter once: every family that draws EXCEPT the two
      // dense cross-band families, which open collapsed so the whole-vault
      // frame (no selection) stays legible; a selection's neighborhood draws all.
      if (!seededRels.current) {
        seededRels.current = true
        setRels(new Set([...renderableRels(g)].filter(rel => !DENSE_RELS.includes(rel))))
      }
    } catch (cause) {
      errRef.current = cause instanceof Error ? cause.message : String(cause)
      setOnline(false)
    }
  }, [fetchVault])

  /* jscpd:ignore-start -- the visibility-gated setTimeout cadence loop is the
     same idiom ui-ph-livegraph runs; the two graph panels share the poll shape,
     not extractable logic (the first-load and refresh rules differ). */
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
  /* jscpd:ignore-end */

  const idx = useMemo(() => indexGraph(graph ?? { schema_version: 0, nodes: [], edges: [] }), [graph])
  const tree = useMemo(() => classTree(idx, { benchmark, embodiment, search }), [idx, benchmark, embodiment, search])
  const embs = useMemo(() => embodiments(idx), [idx])
  const sub = useMemo(() => graph === null ? null : neighborhood(graph, idx, selected, { expanded, deep }),
    [graph, idx, selected, expanded, deep])
  const filters: VaultFilters = useMemo(() => ({
    kinds: new Set<VaultKind>(), statuses: new Set(), rels: selected === null ? rels : new Set(), search,
  }), [rels, search, selected])

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }, [])

  const open: Open = useCallback((id) => {
    setSelected(id)
    const n = idx.byId.get(id)
    if (isLibrary(n) && n.class) setOpenClasses(s => new Set(s).add(`class:${n.class}`))
    const g = genericOf(idx, id)
    if (g !== undefined) setExpanded(s => new Set(s).add(g))
    if (n !== undefined && !isLibrary(n) && n.kind !== 'class' && n.kind !== 'benchmark') setLegacyOpen(true)
  }, [idx])

  if (online === false) return <div className={css.empty}>{t('unavailable')} — {errRef.current}</div>
  if (graph === null || sub === null) return <div className={css.empty}>{t('loading')}</div>
  if (graph.nodes.length === 0) return <div className={css.empty}>{t('empty')}</div>

  const benches = (idx.byKind.get('benchmark') ?? []) as BenchmarkNode[]
  const current = selected === null ? undefined : idx.byId.get(selected)

  return (
    <div className={css.grid}>
      <Side title={t('pane.tree')} side="left" open={leftOpen} setOpen={setLeftOpen} t={t}>
        <input className={css.search} value={search} placeholder={t('search.placeholder')} onChange={(e) => { setSearch(e.target.value) }} />
        <label className={css.filter}>
          <span className={css.chipLabel}>{t('filter.benchmark')}</span>
          <select className={css.select} value={benchmark} onChange={(e) => { setBenchmark(e.target.value) }} aria-label={t('filter.benchmark')}>
            <option value="">{t('filter.all')}</option>
            {benches.map(b => <option key={b.id} value={b.id}>{b.name ?? b.id}</option>)}
          </select>
        </label>
        <label className={css.filter}>
          <span className={css.chipLabel}>{t('filter.embodiment')}</span>
          <select className={css.select} value={embodiment} onChange={(e) => { setEmbodiment(e.target.value) }} aria-label={t('filter.embodiment')}>
            <option value="">{t('filter.all')}</option>
            {embs.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <div className={css.tree}>
          {tree.classes.map(({ node, skills, roots }) => {
            const isOpen = openClasses.has(node.id)
            return (
              <div key={node.id} className={css.treeSect}>
                <div className={css.classRow}>
                  <button type="button" className={css.chev} onClick={() => { setOpenClasses((s) => { const n = new Set(s); if (n.has(node.id)) n.delete(node.id); else n.add(node.id); return n }) }} aria-label={`${node.name ?? node.id}: ${t(isOpen ? 'pane.collapse' : 'pane.expand')}`}>
                    {isOpen ? '▾' : '▸'}
                  </button>
                  <button type="button" className={`${css.rowBtn} ${selected === node.id ? css.rowOn : ''}`} onClick={() => { open(node.id); setOpenClasses(s => new Set(s).add(node.id)) }}>
                    <KindGlyph kind="class" size={12} />
                    <span className={css.rowName}>{node.name ?? node.id}</span>
                    <span className={css.rowEv}>· {skills.length}</span>
                  </button>
                </div>
                {isOpen ? roots.map(({ node: s, instances }) => (
                  <div key={s.id}>
                    <div className={css.classRow}>
                      <SkillRow node={s} on={selected === s.id} open={open} />
                      {instances.length > 0 ? (
                        <button type="button" className={css.chev} onClick={() => { toggleExpanded(s.id) }} title={t('graph.instances')} aria-label={`${s.name}: ${t(expanded.has(s.id) ? 'pane.collapse' : 'pane.expand')}`}>
                          {expanded.has(s.id) ? '−' : '+'}{instances.length}
                        </button>
                      ) : null}
                    </div>
                    {expanded.has(s.id)
                      ? instances.map(i => <SkillRow key={i.id} node={i} on={selected === i.id} open={open} nested />)
                      : null}
                  </div>
                )) : null}
              </div>
            )
          })}
          {tree.legacy.length > 0 ? (
            <div className={css.treeSect}>
              <div className={css.classRow}>
                <button type="button" className={css.chev} onClick={() => { setLegacyOpen(o => !o) }} aria-label={`${t('tree.legacy')}: ${t(legacyOpen ? 'pane.collapse' : 'pane.expand')}`}>{legacyOpen ? '▾' : '▸'}</button>
                <span className={`${css.rowBtn} ${css.rowStatic}`}><span className={css.rowName}>{t('tree.legacy')}</span><span className={css.rowEv}>· {tree.legacy.length}</span></span>
              </div>
              {legacyOpen ? tree.legacy.map(n => (
                <button key={n.id} type="button" className={`${css.rowBtn} ${css.skillRow} ${selected === n.id ? css.rowOn : ''}`} onClick={() => { open(n.id) }} title={n.id}>
                  <KindGlyph kind={n.kind} size={12} />
                  <span className={css.rowName}>{nameOf(n)}</span>
                  {n.kind === 'skill' ? <span className={css.rowEv}>{n.status}</span> : null}
                </button>
              )) : null}
            </div>
          ) : null}
        </div>
      </Side>
      <div className={css.center}>
        {isLibrary(current) ? (
          <label className={css.deepToggle}>
            <input type="checkbox" checked={deep} onChange={(e) => { setDeep(e.target.checked) }} />
            {t('graph.deeper')}
          </label>
        ) : null}
        <VaultGraphCanvas
          graph={sub} filters={filters} selected={selected} onSelect={open}
          expanded={expanded} onToggle={toggleExpanded} t={t}
        />
      </div>
      <Side title={t('pane.detail')} side="right" open={rightOpen} setOpen={setRightOpen} t={t}>
        <Detail node={current} idx={idx} open={open} t={t} />
      </Side>
    </div>
  )
}
