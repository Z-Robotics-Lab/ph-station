# Agent Note: ph live surfaces publish first data without waiting for history

Status: implemented

English | [中文](2026-08-25-ph-surfaces-first-load-visibility.zh.md)

## Problem

Hidden tabs originally skipped their first board read. The execution graph also discarded its first event response after choosing the conversation floor, then awaited full session history before polling again. This left the graph blank while the process ticker and viewport showed an active task.

## Decision

The first load runs unconditionally; later refreshes pause while hidden. A fresh conversation hides completed history but publishes an active run from the first response. Docked panels share the conversation floor; manually selected sessions replay in full.

Live events and sealed session details use independent readers. Events use the 1.2s active / 4s idle cadence, with a 1.2s initial follow-up; details refresh 16s after their previous read finishes. Each reader permits one pending operation per owner. Session changes and unmounts invalidate old results. Failed history reads leave live execution usable, and event read failures retain retries.

## Alternatives considered

Removing visibility checks would add unnecessary background reads. Shortening the event interval alone would leave history blocking events and require a redundant second response before showing the task.

## Consequences

Graph nodes paint and update before sealed details arrive. Routing and archived plans are enriched separately. Reloads rediscover the active run while hiding completed history.

## Testing

The 34 livegraph tests cover shared conversation floors, first-response publication, updates during pending history, stale responses, unmount cleanup, callback changes, initial cadence, and hidden tabs. Localhost dashboard verification holds history pending and checks first paint plus a subsequent node transition without running a simulation.
