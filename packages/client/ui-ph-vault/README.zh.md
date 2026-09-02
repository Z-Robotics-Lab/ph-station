# @deepseek-ai/dsh-client-ui-ph-vault

[English](README.md) | 中文

技能库（Skill Library）—— physical-harness 技能图谱的唯一浏览页，view id `vault`（EVOLUTION 组里 RSI 旁边仅有的标签页；原 `ui-ph-ops` 的技能表与 `ui-ph-panels` 的能力卡网格都并入这里）。它以三栏渲染 board vault 折叠（`board/vault.py`）产出的确定性五 kind 图（skill / class / benchmark / package / capability；边 IN_CLASS、DEPENDS_ON、BOUND_TO、EVIDENCED_ON、INSTANCE_OF、PROVIDES、MOUNTED_IN 加旧关系），三栏共享一个选中。

三层及其边界（也是画布图例）：

- **能力** —— 内核的接口槽位：`embodiment.env`、`policy.driver`、`task.planner` 等 10 个固定名字。
- **卡片**（package）—— 带 manifest 的插件目录，安装单元；提供（PROVIDES）能力，承载执行器。
- **技能** —— 一条 SkillRecord：符号契约（前置 / 保证 / 破坏）+ 绑定到某张卡片的执行器（BOUND_TO）+ 证据。

跨层关系只有 PROVIDES（卡片 → 能力）、MOUNTED_IN（卡片 → 具身卡片）、BOUND_TO（技能 → 卡片）；技能之间：DEPENDS_ON、INSTANCE_OF、IN_CLASS。旧的 `runs/*/skills` 记录（状态 candidate / promoted / retired）及其关系（DESCENDS_FROM、GOVERNS、REQUIRES、CLAIMS、SUPERSEDES、EVIDENCED_BY、BINDS）是历史。

- **类树**（左）—— 每个 class 节点一行（名称 · 技能数），展开为其 IN_CLASS 技能（实例折叠在泛型下的 `+n` 开关后；计数仍是全部成员），每行带 kind 标记（segment ▶ / verify ✓ / decide ⑂ / perceive ◉ / plan ☰）与汇总 k/n 证据；其上是基准过滤（只留有 EVIDENCED_ON 边指向所选基准的技能）、具身过滤（`skill.bindings` 的键）和子串搜索。卡片与能力放在自己的「卡片与能力」一节；旧的封存技能放在「历史记录」一节，只在「历史」chip 打开时出现。在树里展开一个 class 会同时展开画布上它的泳道（同一份状态）。
- **分层画布**（中）—— `@xyflow/react` 画布，由 `graph.ts` 排成三个固定列，从左到右 **能力 | 卡片 | 技能**：能力纵向堆叠；卡片按提供的能力分小标题堆叠（具身 = 提供 `embodiment.*` 槽位，执行器 / 策略 = 提供其它槽位，任务 / 基准 = benchmark 与 mission 卡片，其他——benchmark 作为标题，它 COVERS 的 mission 卡片缩进排在下面，数量标在 benchmark 上）；每个 class 一条泳道（xyflow 父节点，标签形如 `grasp · 14`），按依赖顺序排列（`laneOrder`：一个 class 排在它 DEPENDS_ON（按 class 聚合）的每个 class 之下——nav → grasp → carry → …；互相依赖的一对保留较重的方向，打平不构成约束，更长的环在未满足权重最小的 class 处断开，再打平按字母序；requires = ensures 的检查类 verify / decide / perceive 排在动作类之后），折叠时只有标题，展开后（泳道箭头、树行、或选中该 class / 其成员）其泛型技能作为子节点排在里面，实例折叠在泛型下的 `+n` 徽标后。节点在固定列 x 上带间距堆叠，因此绝不重叠；每条边都是 smoothstep，从面向另一端的那一侧出发；每次变化后视口重新适配。端点被折叠的边落到代表它的节点上——实例落到泛型，成员落到泳道——平行的折叠合并为一条带计数的边（`DEPENDS_ON ×3`），所以全部折叠时就是类总览。class 级的 DEPENDS_ON 画成技能列右侧的**弧线**（不论泳道是否展开）：从依赖方泳道右侧出发，向右弯出的偏移随跨度增大，因此弧线层层嵌套而不会并成一条线，带箭头落到被依赖方，并始终标着 `×n`；悬停或选中一条泳道会高亮它的弧线并淡化其余。
  - **关系 chip** 在画布上方：依赖 DEPENDS_ON · 前置/保证（把记录里的 requires / ensures 谓词引用画成第四列的小节点，谓词 → 技能、技能 → 谓词）· 实例 INSTANCE_OF · 绑定 BOUND_TO · 使用 USES（mission 卡片 → 它使用的技能，泳道折叠时按泳道聚合为 `×n`）· 提供 PROVIDES · 挂载 MOUNTED_IN · 证据 EVIDENCED_ON · 历史（旧记录作为一条泳道，加全部旧关系）。加载时打开：依赖、实例、绑定、使用、提供、挂载，以及折叠里画得出时的证据；关闭：前置/保证、历史。COVERS（benchmark → mission 卡片）画成嵌套，从不画成边。
  - **层模式**：「能力与卡片」只画左两列、技能列为空——选中一张卡片出现「添加技能 · n」，把 BOUND_TO 它的技能（连同其 class 泳道）加到画布，旁边是「添加全部技能」和「清空」；「技能」只画泳道列；「全部」（默认）画三列。
  - **历史栈**：视图状态（选中、展开的 class、展开的泛型、模式、chip）的每次用户改动压入一条；**Esc**（页面任意处、没有输入框聚焦时）或模式控件旁的「← 返回 · n」按钮弹出一条；深度为 0 时 Esc 清除选中。
  - chip 下方的可折叠**图例**给出三层定义与边的颜色键。
