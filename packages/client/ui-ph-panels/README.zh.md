# @deepseek-ai/dsh-client-ui-ph-panels

[English](README.md) | 中文

规划、技能库、演化台、演进（RSI 监视器）、机箱、账本六个面板，加上全框架的状态栏。每个都是一个 slot 条目，通过 `board` Host Remote 读取 harness 证据层与规划层并只做渲染——没有服务、没有业务逻辑。每个数字、每个判定都来自 `board.store` / `board.cards` / `board.planning`；TS 只做格式化（pp ×100 带符号、mtime → 时长），不做任何计算。

- **演化台头部：Run RSI + 链条 stepper**（RSI 总览标签页顶部）—— 一个替代手写 `{"kind":"rsi","task":...}` brief 的启动器：task 下拉来自机箱能力卡 `task_bindings` 的平铺，session 下拉只列 `runtime.boot` 会话中实时 `runtimeStatus` mode 为 `evolution` 的（各自带心跳年龄；超过约 10 分钟显示灰色「runtime 可能已失活 (stale)」徽章——只显示事实，绝不拦截提交），提交按钮把两个字符串经 `/api/board/submitBrief` 发出，零客户端校验（运行时是唯一权威；返回的 `submitted` 文件名会回显）。其下是七步链条 stepper（领块 → 标定 → 门禁 → prereg → dev → held-out → 装入），位置来自最新 rsi `campaignProgress` 心跳的 `stage`，并渲染 done/total 进度条、三个种子块、首死分布小条形图，以及门禁 c1..c6 判据的红/绿 chip（来自封存的 `runtime.rsi_scheduled` 会话行；链条运行中回退到心跳自带的 verdict 字段）；NO-GO 渲染为带标注的诚实结果，绝不是错误态。
- **规划**（`conversation.view` 标签页）—— 一个自然语言任务输入框和仿真器选择器，背后是 `/api/board/planSkillTask`（当前已安装 RoboCasa，对应 `session-robocasa`）。通过校验的回复会转成响应式可视化技能图谱：任务目标与组合技能从左向右排列，每张组合卡片从上到下展开叶子技能，分类路径和可读的参数 chip 依附于所属节点，有/无 binding 的圆点与 chip 直接表达可执行性，不向操作员展示传输 JSON。状态判定（`executable` / `planning_only` / `rejected` / `no_match`）、路由词表、紧凑目录规模、终止节点和每一个缺失的 binding 仍然是可见的 harness 事实。只有 harness 返回 `executable: true` 时“执行”才可用；它把返回的 `composite_plan` 记录提交到 `/api/board/submitSkillPlan`，显示 harness 回答的 brief id 与状态（排队中 / 运行中 / 停滞 / 完成 / 失败 / 已取消，活跃期间每 2 s 经 `/api/board/briefStatus` 轮询），并提供 `/api/board/cancelBrief`。被拒绝的提交按拒绝显示。模型文本以 React 文本节点渲染，绝不当作 HTML。
- **技能库**（`conversation.view` 标签页）—— `/api/board/skillLibrary` 默认把 `unified_skill_graph.json` 投影成可搜索的“总体技能树”：`RobotSkill` 是根，父子卡片与连接线画出完整 IS_A 分类体系，不同节点样式区分根、分类、观测技能与规范技能，binding 圆点直接表达就绪状态。布局开关仍可切换到紧凑的可折叠目录树。在任一布局选中节点后可查看 HAS_STAGE / REALIZES 阶段、DECOMPOSES_TO 组合、受限的 annotation label 与数据集证据、准确的 binding 状态，以及 canonical 相同的实现候选。第二份目录列出已安装运行时技能的 task、policy 与参数 schema；候选不会被算作直接 binding。
- **演进**（`conversation.view` 标签页）—— `/api/board/stores` + `/api/board/store` 渲染每代 Δpp 条形图（dev/blind/held-out 差值、晋升事件、McNemar fixed/broken），`/api/board/rounds` 渲染 progress.md feed`/api/board/campaignProgress` 驱动顶部的进行中卡片：每个正在跑的脚本路径电池（`runs/*/progress.json` 心跳）一张，含 done/total 进度条、成功数、首死 top-3 芯片，以及由 python 提供的时间戳纯显示换算出的预计剩余；campaign 运行期间仅心跳读取收紧到 5s 轮询，没有进行中 campaign 时卡片不渲染（不占位）。
- **机箱**（`conversation.view` 标签页）—— `/api/board/cards` 卡片网格：名称、actuation、needs_sim、contribute 计数与 manifest 摘要。doctor 尚未接线（还没有 `scripts/plugin_doctor.py`），因此用一个标注 `体检: 未接入` 的槽位占位——绝不伪造。
- **账本**（`conversation.view` 标签页）—— `/api/board/ledger` seed-block 表格：范围、burn 状态、来源行。`parse_ledger` 不返回 task / holdout 字段，这些列因此缺席而不是被发明出来。
- **状态栏**（`shell.overlay` 条）—— MODE 与 boot 事实来自最新运行时会话的 `runtime.boot` 行（`/api/board/sessions` + `/api/board/session`），心跳来自会话 mtime，board 桥接可达性来自 fetch 是否成功。boot 行携带 `render` 键时还会显示取景窗开/关 chip；没有该键的行（较老的会话）不显示 chip——以存在为信号，绝不猜测。
- **任务台 chips**（输入框上方的 `conversation.input.dock` 行）—— 小型预设按钮（stack / lift_geometric 任务、最新战报），经会话输入面把可编辑的提示词模板预填进输入框草稿；它们从不提交——操作员改好 seed/参数后自己发送。

实时数据面板与状态栏共享一个 15s 轮询，标签页隐藏时暂停、回到可见立即重跑；轮询失败保留上一份好数据。技能库只加载一次并提供显式刷新，因为它的数据源只在生成图谱或已安装 plugin 变化时改变。当 board 桥接未挂载时（无 `PH_BOARD_*` 环境变量的裸 `dsh web`），每个面板报告数据面不可用。

## 模型体验

本包自己的请求：无。面板只渲染 board Remote 状态；任务台 chips 只预填一段可编辑的输入框草稿，只有操作员发送时它才作为普通用户消息到达模型。规划面板的“规划”按钮会让 harness 用一份紧凑技能目录调用它自己的 planner 模型（经主机侧 `plugins/planner_vlm` 访问 DeepSeek）；该请求在 harness 侧组装并受限，从不经过本包或对话会话。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 固定 15s 轮询而非 mtime 驱动的刷新；对小型 `runs/` 树足够，变大再改。
- 规划面板预览的计划，常驻运行时会从 brief 用同一个 planner 与校验器重新推导；预览链只是参考，运行时封存的计划才是证据。
- 演进 Δpp 条形图使用固定的 40pp 满刻度参考（一个扫视线索；每根条旁边都有精确的带符号数值）。
