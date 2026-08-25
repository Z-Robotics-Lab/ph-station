# @deepseek-ai/dsh-client-ui-ph-vault

[English](README.md) | 中文

技能库（Skill Vault）—— physical-harness 控制台封存知识之上的可浏览 wiki。一个 `conversation.view` 标签页，渲染 board vault 折叠（`board/vault.py`）产出的确定性类型化关系图，外加每个节点一页 wiki：

- **关系图** —— 一块 `@xyflow/react` 画布，经**一次全局 dagre 左→右布局**：技能谱系（DESCENDS_FROM）读作水平链，各 kind 依边方向落入左→右的层级——package 与 skill 供给 capability（REQUIRES: skill→capability，PROVIDES: package→capability），capability 因此无需容器就沉到右侧。每个 kind 是独立色相下的独立 SVG 轮廓，靠形状与颜色即可分辨而不只靠标签：skill = 带左侧强调条的蓝色圆角卡片，package = 折角（缺口）的绿色方盒，capability = 紫色体育场药丸；各自携带 kind 图标（灯泡 / 盒子 / 插头），skill 状态（promoted / candidate / retired）以次级 chip 附随。Handle 位于左（target）右（source）两侧，边水平进出；边按关系着色并绘制在节点之下。关系标签只在光标下或聚焦节点的边集里出现，从不作为静置的弧中文本。React Flow 内置的 `fitView`、`MiniMap`、`Controls` 一并可用。九种折叠关系中只有五种绘制——GOVERNS、BINDS、EVIDENCED_BY、MOUNTED_IN 指向任务/campaign/证据，它们不是节点 kind，因此从不渲染，也从图例与 chips 中省略。**单击聚焦一个节点**（高亮其关联边、显示其标签、压暗其余）；两个七边家族（REQUIRES、PROVIDES）默认折叠，操作员按 chip 逐个开启。节点位置由所有节点间边播种，与 chips 无关，因此开关某个家族只是画上或藏起边，绝不重排整张图。可折叠图例标注 kind 的形状/色相与已绘关系的 `rendered/total` 计数；按 kind / 状态 / 关系过滤的 chips 和一个对 id/task/label 的客户端子串搜索并列其旁。
- **节点页** —— 双击节点进入其 wiki 页：skill 页**逐字**引用封存证据（held-out governed 与基线率、p 值、n、消融阶梯、dev 判定），展示其谱系（DESCENDS_FROM）、治理的任务节点（GOVERNS）、类型化反链（CLAIMS / EVIDENCED_BY / MOUNTED_IN），以及一个 REQUIRES capability chip——当它触及特权（仅仿真）读取时标红：「无法迁移到真实机器人」。package 与 capability 页渲染各自的贡献、claims、flags 与反链。

纯消费者：图、每个状态、每个数字都逐字来自 board vault Remote；折叠层（`src/client/graph.ts`）只做过滤与布局（对幸存节点做一次全局 dagre 左→右布局），不做任何计算（宪章：TS 只渲染）。自定义节点轮廓与图例在 `src/client/VaultGraphCanvas.tsx`。vault 很小（个位数 store、九张卡、九个 capability），因此整图一次拉取加慢速后台刷新，节点页从同一份载荷客户端派生。

图渲染采用 `@xyflow/react`（React Flow v12，MIT）加 `@dagrejs/dagre`（MIT），与 `ui-ph-livegraph` 相同的组件组合。React Flow 的结构样式表 vendor 在 `src/client/xyflow-base.css`（MIT），经 `?inline` 通道注入并伴随插件整个生命周期，因为客户端打包器的 CSS 管线是包内局部的。

## 模型体验

无，因为该面板只为浏览器操作员渲染 board vault 图；agent 通过 board 的 MCP/CLI 面（`vault` / `vault_node` / `vault_neighbors`）读取同一个 vault，而不是这个面板。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 升级 `@xyflow/react` 时必须同步刷新 vendor 的 `xyflow-base.css`（打包器的 `?inline` 通道不解析 `node_modules` 说明符）；它与 `ui-ph-livegraph` vendor 的是同一份文件。
- 节点页从整图载荷派生 `out`/`backlinks` 而不调用 `vaultNode` Remote；该派生与 `board.vault.node` 逐字节一致，往返调用推迟到节点数超出单次客户端折叠为止。
- 搜索是无服务端索引的客户端子串过滤——当前规模足够，图超出一次折叠时替换。
