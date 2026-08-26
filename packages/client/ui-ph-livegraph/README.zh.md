# @deepseek-ai/dsh-client-ui-ph-livegraph

[English](README.md) | 中文

执行图 —— physical-harness 控制台的实时执行图面板。一个 `conversation.view` 标签页，在最新运行时会话之上叠加三层：

- **capability 路由** —— 会话链的 `capability.resolve` 行（consumer → capability → provider ref），去重到当前挂载；
- **任务计划** —— 来自实时 feed 的 `plan_built` 完整节点图，feed 缺席时退回最新封存的 `task.plan_complete`；
- **实时状态** —— 由 board Remote 的 `runtimeEvents` 增量 feed（`runs/<session>/runtime_events.jsonl`，由 `harness.opstream` 写入；每次 boot 截断，`last_seq < cursor` 表示重启 → 重置并重读）驱动的节点/阶段生命周期动画。

纯消费者：每个状态都从 board 载荷原样拷贝；折叠层（`src/client/graph.ts`）只组装渲染状态，不做任何计算（宪章：TS 只渲染）。轮询节奏在任务进行中约 1.5s、空闲约 8s，文档隐藏时暂停。取景窗面板则对 board 的 `runtimeFrame` 面做长轮询（`afterTs` 游标 + 约 0.9s 的 `waitMs` 服务端阻塞），回复一到立刻重发，到手帧率因此跟上 harness 的转储帧率。

图渲染采用 `@xyflow/react`（React Flow v12，MIT）加 `@dagrejs/dagre`（MIT）分层布局——`physical-harness/docs/ph-ui-redesign.md` §5 认可的组件组合，与任务驾驶舱重设计共用，两个面共讲同一套图语言。React Flow 的结构样式表 vendor 在 `src/client/xyflow-base.css`（MIT，取自 `@xyflow/react/dist/style.css`），经 `?inline` 通道注入并伴随插件整个生命周期，因为客户端打包器的 CSS 管线是包内局部的。

## 模型体验

无，因为该面板只为浏览器操作员渲染 board Remote 的实时 feed，不触及 prompt、消息、schema、流或工具结果。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 升级 `@xyflow/react` 时必须同步刷新 vendor 的 `xyflow-base.css`（打包器的 `?inline` 通道不解析 `node_modules` 说明符）。
- 面板只绑定最新会话；会话切换器随 ui-redesign 的指挥员侧栏一起到来，由后者负责会话切换。
- 阶段事件按 feed 顺序归属到当前运行的节点（常驻运行时串行处理 brief）；并发任务需要 `stage_transition` 携带节点 id。
