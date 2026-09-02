# @deepseek-ai/dsh-client-ui-ph-ops

[English](README.md) | 中文

physical-harness 指挥员侧栏 + 任务驾驶舱。两个浏览器面，通过 board Remote 读取 harness 证据层并只做渲染：

- **任务驾驶舱** —— 一个 `conversation.view` 标签页（任务图）。运行中任务的 graph-first 视图：目标 → 任务节点 → 阶段流水线，加上 capability 接线扇形，一张可交互的 React Flow DAG（平移/缩放、minimap、点击选中）。运行历史条在已封存的任务尝试之间切换；点击节点在图旁打开其证据（阶段、故障、provider `ref`）。状态色沿用既定三色（绿过 / 红败 / 中性待定），与战报/演进/账本读作同一套系统。
- **技能页** —— 一个 `conversation.view` 标签页（技能）：一张表覆盖 board 的 `skills` 折叠（记录名、具身绑定、执行器键、证据计数、限制、失败模式）；点开一行看按执行器的证据。
- **演化页** —— 一个 `conversation.view` 标签页（演化）：轻量 evolve 循环，可见、可停、可续。列出会话的 evolve campaign（对运行时事件流里见过认领的每个任务调 `rsiRun`，加上本页启动过的），只填任务名即可启动（`submitBrief` 投 `{"kind":"evolve","task"}`，其它字段全走 runtime 缺省），选中的 campaign 展示各轮、`rsiSeries` 成功计数折线（内联 SVG，无图表库）、某一轮的 `rsiFrames` 媒体路径、以及 `runtimeEvents` 里属于该 brief 的日志行。停止 = 对打开的 brief 调 `cancelBrief`；续跑 = 重投同一 brief（runtime 从 campaign.json 的 cursor 继续）。
- **指挥员侧栏** —— 一个 `sidebar.section` 占位：常驻的扫视卡片栈（任务小地图、进度、运行时体征、演进 ticker），不用点击就回答「任务到哪了 / 有没有在推进 / 机器健康吗 / 有没有变好」。侧栏收成图标条时折叠为状态点。

每个数字都来自 `board.store`——Python 的 `session_progress` 折叠与会话链——经 board Host Remote（`sessionProgress`、`session`、`sessions`、`runtimeStatus`、`runtimeEvents`、`hostVitals`、`modelServer`、`stores`、`rounds`）。这里不计算任何统计（宪章审定的硬规则：fork 渲染，Python 聚合）。体征卡还从 `hostVitals` 读主机本身的余量——每张 GPU 的显存及占用它的进程、内存、磁盘可用——走自己的 5s 轮询，因为这些量自己会动、没有 board 写入可跟随，而显存打满会直接打爆常驻 runtime；超过 90% 时进度条变红。阈值只决定颜色，绝不产生数字。在解释它的那条显存进度条下面，这张卡带着本面唯一的控制项：`modelServer` 启停本机的本地模型服务，徽章分停止 / 加载中 / 运行中（`running` 而非 `healthy` 就是那 1–2 分钟的加载），按钮在轮询确认切换完成之前一直保持按下。它只切换服务进程——请求发给哪个模型仍由模型选择器决定——侧栏传的是一个字面动作词；白名单、启动脚本路径与击杀护栏全在 `board.store` 那边。侧栏读取 `runtimeEvents` 仅用于区分"运行中"与"已收场"——直接读 board 自己的 `task_claimed` / `task_done` / `task_failed` 标记，绝不在此计算判定。

## 依赖

两个净新增运行时依赖，均为 MIT，依重设计规范（`physical-harness/docs/ph-ui-redesign.md` §5）论证：

- **`@xyflow/react`**（React Flow v12）—— 可交互任务 DAG：自定义状态着色节点、平移/缩放、minimap、受控选中支撑点击下钻。用 SVG 手写是更大的 diff 且交互/可访问性更差。React Flow 渲染自己的 DOM 子树，不继承面板语言；`ops.module.css` 用 `currentColor`（随应用主题翻转）覆写其 `--xy-*` 变量并设置 `colorMode="system"`。
- **`@dagrejs/dagre`** —— 给 React Flow（不自动定位）供位的分层 DAG 布局。小巧，且对我们个位数到几十的节点数足够。

## 模型体验

无，因为两个面都只为浏览器操作员渲染 board Remote 状态；对话 LLM（大语言模型）通过 MCP 服务器读取同一批 `board.store` 函数。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- **演化媒体只有路径，没有图。** `rsiFrames` 返回会话相对路径，board 没有面提供字节，所以演化页只列路径；缩略图与内联视频等一个提供字节的面。
- **演化 campaign 列表跟随运行时事件流。** 列表靠对每次启动内 `runtimeEvents` 里出现的任务逐个调 `rsiRun` 得到，上次重启前认领的 campaign 要等本页再次启动该任务才会出现；一个列 campaigns 目录的面可以补上这个缺口。

- **实时进行中状态。** 驾驶舱显示最后*封存*的 `task.plan_complete` 树，而非中途的阶段进度。实时 feed（`runtime_events.jsonl`，由 `board.store.read_runtime_events` 读取）已用于驱动侧栏任务小图在"运行中"渲染与"已收场"终局行之间切换；用同一 feed 给驾驶舱图里进行中的节点做动画仍被推迟。
- **收场停留时长固定。** 一次运行封存后，任务小图的终局行停留 `SETTLE_MS`（30 秒）再让位给空闲态；有新运行会重新显示。固定常量而非配置——除非操作员要求，否则不外露。
- **节点证据内联渲染**在驾驶舱里，而不是路由到右侧 `details` slot。跨 slot 的会话作用域选中接线被推迟；内联面板自成一体。
- **每次轮询的 board 调用。** 侧栏每 15s 轮询驱动七次 board 读取（sessions、session、session_progress、runtime_status、runtime_events、stores、rounds），每次都是一个冷的 `board.storecli` 子进程。在小型 store 上以人类节奏没问题；若实测轮询延迟成为问题，再合并成单个读取函数。
- **卡片不能单独折叠。** 区块整体滚动；侧栏长大后再加每卡折叠。
