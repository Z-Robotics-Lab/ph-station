# @deepseek-ai/dsh-client-ui-ph-vault

[English](README.md) | 中文

技能库（Skill Library）—— physical-harness 技能图谱的唯一浏览页，view id `vault`（EVOLUTION 组里 RSI 旁边仅有的标签页；原 `ui-ph-ops` 的技能表与 `ui-ph-panels` 的能力卡网格都并入这里）。它以三列渲染 board vault 折叠（`board/vault.py`）产出的确定性五 kind 图（skill / class / benchmark / package / capability；边 IN_CLASS、DEPENDS_ON、BOUND_TO、EVIDENCED_ON 加旧关系），三列共享一个选中：

- **类树**（左）—— 每个 class 节点一行（名称 · 技能数），展开为其 IN_CLASS 技能，每行带 kind 标记（segment ▶ / verify ✓ / decide ⑂ / perceive ◉ / plan ☰）与汇总 k/n 证据；其上是基准过滤（只留有 EVIDENCED_ON 边指向所选基准的技能）、具身过滤（`skill.bindings` 的键）和子串搜索。旧节点（封存技能、机箱、能力）放在末尾的「卡片与能力」一节，什么都不会消失。
- **wiki 图谱**（中）—— `@xyflow/react` 画布（一次全局 dagre 左→右布局、按 kind 的轮廓与色相、边按关系着色、标签只在光标下或选中节点的边上出现），画选中项的邻域：class → 自身、其技能及它们的 DEPENDS_ON / BOUND_TO / EVIDENCED_ON 邻居；库技能 → 直接邻居（派生的 DEPENDS_ON 家族很稠密，深度 2 会覆盖大半张图）；其它节点 → 深度 2 邻域；未选中 → 整图（隐藏稠密的 REQUIRES / PROVIDES 家族）。单击即选中，树与详情跟随。
- **wiki 详情**（右）—— 技能：class chip、kind、描述；契约（requires / ensures / clobbers chips）；参数 · 限制；绑定与执行器（具身 · 执行器 · 传输 · 引用 · sha8）；证据（按具身的 k/n 与 by_executor 行）；依赖（DEPENDS_ON 出边 = 依赖于，入边 = 被依赖，每条是带边 rule 的链接）；带 n/k 的基准链接；失败模式；所在卡片。class：技能列表带证据与覆盖的基准。基准：具身、任务、臂、所在卡片、覆盖的技能。机箱：卡片的 manifest 字段（提供能力、任务/campaign 绑定、覆盖层、actuation、needs_sim、第三方标记、声明）加类型化链接。旧的封存技能与能力保留逐字证据页。

两侧列可各自收起，宽度低于约 880px 时三列纵向堆叠。

纯消费者：图、每个状态、每个数字都逐字来自 board vault Remote；`src/client/graph.ts` 在客户端建索引（按 kind、按关系的邻接）、折叠类树与选中邻域并布局（一次全局 dagre 左→右布局）——不算任何统计量（宪章：TS 只渲染）。自定义节点轮廓与图例在 `src/client/VaultGraphCanvas.tsx`。vault 很小，因此整图一次拉取（`board.vault`）加慢速后台刷新，三列都从同一份载荷派生；不读额外的 face。

图渲染采用 `@xyflow/react`（React Flow v12，MIT）加 `@dagrejs/dagre`（MIT），与 `ui-ph-livegraph` 相同的组件组合。React Flow 的结构样式表 vendor 在 `src/client/xyflow-base.css`（MIT），经 `?inline` 通道注入并伴随插件整个生命周期，因为客户端打包器的 CSS 管线是包内局部的。

## 模型体验

无，因为该面板只为浏览器操作员渲染 board vault 图；agent 通过 board 的 MCP/CLI 面（`vault` / `vault_node` / `vault_neighbors`）读取同一个 vault，而不是这个面板。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 升级 `@xyflow/react` 时必须同步刷新 vendor 的 `xyflow-base.css`（打包器的 `?inline` 通道不解析 `node_modules` 说明符）；它与 `ui-ph-livegraph` vendor 的是同一份文件。
- 节点页从整图载荷派生 `out`/`backlinks` 而不调用 `vaultNode` Remote；该派生与 `board.vault.node` 逐字节一致，往返调用推迟到节点数超出单次客户端折叠为止。
- 搜索是无服务端索引的客户端子串过滤——当前规模足够，图超出一次折叠时替换。