- **wiki 详情**（右）—— 技能：class chip、kind、描述；契约（requires / ensures / clobbers chips）；参数 · 限制；绑定与执行器（具身 · 执行器 · 传输 · 引用 · sha8）；证据（按具身的 k/n 与 by_executor 行）；依赖（DEPENDS_ON 出边 = 依赖于，入边 = 被依赖，每条是带边 rule 的链接）；带 n/k 的基准链接；失败模式；所在卡片。class：依赖的类 / 被依赖的类（按 class 聚合的 DEPENDS_ON，`class · ×n`，每个是链接），再是技能列表带证据与覆盖的基准。基准：具身、任务、臂、所在卡片、覆盖的任务（COVERS 的 mission 卡片）链接、覆盖的技能。机箱：卡片的 manifest 字段（提供能力为能力链接、任务/campaign 绑定、覆盖层、actuation、needs_sim、第三方标记、声明）、使用的技能（USES 出边）与绑定到它的技能（BOUND_TO 入边）链接，加其余类型化链接。能力：契约、说明、提供它的卡片（PROVIDES 入边）链接，加其余反向链接。旧的封存技能保留逐字证据页。

两侧列可各自收起，宽度低于约 880px 时三列纵向堆叠。

纯消费者：图、每个状态、每个数字都逐字来自 board vault Remote；`src/client/graph.ts` 在客户端建索引（按 kind、按关系的邻接）、折叠类树并按堆叠排列各列（`layered`）——不算任何统计量（宪章：TS 只渲染）。自定义节点轮廓、泳道与标题在 `src/client/VaultGraphCanvas.tsx`；chip、模式与图例在 `VaultView.tsx`。vault 很小，因此整图一次拉取（`board.vault`）加慢速后台刷新，三列都从同一份载荷派生；不读额外的 face。

图渲染采用 `@xyflow/react`（React Flow v12，MIT），与 `ui-ph-livegraph` 相同的组件（不用 dagre：列布局是固定堆叠）。React Flow 的结构样式表 vendor 在 `src/client/xyflow-base.css`（MIT），经 `?inline` 通道注入并伴随插件整个生命周期，因为客户端打包器的 CSS 管线是包内局部的。

## 模型体验

无，因为该面板只为浏览器操作员渲染 board vault 图；agent 通过 board 的 MCP/CLI 面（`vault` / `vault_node` / `vault_neighbors`）读取同一个 vault，而不是这个面板。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 升级 `@xyflow/react` 时必须同步刷新 vendor 的 `xyflow-base.css`（打包器的 `?inline` 通道不解析 `node_modules` 说明符）；它与 `ui-ph-livegraph` vendor 的是同一份文件。
- 节点页从整图载荷派生 `out`/`backlinks` 而不调用 `vaultNode` Remote；该派生与 `board.vault.node` 逐字节一致，往返调用推迟到节点数超出单次客户端折叠为止。
- 搜索是无服务端索引的客户端子串过滤——当前规模足够，图超出一次折叠时替换。
- 卡片列的「任务 / 基准」小组取 COVERS 的目标、某个 benchmark 的卡片、或名称启发式（卡片 id 含 `mission`），等 manifest 带角色字段后替换；MOUNTED_IN 只在两端都是节点时才画（当前折叠的 MOUNTED_IN 边指向 session id，所以这个 chip 暂时画不出东西）。
