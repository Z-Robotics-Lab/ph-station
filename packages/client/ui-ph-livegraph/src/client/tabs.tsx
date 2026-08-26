/**
 * Standalone-tab wrappers: the 执行图谱 and 过程流 views each own a
 * {@link RunFeedProvider} so they work as a lone tab. Docked inside the
 * dashboard (which mounts one root provider) these providers pass through and
 * fold into the shared feed, so a run picked in the graph drives the ticker.
 */

import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { LiveGraphView } from './LiveGraphView.tsx'
import type { LiveGraphInjected } from './LiveGraphView.tsx'
import { TickerView } from './TickerView.tsx'
import { Viewport } from './Viewport.tsx'
import { RunFeedProvider } from './RunFeed.tsx'

type TabProps = ConvViewProps & InjectFace<LiveGraphInjected> & PropsLocale<'phlivegraph'>

/** The 执行图谱 graph as a self-contained tab. */
export function LiveGraphTab(props: TabProps) {
  return <RunFeedProvider inject={props}><LiveGraphView t={props.t} /></RunFeedProvider>
}

/** The 过程流 ticker as a self-contained tab. */
export function TickerTab(props: TabProps) {
  return <RunFeedProvider inject={props}><TickerView t={props.t} /></RunFeedProvider>
}

/** The 取景窗 sim viewport as a self-contained tab (the fourth dash cell). */
export function ViewportTab(props: TabProps) {
  return <RunFeedProvider inject={props}><Viewport t={props.t} /></RunFeedProvider>
}
