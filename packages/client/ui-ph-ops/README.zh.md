# @deepseek-ai/dsh-client-ui-ph-ops

[English](README.md) | 中文

physical-harness 指挥员侧栏 + 任务驾驶舱 + RSI 页。若干浏览器面，通过 board Remote 读取 harness 证据层并只做渲染：

- **任务驾驶舱** —— 一个 `conversation.view` 标签页（任务图）。运行中任务的 graph-first 视图：目标 → 任务节点 → 阶段流水线，加上 capability 接线扇形，一张可交互的 React Flow DAG（平移/缩放、minimap、点击选中）。运行历史条在已封存的任务尝试之间切换；点击节点在图旁打开其证据（阶段、故障、provider `ref`）。状态色沿用既定三色（绿过 / 红败 / 中性待定），与战报/演进/账本读作同一套系统。
- **技能库** —— 在 `ui-ph-vault`（view id `vault`，技能库）：类 / 技能 / 基准 / 机箱的唯一入口；本包不再注册技能标签页。
- **RSI 页** —— `conversation.view` 标签页 `rsi`（RSI）：把轻量 evolve 循环（看 → 试 → 同种子再跑 → 变好才发布）当作唯一的 RSI 主面，扁平排版。头部一行：任务选择（自由文本，配上机箱能力卡 `task_bindings` 的原生 datalist）、开始/继续（`submitBrief` 投 `{"kind":"evolve","task","proposer"}`，`proposer` 来自一个小的提议器下拉，默认 LLM，可选规则；其它字段全走 runtime 缺省；已知任务从 campaign.json 的 cursor 继续；点击后头部下方立刻出现一行——已投递 brief · 等待 runtime 认领 带秒数计数，60 秒未认领变红并指向健康面板，看到该 brief 的 `task_claimed` 标记、状态变为运行中或 cursor 前进即显示已认领——期间页面每 2s 轮询，该任务的开始按钮保持禁用，停止已可取消该 brief）、停止（对该 campaign 的 `open_brief` 调 `cancelBrief`），右侧一个小的会话选择（只列进化态会话）。其下是会话的 campaign 芯片行，来自 `rsiCampaigns`——读的是 `campaigns/evolve-*/campaign.json`，所以控制台重启后列表仍在；每个芯片写 `task · 第 r 轮 · 最佳 k/n · 状态`，点击选中，第一行（运行中的，否则最近更新的）自动选中；一个都没有时用一句话提示输入任务并按开始。选中的 campaign 从上到下：状态卡只在有一轮进行中时出现（取自 `rsiRun` 的 `live` 块：看（基线评测）→ 试（提议）→ 复测 → 发布 步进条高亮 `live.phase`——phase 为 `propose` 时「试」一步显示「LLM 分析中」——、第 r 轮、种子 i/n · seed · 节点、自 `round_started_at` 起的已用时与按 `last_round_s` 的预计剩余——首轮无估计——以及原样的 `live.message`；`live: null` 的运行中 campaign 早于实时进度功能并如此说明），运行中时每 1s 轮询一次该回合的 `runtimeFrame` JPEG，旁边是本轮种子（`seeds` [lo, hi] 每个种子一个芯片：来自 `live.per_seed_partial` 的 ✓ / ✗ 首死 节点（failure_mode），`live.seed` 为运行中，其余排队），一条轮次带——轮次芯片（前 → 后、`tried` 写成一句话、发布 ✓/–，进行中的那轮虚线；点击选中该轮，默认最新）在 `rsiSeries` 成功计数折线（内联 SVG，有坐标轴、y 刻度 0..n、x 标签 第1轮…、前 / 后 / 最佳 图例，空时显示 第一轮完成后出现折线）上方且同宽——轮次卡（LLM 分析 = 行带 `llm` 时该轮 `llm.summary` 的原话；看到了什么 = `per_seed` 表，试了什么 = `tried` 写成一句话如「drop-can1 换用 pi05 执行器」并带一枚来源小标（按 `proposer`：LLM / 规则 / 收件箱，轮次条上的轮次片同样带它），下方是 `llm.rationale`，结果 = 前 → 后（最佳），发布 = 是/否，还缺什么 = 没试到东西时的 `needs`），关键片段（所示轮次的 `rsiFrames` 片段卡片 + 它的 `media_dropped` 原因），以及默认折叠、campaign 失败或取消时自动展开的日志（`runtimeEvents` 里属于该 brief 的行写成句子——HH:MM:SS 认领了 task 的演化 / 第 r 轮 … / 完成 / 失败：error——原始 JSON 在「原始」开关后面）。campaign 运行中每 2s 轮询一次，否则每 10s。旧的重链只在存在旧 store（`stores` 非空）时才渲染，折叠在底部作为「严格评测（prereg / 盲双胞胎 / held-out）」——可选的规则型纪律，只对 `plugins/rsi` 的 rule 型 RSI 有意义——按视图 id 经 owner 的 `renderView` 渲染 ui-ph-panels 的 `rsi-strict` 启动器及其 迭代记录 / 战报 / 账本 子标签。
- **指挥员侧栏** —— 一个 `sidebar.section` 占位：常驻的扫视卡片栈（任务小地图、进度、运行时体征、RSI ticker——进化态会话经 `rsiCampaigns` 得到的最新 campaign（运行中的优先；重启后仍在）的 `任务 · 第 r 轮 · best k/n · 状态`，仅当存在旧式 store 时下面再加一行旧的晋升计数），不用点击就回答「任务到哪了 / 有没有在推进 / 机器健康吗 / 有没有变好」。侧栏收成图标条时折叠为状态点。

