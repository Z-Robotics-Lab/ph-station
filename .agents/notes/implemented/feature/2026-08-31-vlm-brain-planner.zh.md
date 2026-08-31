# Agent Note: 大脑把一个任务规划出来，并通过 board 派发

Status: implemented

[English](2026-08-31-vlm-brain-planner.md) | 中文

## Problem

physical-harness 驾驶舱能读证据层（board Remote），聊天 agent 也能通过 MCP 工具一次派发一个 brief，但没有任何东西能把一整个任务（mission）变成一串对着实测库挑出来的技能计划。想让机器人"stack the block"的 operator 得手动拆解、对着 vault 数字为每个技能挑 executor、逐个提交 brief、轮询它、并在某个失败时决定怎么办。runtime 启动时已经写好的 skill index（`<session>/skill_index.json`）正是这份工作的一次性规划上下文，而它此前没有被任何 GUI 面用到。

## Decision

一个新的 host Remote，`@deepseek-ai/dsh-ph-brain`（`ctx.brain`，挂在 `POST /api/brain/plan`），就是这个规划器。`plan(mission, session, priorFailuresJson)` 读 `<runsDir>/<session>/skill_index.json` 作上下文，调用一次 DeepSeek 的 OpenAI 兼容 `/chat/completions`，返回 `{steps, flags, note}`（失败时同结构带 `error`）。模型只能选 index 里存在的技能名，按实测成功率最高的记录为每个技能挑 executor，并从 scratch 种子窗口 `[420000, 439999]` 取 brief 种子，这样派发永远不会烧掉不可逆的种子账本。当某个必需技能的所有 executor 都是空记录或低成功率（place 在 `scripted` 和 `pi0.5` 上都是 `0/10`）时，规划器保留该步、把 `executor` 设为 `null` 并标记 operator，而不是绕过它——prompt 明说实测数据是诚实的、标记一个不可靠技能是正确行为而非失败。prompt 同样是拒绝而非硬编：空 mission，或需要 index 里没有任何技能提供的动作（比如 washing、folding）的 mission，返回空 steps 并把缺口写进 flags，而不是拿 pick-and-place 链去硬凑。

模型后端就是部署里已经配好的 DeepSeek 路由：API key 每次请求都经 credentials 面解析（`ctx.get('credentials')`，引用 `DEEPSEEK_API_KEY`，与 `llm-deepseek` 用的同一个引用），从不存在 config 上、不打日志；模型 id 默认用部署路由（`PH_BRAIN_MODEL` 覆盖）。插件挂在 web-app bundle 里、紧挨 board 桥接，共享 `PH_BOARD_RUNS`，缺它就自禁用，所以普通 `dsh web` 仍能启动。

GUI 是交付物：`大脑` 控制台是 `ui-ph-ops` 里的一个 `sidebar.section`。它在既有传输上跑有界循环——拆解 → `board.submitBrief` → `board.briefStatus` → 失败重规划、最多 3 次——并渲染每一步的实时状态和 operator flag。board 桥接新增 `briefStatus`（对 `storecli brief_status` 的原样转发）作为观察那一半。循环的纯核心（`planner-loop.ts`）和规划器的请求/解析那一半（`planner.ts`）都是无框架的，用一个标注过的 `skill_index.json` fixture 做单测；Remote 负责文件读取、凭据解析和那一次网络调用。

## Alternatives considered

- **复用 `llm` 能力面**（`deepseek-official` 适配器）做规划调用。否决：那个面是为流式、绑 Session 的 agent 对话建的；一次非流式 JSON completion 就是一个直接的 OpenAI 兼容 `fetch`，为它拖进整套 agent-loop 机制正是 mission 排除的"多轮 agent 框架"。
- **把派发循环放在 host 侧**，好让它在关标签页后存活。推迟：operator 在 GUI 里看，已派发的 brief 在 runtime 里照常运行，`briefStatus` 是持久的，所以重开面板重新规划能干净续上。常驻 host 循环等到有无人值守运行需求时再做。
- **把规划器加进 board 桥接。** 否决：board 的宪章是零解释的原样转发；LLM 规划器就是解释，该有自己的插件。

## Consequences

驾驶舱现在有了一个对数据诚实的任务级规划面——一个 `0/10` 技能会浮现为 operator 决策，而不是被静默改道。代价是第二个 fork-only host 插件，以及一个关标签页就停的浏览器侧循环（运行本身不停）。每次 `plan` 调用都把整份（紧凑的）skill index 重新发送、无跨调用缓存；重规划会连同累积的失败一起重发。

## Testing

`packages/host/dsh-ph-brain/tests/planner.spec.ts` 覆盖对着真实 skill-index 形状的请求拼装与容错解析（带围栏的 JSON、预算钳制、保留 null executor、不可解析/畸形 → error plan）。`packages/client/ui-ph-ops/tests/planner-loop.client.spec.ts` 覆盖循环：done 前进、null executor 直接标记不派发、`MAX_REPLANS` 后停止、无恢复计划、submit 出错。对着已启动会话与真实 DeepSeek 调用的实时 GUI 路径，是 operator 的 UI 测试。`packages/host/dsh-ph-brain/bench/` 是 plan 侧 benchmark：10 个 mission、五个类别（canonical/paraphrase/双语、partial、out-of-index、place trap、adversarial）× 5 trial，对着真实 DeepSeek 端点和已提交的 fixture，打分 schema 合法性、skill hallucination、executor 选择、不可靠技能处理、排序、拒绝率和 adversarial 抵抗，raw JSONL 与 summary 表都进 git。正是这个 benchmark 暴露并验证了上面的拒绝 hardening（空 mission 拒绝率 1/5 → 5/5）。
