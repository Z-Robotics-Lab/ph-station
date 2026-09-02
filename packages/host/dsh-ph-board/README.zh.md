# @deepseek-ai/dsh-ph-board

[English](README.md) | 中文

physical-harness fork 的主机侧桥接包。一个 Typert Remote（`board`），把 ph-station 的面板转发到主机（motherboard）的证据层（`board/store.py`）与规划面（`board/planning.py`），经其 CLI 面（`board/storecli.py`）访问，同源部署在 gateway 的 `trusted-host` 防线之后。四个方法会写：`submitBrief` 与 `submitSkillPlan`，storecli 向运行时会话 inbox 的原子投递；`cancelBrief`，协作式停止标记；以及 `modelServer`，本地模型服务的启停。其余全是读。

`skillLibrary` 转发 harness 为可搜索技能树生成的受限数据，其中合并了 RoboCasa 分类体系与已安装的运行时 catalogue。准确的 binding 判定与 canonical 相同的实现候选均由 harness 计算，并在回复中保持区分。

每个 `@Remote` 方法 `execFile` 执行 `<pythonPath> -m board.storecli <fn> [name]`（`cwd=<repoRoot>`），并把 `JSON.parse(stdout)` 原样返回——零统计、零解释。gateway 自动在 `POST /api/board/<name>` 提供它们（`stores`、`store`、`heldout`、`campaignProgress`、`cards`、`rounds`、`ledger`、`sessions`、`session`、`sessionProgress`、`runtimeStatus`、`runtimeFrame`、`runtimeEvents`、`runtimeKeyframes`、`runtimeKeyframe`、`runtimeRollout`、`hostVitals`、`modelServer`、`vault`、`vaultNode`、`vaultNeighbors`、`submitBrief`、`planSkillTask`、`submitSkillPlan`、`briefStatus`、`cancelBrief`、`skillLibrary`）。`submitBrief(briefJson, session)` 把两个字符串原样转发为 `storecli submit_brief --brief/--session`（与 `mcp_server.submit_brief` 共享同一个 `board/brief_drop` 原子写），并返回其 `{submitted, inbox}`——刻意零客户端校验，因为常驻运行时是 brief 语义的唯一权威。`campaignProgress` 读取 runs/ 下每个实时战役心跳（`runs/*/progress.json`，由脚本路径电池每完成一集覆写一次）——done/total/label、python 侧折好的滚动统计、以及 `running` 标记——供演进面板的进行中进度卡使用。`cards` 读取机箱数据（`board/cards.py`：把 `plugins/*/manifest.toml` 当作数据读）；`rounds`/`ledger` 折叠 progress.md / STATUS.md 两个 feed；`sessions`/`session` 读取运行时 session-log 链（供演进 / 机箱 / 账本面板与状态栏使用）；`sessionProgress` 把单个会话的 `task.plan_complete` 行折叠成指挥员侧栏与任务驾驶舱渲染的任务进度计数；`runtimeStatus` 读取实时的 `runtime_status.json`（取景窗 chip / 机器体征）；`hostVitals`（无参）读的是机器本身——每张 GPU 的 VRAM 及占用它的计算进程（按占用降序）、物理 RAM、以及 `runs/` 所在文件系统的可用空间——好让指挥员侧栏在显存打满、常驻运行时被打爆之前就看见天花板。没有 NVIDIA 驱动的主机返回空 `gpu` 列表，绝不返回错误。`modelServer(action)` 读取或切换本机的本地模型服务（llama.cpp，127.0.0.1:30001）——`{running, pid, port, healthy, model, vram_mib}`；`running` 为真而 `healthy` 为假就是那 1–2 分钟的加载窗口；动作失败时在依然真实的状态旁多一个 `error` 字段。它只切换服务进程，不决定请求路由到哪个模型（那是控制台的路由选择），停掉它可以把显存还给仿真。`action` 是唯一的位置参数，`board.store` 只接受 `status`/`start`/`stop`——它可以运行的启动脚本是那边的常量，因此本包不会有任何路径、命令行或 pid 传到 harness。`runtimeFrame` 读取实时取景帧 JPEG（`runs/<session>/frame.jpg`），返回 `{jpeg_b64, ts, age_s}`，带 `afterTs` 游标（转发为 `--after-ts`；文件未变 → 短 `{unchanged}` 回复）与可选的 `waitMs` 长轮询（转发为 `--wait-ms`：storecli 阻塞至多约 2s 等帧越过游标再作答，取景窗收到回复立刻重发，到手帧率因此跟上 harness 的转储速率）。`runtimeEvents` 以增量 `afterSeq` 游标（转发为 `--after`）读取实时进度 feed（`runs/<session>/runtime_events.jsonl`）；当 `last_seq` 低于调用方游标时表示运行时已重启，轮询方从 0 重读（执行图实时图）。`runtimeKeyframes(name)` 列出一个会话的关键帧索引（`runs/<session>/keyframes/<seq:06d>-<kind>.jpg`，在 `opstream.arm()` 时与 feed 一起清空），只有 seq/kind/ts 三元组、不含图片字节，所以 过程流 面板可以廉价轮询；`runtimeKeyframe(name, seq)`（以 `--seq` 转发）返回单帧的 `{jpeg_b64, seq, kind}`，只在某一行的缩略图进入视口或被点击时才取。`runtimeRollout` 把最新的可丢弃 `runs/<session>/rollout.mp4` 以 base64 提供给浏览器显式下载；它是实时 UI 状态，不是封存证据。`vault`/`vaultNode`/`vaultNeighbors` 读取封存的类型化关系 vault 折叠（`board/vault.py`）——整张图、单节点 wiki 页、单节点邻接——供技能库面板使用。


