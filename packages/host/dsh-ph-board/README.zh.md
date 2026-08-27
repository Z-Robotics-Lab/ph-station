# @deepseek-ai/dsh-ph-board

[English](README.md) | 中文

physical-harness fork 的主机侧桥接包。一个 Typert Remote（`board`），把 ph-station 的面板转发到主机（motherboard）的证据层（`board/store.py`），经其 CLI 面（`board/storecli.py`）访问，同源部署在 gateway 的 `trusted-host` 防线之后。除一个方法外全部只读；`submitBrief` 是唯一的写——经 storecli 把 brief 原子投递进运行时会话的 inbox。

每个 `@Remote` 方法 `execFile` 执行 `<pythonPath> -m board.storecli <fn> [name]`（`cwd=<repoRoot>`），并把 `JSON.parse(stdout)` 原样返回——零统计、零解释。gateway 自动在 `POST /api/board/<name>` 提供它们（`stores`、`store`、`heldout`、`campaignProgress`、`cards`、`rounds`、`ledger`、`sessions`、`session`、`sessionProgress`、`runtimeStatus`、`runtimeFrame`、`runtimeKeyframes`、`runtimeKeyframe`、`runtimeEvents`、`vault`、`vaultNode`、`vaultNeighbors`、`submitBrief`）。`submitBrief(briefJson, session)` 把两个字符串原样转发为 `storecli submit_brief --brief/--session`（与 `mcp_server.submit_brief` 共享同一个 `board/brief_drop` 原子写），并返回其 `{submitted, inbox}`——刻意零客户端校验，因为常驻运行时是 brief 语义的唯一权威。`campaignProgress` 读取 runs/ 下每个实时战役心跳（`runs/*/progress.json`，由脚本路径电池每完成一集覆写一次）——done/total/label、python 侧折好的滚动统计、以及 `running` 标记——供演进面板的进行中进度卡使用。`cards` 读取机箱数据（`board/cards.py`：把 `plugins/*/manifest.toml` 当作数据读）；`rounds`/`ledger` 折叠 progress.md / STATUS.md 两个 feed；`sessions`/`session` 读取运行时 session-log 链（供演进 / 机箱 / 账本面板与状态栏使用）；`sessionProgress` 把单个会话的 `task.plan_complete` 行折叠成指挥员侧栏与任务驾驶舱渲染的任务进度计数；`runtimeStatus` 读取实时的 `runtime_status.json`（取景窗 chip / 机器体征）。`runtimeFrame` 读取实时取景帧 JPEG（`runs/<session>/frame.jpg`），返回 `{jpeg_b64, ts, age_s}`，带 `afterTs` 游标（转发为 `--after-ts`；文件未变 → 短 `{unchanged}` 回复）与可选的 `waitMs` 长轮询（转发为 `--wait-ms`：storecli 阻塞至多约 2s 等帧越过游标再作答，取景窗收到回复立刻重发，到手帧率因此跟上 harness 的转储速率）。`runtimeEvents` 以增量 `afterSeq` 游标（转发为 `--after`）读取实时进度 feed（`runs/<session>/runtime_events.jsonl`）；当 `last_seq` 低于调用方游标时表示运行时已重启，轮询方从 0 重读（执行图实时图）。`runtimeKeyframes`/`runtimeKeyframe` 读取 harness 钉在关键 feed seq 上的静帧（`runs/<session>/keyframes/<seq>-<kind>.jpg`，随 feed 每次启动一并清空）：前者只返回索引（`{frames: [{seq, kind, ts}], count}`——不含图像字节，因此面板可按事件节奏轮询），后者按 seq（转发为 `--seq`）取单张静帧，返回 `{jpeg_b64, seq, kind}`。关键帧与 `frame.jpg` 同属实时状态：它们永不进入 session-log 链，目录缺失时读作空索引。`vault`/`vaultNode`/`vaultNeighbors` 读取封存的类型化关系 vault 折叠（`board/vault.py`）——整张图、单节点 wiki 页、单节点邻接——供技能库面板使用。

## 配置

三个随部署变化的路径，由 `scripts/cockpit` 以 `PH_BOARD_*` 环境变量经部署 overlay 的 bundle 行注入：

- `pythonPath` —— 能 import `board.store` 的 Python（主机 venv）。
- `repoRoot` —— 主机仓库检出目录，用作子进程 `cwd`。
- `runsDir` —— campaign 的 `runs/` 目录，以 `--runs` 传入。

`PH_BOARD_REPO` 缺失时 bundle 行会禁用本插件，因此裸的 `dsh web` 仍能启动（面板此时报告 board 不可用）。

## 模型体验

无，因为该 Remote 只服务浏览器面板（读取加 `submitBrief` 投递）；对话 LLM（大语言模型）通过 MCP 服务器访问同一批 `board.store` / `brief_drop` 函数，而 MCP 服务器不属于本包。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 面板读方法每次请求一个 Python 子进程，冷 import `board.store`。在小型 store 上以人类节奏轮询完全够用。仅 `runtimeFrame` 走常驻 `storecli serve` worker（行式 JSON stdio，同一 dispatch）：实测每请求约 60ms 的 spawn 成本曾是取景窗帧率天花板。worker 串行处理帧读取，第二个浏览器标签页与之共享一条帧管线。