每个数字都来自 `board.store`——Python 的 `session_progress` 折叠与会话链——经 board Host Remote（`sessionProgress`、`session`、`sessions`、`runtimeStatus`、`runtimeEvents`、`hostVitals`、`modelServer`、`policyServer`、`restartServices`、`health`、`stores`、`cards`、`rsiCampaigns`、`rsiRun`、`rsiSeries`、`rsiFrames`）。这里不计算任何统计（宪章审定的硬规则：fork 渲染，Python 聚合）。体征卡还从 `hostVitals` 读主机本身的余量——每张 GPU 的显存及占用它的进程、内存、磁盘可用——走自己的 5s 轮询，因为这些量自己会动、没有 board 写入可跟随，而显存打满会直接打爆常驻 runtime；超过 90% 时进度条变红。阈值只决定颜色，绝不产生数字。在解释它的那条显存进度条下面，这张卡带着本面唯一的控制项：`modelServer` 启停本机的本地模型服务，徽章分停止 / 加载中 / 运行中（`running` 而非 `healthy` 就是那 1–2 分钟的加载），按钮在轮询确认切换完成之前一直保持按下。它只切换服务进程——请求发给哪个模型仍由模型选择器决定——侧栏传的是一个字面动作词；白名单、启动脚本路径与击杀护栏全在 `board.store` 那边。它旁边的 `policyServer` 是同一种开关，对象换成 pi0.5 策略服务（徽章分未启动 / 运行中（未就绪） / 服务中，附 checkpoint sha 短码），用显式的启动 / 停止两个按钮，并注明默认不启动、约占 18 GB 显存、不能与本地模型共存。最后，`restartServices` 重启 harness 服务，走控件内的两步确认（第一次点击进入待确认，8s 内再点一次才真正触发；绝不用 `window.confirm`），带一个“重建控制台后重启”复选框；触发后卡片显示重启中，并（先等一小段宽限，因为重启助手在控制台下线前就已答复）轮询 `health` 直到控制台恢复应答，再显示其 `restart` 行的状态与最后一行。侧栏读取 `runtimeEvents` 仅用于区分"运行中"与"已收场"——直接读 board 自己的 `task_claimed` / `task_done` / `task_failed` 标记，绝不在此计算判定。

## 依赖

两个净新增运行时依赖，均为 MIT，依重设计规范（`physical-harness/docs/ph-ui-redesign.md` §5）论证：

- **`@xyflow/react`**（React Flow v12）—— 可交互任务 DAG：自定义状态着色节点、平移/缩放、minimap、受控选中支撑点击下钻。用 SVG 手写是更大的 diff 且交互/可访问性更差。React Flow 渲染自己的 DOM 子树，不继承面板语言；`ops.module.css` 用 `currentColor`（随应用主题翻转）覆写其 `--xy-*` 变量并设置 `colorMode="system"`。
- **`@dagrejs/dagre`** —— 给 React Flow（不自动定位）供位的分层 DAG 布局。小巧，且对我们个位数到几十的节点数足够。

## 模型体验

无，因为两个面都只为浏览器操作员渲染 board Remote 状态；对话 LLM（大语言模型）通过 MCP 服务器读取同一批 `board.store` 函数。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- **片段流式播放但不支持 Range。** 关键片段 把每条 `rsiFrames` 路径渲染成一张卡片，字节来自 board 的 `GET /api/board/media/<session>/<relpath>` 路由（.mp4 用静音、仅预载元数据的 `<video>`，.gif/.png 用 `<img>`，说明文字是文件名里的节点名）；路由整文件流出，所以拖动进度条要等下载。

- **实时进行中状态。** 驾驶舱显示最后*封存*的 `task.plan_complete` 树，而非中途的阶段进度。实时 feed（`runtime_events.jsonl`，由 `board.store.read_runtime_events` 读取）已用于驱动侧栏任务小图在"运行中"渲染与"已收场"终局行之间切换；用同一 feed 给驾驶舱图里进行中的节点做动画仍被推迟。
- **收场停留时长固定。** 一次运行封存后，任务小图的终局行停留 `SETTLE_MS`（30 秒）再让位给空闲态；有新运行会重新显示。固定常量而非配置——除非操作员要求，否则不外露。
- **节点证据内联渲染**在驾驶舱里，而不是路由到右侧 `details` slot。跨 slot 的会话作用域选中接线被推迟；内联面板自成一体。
- **每次轮询的 board 调用。** 侧栏每 15s 轮询驱动七次以上 board 读取（sessions、session、session_progress、runtime_status、runtime_events、stores，再为进化态会话的最新 campaign 读 rsi_campaigns），每次都是一个冷的 `board.storecli` 子进程。在小型 store 上以人类节奏没问题；若实测轮询延迟成为问题，再合并成单个读取函数。
- **卡片不能单独折叠。** 区块整体滚动；侧栏长大后再加每卡折叠。
