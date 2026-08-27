# @deepseek-ai/dsh-client-ui-ph-livegraph

[English](README.md) | 中文

执行图 —— physical-harness 控制台的实时执行图面板。一个 `conversation.view` 标签页，在最新运行时会话之上叠加三层：

- **capability 路由** —— 会话链的 `capability.resolve` 行（consumer → capability → provider ref），去重到当前挂载；
- **任务计划** —— 来自实时 feed 的 `plan_built` 完整节点图，feed 缺席时退回最新封存的 `task.plan_complete`；
- **实时状态** —— 由 board Remote 的 `runtimeEvents` 增量 feed（`runs/<session>/runtime_events.jsonl`，由 `harness.opstream` 写入；每次 boot 截断，`last_seq < cursor` 表示重启 → 重置并重读）驱动的节点/阶段生命周期动画。

纯消费者：每个状态都从 board 载荷原样拷贝；折叠层（`src/client/graph.ts`）只组装渲染状态，不做任何计算（宪章：TS 只渲染）。轮询节奏在任务进行中约 1.5s、空闲约 8s，文档隐藏时暂停。取景窗面板则对 board 的 `runtimeFrame` 面做长轮询（`afterTs` 游标 + 约 0.9s 的 `waitMs` 服务端阻塞），回复一到立刻重发，到手帧率因此跟上 harness 的转储帧率。过程流面板会给磁盘上有对应图片的行挂一张关键帧缩略图（`runs/<session>/keyframes/<seq:06d>-<kind>.jpg`，由 `harness.opstream` 写入，并在 `opstream.arm()` 时与 feed 一起清空）：它轮询不含字节的索引（`runtimeKeyframes`，约 3s），只有当某行缩略图首次进入滚动视口或被点击时才去取该行的 JPEG（`runtimeKeyframe`），绝不批量拉取。点击后弹出灯箱，←/→ 在本次运行的其他关键帧行之间切换（捕获阶段监听，不惊动 scrubber 快捷键），Esc 关闭。行上本来就有的事件 `seq` 就是全部关联键——没有关键帧的会话渲染结果与从前完全一致。

会话范围：面板自动跟随最新的实时运行时会话，并且只显示挂载它的那个对话打开之后到达的事件——运行时 feed 是全局的，否则会重放上一个对话的运行。表头选择器按 board 自己的 `runtime.boot` 标记把发现到的会话分成「实时运行时」与「历史归档」两组；手动选中的会话则完整重放。

图渲染采用 `@xyflow/react`（React Flow v12，MIT）加 `@dagrejs/dagre`（MIT）分层布局——`physical-harness/docs/ph-ui-redesign.md` §5 认可的组件组合，与任务驾驶舱重设计共用，两个面共讲同一套图语言。React Flow 的结构样式表 vendor 在 `src/client/xyflow-base.css`（MIT，取自 `@xyflow/react/dist/style.css`），经 `?inline` 通道注入并伴随插件整个生命周期，因为客户端打包器的 CSS 管线是包内局部的。

## 模型体验

无，因为该面板只为浏览器操作员渲染 board Remote 的实时 feed，不触及 prompt、消息、schema、流或工具结果。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 升级 `@xyflow/react` 时必须同步刷新 vendor 的 `xyflow-base.css`（打包器的 `?inline` 通道不解析 `node_modules` 说明符）。
- feed 的「按对话」起始 seq 只存在页面内存里：刷新后每个对话重新从空白开始，在新标签页里重开同一个对话也会以该标签页的队尾为起点。要持久化需要一个面板并不拥有的存储。
- 阶段事件按 feed 顺序归属到当前运行的节点（常驻运行时串行处理 brief）；并发任务需要 `stage_transition` 携带节点 id。
