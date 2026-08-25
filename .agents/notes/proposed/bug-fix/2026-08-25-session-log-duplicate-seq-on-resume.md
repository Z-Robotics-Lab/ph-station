# Agent Note: Session-log append reuses a stale seq after resume

Status: proposed

English | [中文](2026-08-25-session-log-duplicate-seq-on-resume.zh.md)

## Problem

The JSONL session backend (`packages/session/session-persistence-jsonl`) numbers events with a monotonic `seq` that the reader requires to equal the running committed-event count: `SessionLogScanner.consumeEventLine` in `src/format.ts` throws `corrupt session log: seq gap in committed region` when a record's event seq differs, deferring the throw to the next `turn/end`. One duplicate seq therefore makes the whole session unreadable, so its chat history never loads.

`appendLines` in `src/index.ts` restores the previous file size on a write or sync failure "because ... leaving partial bytes would create duplicate sequence numbers", but that rollback only covers one writer's own partial write inside one process. When a session that already sealed a `session/end-seed` at seq N is resumed — a new user turn splicing an inbox message — a second writer can commit an `agent/inbox/spliced` record that re-uses seq N instead of N+1. The two windows are a concurrent `dsh web` restart adopting the same session directory, and a crash between a frame's fsync and the in-memory cursor advance. The following `turn/start` takes N+1 and every later event is numbered as if the duplicate never consumed a slot, so the duplicate is a spurious extra committed record, not a shift of the tail.

Observed in `session-5dc100c1-f981-42db-9787-d1c057824593` under `~/.dsh/sessions/`: `session/end-seed` and `agent/inbox/spliced` both at seq 2544, with `turn/start`=2545 onward contiguous. The spliced user message survived independently as a later committed `user/message` (seq 2548, same rpcId), so no user-visible content was unique to the duplicate. A hand-repair dropped the single duplicate line and the log loaded (4538 events); the original bytes were backed up to `session.jsonl.zstd.corrupt.bak` beside the log.

## Proposal

Fence the append seq across writers. Before committing a batch, the append path verifies the batch's first seq equals the on-disk committed-event cursor under an exclusive per-session-directory append lock (cross-process — an `O_EXCL` lockfile or advisory `flock` on the log), and a stale batch re-derives its cursor from the committed tail and renumbers rather than committing a duplicate. A resume re-reads the committed tail to re-derive the cursor before its first splice, closing the window where a pre-`session/end-seed` cursor snapshot is reused.

Complementary load-time recovery lets an already-corrupted session open without a manual rewrite: a mid-region duplicate seq whose record carries no payload unique to it — its message reappears as a later committed `user/message` — is dropped on read, or a `commitRepair`-style path handles the duplicate-seq class the way the torn-tail path handles a partial final frame.

## Alternatives considered

- **Keep failing loud (current behavior).** Strict, but one duplicate seq makes an otherwise complete session permanently unloadable, losing every message after the gap as well.
- **Renumber the whole tail +1 to keep the duplicate as a distinct event.** Preserves the extra record, but every later seq must shift, which invalidates cursors other readers persist and gains nothing — the duplicate's message already survives as a committed `user/message`.
- **Hand-repair each occurrence.** Restores one file but leaves the concurrent-writer race that produced it, so the corruption recurs.
- **Widen only the single-process partial-write rollback.** It cannot see a second process's append or a crash after fsync; the duplicate is committed, durable bytes, not a torn tail its size-restore can undo.

## Acceptance criteria

- Two writers resuming the same session directory, or a crash between an append's fsync and its cursor advance, cannot commit two events at one seq; a stale batch is rejected and renumbered from the committed cursor.
- A session that already contains a mid-region duplicate seq loads and renders its chat history, through a repair path or drop-on-read.
- Package tests cover concurrent append, resume after `session/end-seed`, and the duplicate-seq load path; a keyless snapshot pins that a repaired session's transcript is unchanged.

## Risks

Cross-process locking adds a per-append acquire and must not deadlock an adopting resident runtime against the web server on one session directory. Drop-on-read must prove the dropped record's payload is fully reconstructable from a later committed event before discarding it, or it silently loses data. The repair path must distinguish a duplicate seq (an extra committed record) from a torn tail (a partial final frame) so it never truncates good committed events.
