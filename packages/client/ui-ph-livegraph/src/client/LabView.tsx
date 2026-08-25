/**
 * 图谱·过程流 — the same-screen cockpit pane: the merged
 * execution graph and the 过程流 ticker side by side over one shared composer
 * (the conversation skeleton keeps the prompt bar docked below every view). Send
 * a prompt and watch the plan grow, the current step pulse, and the process
 * timeline stream — without leaving the view. Full chat transcript stays one
 * click away on the 对话 tab.
 *
 * The two panes each poll the newest runtime session, so they follow the same
 * task. Narrow containers stack the split vertically (no horizontal overflow).
 */

import { useEffect, useRef, useState } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { LiveGraphView } from './LiveGraphView.tsx'
import type { LiveGraphInjected } from './LiveGraphView.tsx'
import { TickerView } from './TickerView.tsx'
import { SplitPane } from './SplitPane.tsx'
import { RunFeedProvider } from './RunFeed.tsx'
import css from './LiveGraphView.module.css'

/** Below this container width the graph | ticker split stacks vertically. */
const STACK_BELOW = 1100

export function LabView(
  props: ConvViewProps & InjectFace<LiveGraphInjected> & PropsLocale<'phlivegraph'>,
) {
  const ref = useRef<HTMLDivElement>(null)
  const [vertical, setVertical] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth
      setVertical(w < STACK_BELOW)
    })
    ro.observe(el)
    return () => { ro.disconnect() }
  }, [])

  return (
    <RunFeedProvider inject={props}>
      <div ref={ref} className={css.lab}>
        <SplitPane
          vertical={vertical}
          storageKey={vertical ? 'ph.lab.split.v' : 'ph.lab.split.h'}
          left={<LiveGraphView t={props.t} />}
          right={<TickerView t={props.t} />}
        />
      </div>
    </RunFeedProvider>
  )
}
