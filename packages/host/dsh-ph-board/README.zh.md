# @deepseek-ai/dsh-ph-board

[English](README.md) | 中文

physical-harness fork 的主机侧桥接包。一个只读的 Typert Remote（`board`），把 ph-station 的读面板转发到主机（motherboard）的证据层（`board/store.py`），经其 CLI 面（`board/storecli.py`）访问，同源部署在 gateway 的 `trusted-host` 防线之后。

每个 `@Remote` 方法 `execFile` 执行 `<pythonPath> -m board.storecli <fn> [name]`（`cwd=<repoRoot>`），并把 `JSON.parse(stdout)` 原样返回——零统计、零解释。gateway 自动在 `POST /api/board/<name>` 提供它们（`stores`、`store`、`heldout`、`cards`、`rounds`、`ledger`、`sessions`、`session`、`sessionProgress`、`runtimeStatus`、`runtimeFrame`、`runtimeEvents`、`vault`、`vaultNode`、`vaultNeighbors`）。`cards` 读取机箱数据（`board/cards.py`：把 `plugins/*/manifest.toml` 当作数据读）；`rounds`/`ledger` 折叠 progress.md / STATUS.md 两个 feed；`sessions`/`session` 读取运行时 session-log 链（供演进 / 机箱 / 账本面板与状态栏使用）；`sessionProgress` 把单个会话的 `task.plan_complete` 行折叠成指挥员侧栏与任务驾驶舱渲染的任务进度计数；`runtimeStatus` 读取实时的 `runtime_status.json`（取景窗 chip / 机器体征）。`runtimeFrame` 读取实时取景帧 JPEG（`runs/<session>/frame.jpg`），返回 `{jpeg_b64, ts, age_s}`，带 `afterTs` 游标（转发为 `--after-ts`；文件未变 → 短 `{unchanged}` 回复）与可选的 `waitMs` 长轮询（转发为 `--wait-ms`：storecli 阻塞至多约 2s 等帧越过游标再作答，取景窗收到回复立刻重发，到手帧率因此跟上 harness 的转储速率）。`runtimeEvents` 以增量 `afterSeq` 游标（转发为 `--after`）读取实时进度 feed（`runs/<session>/runtime_events.jsonl`）；当 `last_seq` 低于调用方游标时表示运行时已重启，轮询方从 0 重读（执行图实时图）。`vault`/`vaultNode`/`vaultNeighbors` 读取封存的类型化关系 vault 折叠（`board/vault.py`）——整张图、单节点 wiki 页、单节点邻接——供技能库面板使用。

## 配置

三个随部署变化的路径，由 `scripts/cockpit` 以 `PH_BOARD_*` 环境变量经部署 overlay 的 bundle 行注入：

- `pythonPath` —— 能 import `board.store` 的 Python（主机 venv）。
- `repoRoot` —— 主机仓库检出目录，用作子进程 `cwd`。
- `runsDir` —— campaign 的 `runs/` 目录，以 `--runs` 传入。

`PH_BOARD_REPO` 缺失时 bundle 行会禁用本插件，因此裸的 `dsh web` 仍能启动（面板此时报告 board 不可用）。

## 模型体验

无，因为该 Remote 只向浏览器面板提供只读状态；对话 LLM（大语言模型）通过 MCP 服务器读取同一批 `board.store` 函数，而 MCP 服务器不属于本包。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 每次请求一个 Python 子进程，冷 import `board.store`。在小型 store 上以人类节奏轮询完全够用；取景窗长轮询也把开销压到每送达一帧一次 spawn（约 35ms，占约 60ms 帧周期）。若实测该 spawn 成本成为帧率天花板，再升级为常驻读 worker。