另有四个方法服务规划面板。`planSkillTask`（`storecli plan_skill_task --instruction=…`）是读：harness 从 RoboCasa 统一技能图谱检索相关子树，加上由自然语言驱动的任务绑定，向其 planner 卡（DeepSeek，严格 JSON）提问，用运行时同一个 `validate_plan` 校验回复，在服务端按 HAS_STAGE / DECOMPOSES_TO 展开组合技能，并逐个叶子检查是否有真实的 policy/driver binding；回复的 `status` 为 `executable`、`planning_only`、`rejected` 或 `no_match`，过程中不执行、不写入任何东西。`submitSkillPlan`（`storecli submit_skill_plan --plan=<record>`）是唯一显式的执行入口：harness 从零重新核验 `composite_plan` 记录，要么拒绝（`submitted: false` 并给出原因），要么经 `submit_brief` 同一条原子落盘路径投下一张普通 task brief，并返回该 brief 的 `brief_status` 句柄。`briefStatus` 与 `cancelBrief` 转发 harness 对该句柄的 brief 生命周期读/写。指令与记录以 `--key=value` 形式传参，以 `-` 开头的文本不会被当成选项；`execFile`（不经 shell）使它们远离任何注入面。


## 配置

三个随部署变化的路径，由 `scripts/cockpit` 以 `PH_BOARD_*` 环境变量经部署 overlay 的 bundle 行注入：

- `pythonPath` —— 能 import `board.store` 的 Python（主机 venv）。
- `repoRoot` —— 主机仓库检出目录，用作子进程 `cwd`。
- `runsDir` —— campaign 的 `runs/` 目录，以 `--runs` 传入。

`PH_BOARD_REPO` 缺失时 bundle 行会禁用本插件，因此裸的 `dsh web` 仍能启动（面板此时报告 board 不可用）。

## 模型体验

无，因为该 Remote 只向浏览器面板提供 harness 状态（读取，加上 `submitBrief` / `submitSkillPlan` 投递）；对话 LLM（大语言模型）通过 MCP 服务器访问同一批 `board.store` / `board.planning` / `brief_drop` 函数，而 MCP 服务器不属于本包；harness 自己的 planner 调用发生在主机侧的 `plan_skill_task` 内部，从不在这里。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 面板读方法每次请求一个 Python 子进程，冷 import `board.store`。`planSkillTask` 还要等待 harness 的模型调用（数秒级），面板在子进程返回前显示规划中状态。在小型 store 上以人类节奏轮询完全够用。仅 `runtimeFrame` 走常驻 `storecli serve` worker（行式 JSON stdio，同一 dispatch）：实测每请求约 60ms 的 spawn 成本曾是取景窗帧率天花板。worker 串行处理帧读取，第二个浏览器标签页与之共享一条帧管线。
