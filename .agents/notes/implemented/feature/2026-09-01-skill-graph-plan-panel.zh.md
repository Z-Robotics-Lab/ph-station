# Agent Note: 技能图谱 UI 读取 harness 事实，并只经 brief 生命周期执行

Status: implemented

[English](2026-09-01-skill-graph-plan-panel.md) | 中文

## 问题

操作员希望浏览完整的技能分类树，并输入一句自然语言任务来查看会运行哪些机器人技能，但 harness 读取的 RoboCasa 统一技能图谱来自标注：一个技能存在于图里，并不说明本仓库能执行它。若让浏览器自行把图节点关联到 policy、组装计划、调用模型或启动执行，就会把业务逻辑与执行权威放进 TypeScript；若把符号链当作一次运行来展示，则会错报能力。

## 决定

harness 通过 MCP 与 CLI 两个调用面提供 `skill_library`。它返回一份受限投影，把 `unified_skill_graph.json` 生成的 IS_A 分类树与已安装的 task catalogue 合并，在每个图谱技能中嵌入 HAS_STAGE / REALIZES 事实与受限的标注证据，单独保留 DECOMPOSES_TO 组合，并区分可直接调度的 binding 与 canonical 相同的实现候选。`board.skillLibrary` Remote 转发这份记录；技能库标签页只把它筛选、选中并渲染成带连线的总体技能树或紧凑目录树，另附运行时技能目录。

另有四个 `board` Remote 方法服务规划：`planSkillTask`（读：在技能图谱与由自然语言驱动的任务绑定上检索，经 harness 的 planner 卡向 DeepSeek 要严格 JSON，用运行时自己的 `validate_plan` 校验，在服务端按 HAS_STAGE / DECOMPOSES_TO 展开，逐叶子检查 binding）、`submitSkillPlan`（唯一显式的执行入口：harness 重新核验返回的记录，然后投一张普通 task brief 或拒绝）、以及针对该句柄的 `briefStatus` / `cancelBrief`。`ui-ph-panels` 的规划标签页把仿真器选择映射到所属的运行时会话（当前 RoboCasa 对应 `session-robocasa`），并把 harness 回复呈现为从左到右的组合技能图，其中嵌套叶子链、可读参数、分类路径和 binding 状态；只有 harness 返回 `executable: true` 时才启用“执行”。呈现层不会改变 harness 判定，模型文本以文本节点渲染。

每个判定（`executable`、`planning_only`、`rejected`、`no_match`）、每个 binding 断言、每次拒绝都在主机侧计算。浏览器不持有计划逻辑、不调用模型、不接触 policy。

## 备选方案

**让 agent loop 调用 MCP 工具并渲染其对话记录。** 未采用，因为对话记录无法把链结构（阶段、分类路径、逐叶子 binding）作为稳定视图展示，操作员也没有一个受 harness 判定门控的“执行”入口。

**把预览的计划传给运行时执行。** 未采用，因为 brief 是选择器加预算，运行时是唯一的规划与校验权威；实际执行的计划是运行时从同一条指令重新推导的，面板对此有明确说明。

**通过到静态技能库的名字别名把图技能标为可执行。** 未采用，因为技能库的 binding 是任务与场景限定的（`pick` 只在 `pack_all_robocasa` 的物体清单内是 `grasp_{object}`）；别名会宣称一个并不存在的控制器。别名只是展示用的分类链接。

## 影响

操作员可以浏览每个图谱技能与每个已安装的运行时技能，查看分类关系和标注证据，预览任意 RoboCasa 标注技能的符号链，也可以在同一套 UI 中运行已绑定的任务（`pack_all_robocasa`、`basket_smoke_vlm`）。未绑定的图节点与链始终可见地标为无 binding 或仅规划。`planSkillTask` 要等待一次模型往返，面板会显示数秒的规划中状态。桥接包带有两个写方法，它们不加改动地经过 harness 既有的 brief 生命周期。

## 测试

`ui-ph-panels/tests/skill-library-view.client.spec.tsx` 钉住分类树遍历、详情证据、筛选、运行时 binding 与不可用状态。`plan-view.client.spec.tsx` 用真实的 harness 回复（仅规划、可执行、被拒绝）钉住渲染契约、“执行”门控、brief 轮询，以及模型文本绝不变成 HTML。`plan-e2e.client.spec.tsx` 用测试内启动的假 DeepSeek 服务驱动真实的 harness CLI 面并渲染回复；缺少 harness venv 或生成的图谱时跳过。harness 侧由 `physical-harness/tests/test_unified_skill_graph.py`、`test_skill_planning.py` 与 `test_planning_faces.py` 覆盖。
