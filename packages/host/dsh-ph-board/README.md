# @deepseek-ai/dsh-ph-board

physical-harness fork host bridge. A read-only Typert Remote (`board`) that
forwards the ph-station read panels to the motherboard's evidence layer
(`board/store.py`) through its CLI face (`board/storecli.py`), same-origin behind
the gateway's `trusted-host` fence.

Each `@Remote` method `execFile`s `<pythonPath> -m board.storecli <fn> [name]`
with `cwd=<repoRoot>` and returns `JSON.parse(stdout)` verbatim — zero
statistics, zero interpretation. The gateway auto-serves them at
`POST /api/board/<name>` (`stores`, `store`, `heldout`).

## Model Experience

Not model-facing. This Remote serves the browser panels; the chat LLM reads the
same `board.store` functions through the MCP server. No prompt, token, or
KV-cache effect.

## Config

Three deployment-varying paths, injected by `scripts/cockpit` as `PH_BOARD_*`
env vars through the deploy overlay's bundle row:

- `pythonPath` — Python that imports `board.store` (the motherboard venv).
- `repoRoot` — motherboard checkout, used as the subprocess `cwd`.
- `runsDir` — campaign `runs/` directory, passed as `--runs`.

The bundle row disables this plugin when `PH_BOARD_REPO` is absent, so a plain
`dsh web` still boots (the panel then reports the board unavailable).

## Known Limitations and Deferred Work

- One Python subprocess per request; cold-imports `board.store`. Fine at
  human-cadence panel polling on tiny stores. Promote to a persistent read
  worker if poll latency is ever measured to matter.
