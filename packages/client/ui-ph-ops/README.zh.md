# @deepseek-ai/dsh-client-ui-ph-ops

[English](README.md) | 中文

physical-harness 指挥员侧栏 + 任务驾驶舱。两个浏览器面，通过 board Remote 读取 harness 证据层并只做渲染：

- **任务驾驶舱** —— 一个 `conversation.view` 标签页（任务图）。运行中任务的 graph-first 视图：目标 → 任务节点 → 阶段流水线，加上 capability 接线扇形，一张可交互的 React Flow DAG（平移/缩放、minimap、点击选中）。运行历史条在已封存的任务尝试之间切换；点击节点在图旁打开其证据（阶段、故障、provider `ref`）。状态色沿用既定三色（绿过 / 红败 / 中性待定），与战报/演进/账本读作同一套系统。
- **指挥员侧栏** —— 一个 `sidebar.section` 占位：常驻的扫视卡片栈（任务小地图、进度、运行时体征、演进 ticker），不用点击就回答「任务到哪了 / 有没有在推进 / 机器健康吗 / 有没有变好」。侧栏收成图标条时折叠为状态点。

每个数字都来自 `board.store`——Python 的 `session_progress` 折叠与会话链——经 board Host Remote（`sessionProgress`、`session`、`sessions`、`runtimeStatus`、`runtimeEvents`、`stores`、`rounds`）。这里不计算任何统计（宪章审定的硬规则：fork 渲染，Python 聚合）。侧栏读取 `runtimeEvents` 仅用于区分"运行中"与"已收场"——直接读 board 自己的 `task_claimed` / `task_done` / `task_failed` 标记，绝不在此计算判定。

## 依赖

两个净新增运行时依赖，均为 MIT，依重设计规范（`physical-harness/docs/ph-ui-redesign.md` §5）论证：

- **`@xyflow/react`**（React Flow v12）—— 可交互任务 DAG：自定义状态着色节点、平移/缩放、minimap、受控选中支撑点击下钻。用 SVG 手写是更大的 diff 且交互/可访问性更差。React Flow 渲染自己的 DOM 子树，不继承面板语言；`ops.module.css` 用 `currentColor`（随应用主题翻转）覆写其 `--xy-*` 变量并设置 `colorMode="system"`。
- **`@dagrejs/dagre`** —— 给 React Flow（不自动定位）供位的分层 DAG 布局。小巧，且对我们个位数到几十的节点数足够。

## 模型体验

无，因为两个面都只为浏览器操作员渲染 board Remote 状态；对话 LLM（大语言模型）通过 MCP 服务器读取同一批 `board.store` 函数。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- **实时进行中状态。** 驾驶舱显示最后*封存*的 `task.plan_complete` 树，而非中途的阶段进度。实时 feed（`runtime_events.jsonl`，由 `board.store.read_runtime_events` 读取）已用于驱动侧栏任务小图在"运行中"渲染与"已收场"终局行之间切换；用同一 feed 给驾驶舱图里进行中的节点做动画仍被推迟。
- **收场停留时长固定。** 一次运行封存后，任务小图的终局行停留 `SETTLE_MS`（30 秒）再让位给空闲态；有新运行会重新显示。固定常量而非配置——除非操作员要求，否则不外露。
- **节点证据内联渲染**在驾驶舱里，而不是路由到右侧 `details` slot。跨 slot 的会话作用域选中接线被推迟；内联面板自成一体。
- **每次轮询的 board 调用。** 侧栏每 15s 轮询驱动七次 board 读取（sessions、session、session_progress、runtime_status、runtime_events、stores、rounds），每次都是一个冷的 `board.storecli` 子进程。在小型 store 上以人类节奏没问题；若实测轮询延迟成为问题，再合并成单个读取函数。
- **卡片不能单独折叠。** 区块整体滚动；侧栏长大后再加每卡折叠。
