/** Status bar: a thin frame-wide strip (shell.overlay) shown across every view.
 * MODE + boot facts come from the newest runtime session's `runtime.boot` chain
 * row; the heartbeat is that session's mtime formatted as "活跃 Xs 前"; board
 * reachability is simply whether the fetch worked. Renders only — TS formats
 * the mtime into a duration but computes no business meaning from it. The 取景窗
 * chip reads the newest session's LIVE `runtime_status` (rewritten each boot),
 * not the immutable boot row: absent/null → no chip; the file's pid and render
 * claim are shown verbatim, never judged for liveness. */

import { useCallback, useEffect, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { agoSeconds, formatAgo } from './format.ts'
import { Term } from './chrome.tsx'
import { usePolledLoad } from './poll.ts'
import css from './panels.module.css'

/** The board reads the status bar drives. */
export interface StatusInjected {
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchSession: (name: string) => Promise<RemoteResult<unknown>>
  fetchRuntimeStatus: (name: string) => Promise<RemoteResult<unknown>>
}

interface SessionSummary { name?: string; mtime?: number | null; kinds?: Record<string, number> }

/** The current-runtime session: newest (board sorts mtime-desc) carrying a
 * `runtime.boot` chain row, else newest of any kind. A local twin of the rail's
 * and livegraph's rule (the ph panel packages stay decoupled) so all three name
 * one session — a completed campaign at index 0 no longer shows 模式 未知 here
 * while the rail reads EXECUTION. */
function pickRuntimeSession(list: SessionSummary[]): SessionSummary | null {
  return list.find(s => s.kinds?.['runtime.boot'] !== undefined) ?? list[0] ?? null
}
interface BootRow {
  mode?: string | null
  mount_plan_sha?: string | null
  skills_manifest?: unknown[] | null
}
interface SessionDetail { rows?: { 'runtime.boot'?: BootRow[] } }
/** The runtime's live status file (runs/<session>/runtime_status.json). Null
 * when the session has not booted since the file existed. Shown verbatim: pid is
 * displayed, never judged. */
interface RuntimeStatus { pid?: number | null; render?: unknown; frames?: unknown }

/** Whether a `render` value reads as viewfinder-on. Defensive over the value:
 * a boolean as-is, a string on unless an explicit off token, any other present
 * value as on. */
function renderOn(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return !['', 'off', 'none', 'false', '0'].includes(value.trim().toLowerCase())
  return value != null
}

export function StatusBar({
  fetchSessions, fetchSession, fetchRuntimeStatus, t,
}: InjectFace<StatusInjected> & PropsLocale<'phpanels'>) {
  const [online, setOnline] = useState<boolean | null>(null)
  const [latest, setLatest] = useState<SessionSummary | null>(null)
  const [boot, setBoot] = useState<BootRow | null>(null)
  const [rtStatus, setRtStatus] = useState<RuntimeStatus | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const s = await fetchSessions()
      if (!s.ok) { setOnline(false); return }
      setOnline(true)
      const list = s.value as SessionSummary[]
      const top = pickRuntimeSession(list)
      setLatest(top)
      // The 取景窗 source is polled with the sessions so a reboot's new pid/render
      // shows without a page reload; absent/null or a failed fetch → no chip.
      if (top?.name) {
        const r = await fetchRuntimeStatus(top.name)
        setRtStatus(r.ok ? ((r.value as RuntimeStatus | null) ?? null) : null)
      } else {
        setRtStatus(null)
      }
    } catch {
      // A Remote read folds carrier failures into `ok: false`, but assembly
      // faults (arg/codec/Context) reject; a rejected poll must read as board
      // offline, never leave the strip stuck on 模式 未知 / 无会话.
      setOnline(false)
    }
  }, [fetchSessions, fetchRuntimeStatus])

  // Data re-fetch follows the shared polling rules (paused while hidden).
  usePolledLoad(load)
  // Tick every second so the heartbeat duration counts up between polls
  // (local clock formatting only — no network, so it runs regardless of tab
  // visibility).
  useEffect(() => {
    const tick = setInterval(() => { setNow(Date.now()) }, 1000)
    return () => { clearInterval(tick) }
  }, [])

  const name = latest?.name
  useEffect(() => {
    if (name === undefined) { setBoot(null); return }
    let live = true
    void (async () => {
      const d = await fetchSession(name)
      if (!live || !d.ok) return
      const rows = (d.value as SessionDetail).rows
      setBoot(rows?.['runtime.boot']?.[0] ?? null)
    })()
    return () => { live = false }
  }, [name, fetchSession])

  const secs = agoSeconds(latest?.mtime, now)
  const sha = boot?.mount_plan_sha

  return (
    <div className={css.statusBar}>
      <span className={css.statusItem}>
        <span className={css.statusLabel}>{t('mode')}</span>
        <span className={css.statusValue}>{boot?.mode ?? t('modeUnknown')}</span>
      </span>
      <span className={css.statusItem}>
        <span className={css.statusValue}>{name ?? t('noSession')}</span>
      </span>
      {secs === null ? null : (
        <span className={css.statusItem}>{t('active')} {formatAgo(secs)} {t('ago')}</span>
      )}
      {boot === null ? null : (
        <>
          <span className={css.statusItem}>
            <span className={css.statusLabel}>{t('skills')}</span>
            <span>{boot.skills_manifest?.length ?? 0}</span>
          </span>
          {sha ? (
            <span className={css.statusItem}>
              <span className={css.statusLabel}><Term label={t('mountPlan')} tip={t('mountPlan.tip')} /></span>
              <span className={css.statusMono}>{sha.slice(0, 8)}</span>
            </span>
          ) : null}
        </>
      )}
      {rtStatus === null ? null : (
        <span className={css.statusItem}>
          <span className={css.statusLabel}><Term label={t('viewfinder')} tip={t('viewfinder.tip')} /></span>
          <span className={css.statusValue}>{renderOn(rtStatus.frames) || renderOn(rtStatus.render) ? t('on') : t('off')}</span>
          {rtStatus.pid == null ? null : (
            <span className={css.statusMono}>pid {rtStatus.pid}</span>
          )}
        </span>
      )}
      <span className={css.statusSpacer} />
      <span className={css.statusItem}>
        <span className={`${css.dot} ${online === false ? css.dotOffline : css.dotOnline}`} />
        {online === false ? t('boardOffline') : t('boardOnline')}
      </span>
    </div>
  )
}
