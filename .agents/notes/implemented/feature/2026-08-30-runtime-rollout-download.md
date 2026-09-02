# Agent Note: Runtime rollout video is disposable live state

Status: implemented

English | [中文](2026-08-30-runtime-rollout-download.zh.md)

## Problem

The live viewport exposes only the current frame, while sparse keyframes cannot preserve the motion needed to diagnose a manipulation failure. Treating every frame or video as sealed evidence would increase store size and blur the distinction between operator convenience and facts used for evaluation.

## Decision

Frame-enabled physical-harness runtimes assemble the current task's rendered frames into `runs/<session>/rollout.mp4` when the task finishes. A new task removes the previous video, temporary frames are deleted after encoding, and encoding failure never changes task completion or evidence.

The motherboard exposes the video through the same `board.store` → `board.storecli` → MCP and ph-station host bridge used by other runtime state. The live-graph viewport downloads the returned bytes only after an operator click; neither the host nor the browser interprets the video.

## Alternatives considered

**Seal the video as task evidence.** Rejected because task outcomes and verification predicates do not depend on the video, and retaining it in the append-only evidence store would impose large permanent storage costs.

**Record the browser viewport.** Rejected because browser visibility, tab throttling, and network frame delivery would make the result incomplete and operator-dependent.

**Expose the runs directory through a static file server.** Rejected because it would add a second access path beside the board Remote and widen the gateway's file-serving authority.

## Consequences

Operators can download one complete, recent rollout from the execution viewport without changing experiment verdicts. Recording requires frame dumping and `ffmpeg`; only the latest task video is retained, and the base64 Remote response is larger than ordinary panel reads.

## Testing

The motherboard test covers task lifecycle assembly, replacement, cleanup, and byte-equivalent storecli/MCP reads with `ffmpeg` isolated. The client test covers the explicit byte-to-MP4 browser download, and the host and client TypeScript build faces pin the Remote wiring.
