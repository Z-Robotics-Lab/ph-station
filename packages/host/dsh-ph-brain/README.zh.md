# @deepseek-ai/dsh-ph-brain

[English](README.md) | 中文

physical-harness fork 大脑：一个 Typert Remote（`brain`），把一个任务（mission）拆解成一串取自 harness skill index 的技能，并按实测成功率为每个技能挑选 executor。gateway 把它唯一的方法自动挂在 `POST /api/brain/plan`；驾驶舱的大脑面板调用它，并把产出的计划通过 `ctx.board`（`submitBrief` → `briefStatus`）派发——harness 对外只有这一道执行门。本包只做规划，从不自己派发。

会话启动时，runtime 引导会把 skill index 写到 `<runsDir>/<session>/skill_index.json`（`scripts/harness_runtime.py`、`harness.skill_record.skill_index`）。`plan(mission, session, priorFailuresJson)` 读这一个文件作为上下文，拼出请求（skill index + mission + brief 语法 + 之前的失败），调用一次 DeepSeek 的 OpenAI 兼容 `/chat/completions`，返回解析后的 `{steps, flags, note}`（失败时同样的结构带一个 `error` 键）。API key 每次请求都通过 credentials 面解析（`ctx.get('credentials')`，引用 `DEEPSEEK_API_KEY`）；它从不存在 config 上、不回显进结果、也不打日志。

规划规则对实测数据是诚实的。每个技能下的每条记录带 `measured.successes` / `measured.n` 和一个 `binding`；规划器挑成功率最高的那条，把 `executor` 设成它的 digest。当某个必需技能的所有 executor 都是 `n=0` 或成功率很低（现在 place 在 `scripted` 和 `pi0.5` 上都是 `0/10`），规划器**不**绕过它：保留该步、把 `executor` 设为 `null`，并加一条 operator flag。标记一个不可靠的技能是正确行为，不是路由失败。规划器只能选 index 里存在的技能名，且从 scratch 种子窗口 `[420000, 439999]` 取 brief 种子，这样派发永远不会烧掉不可逆的种子账本。

纯粹的请求拼装与回复解析在 `src/planner.ts`（在 `tests/` 里用一个标注过的 `skill_index.json` fixture 做单测）；Remote 在 `src/index.ts`，负责文件读取、凭据解析和网络调用。

## 配置

- `runsDir` —— 存放 `<session>/skill_index.json` 的 campaign `runs/` 目录（必填；驾驶舱注入 `PH_BOARD_RUNS`）。
- `model` —— chat-completions 模型 id（必填；驾驶舱默认用部署的 DeepSeek 路由，可用 `PH_BRAIN_MODEL` 覆盖）。
- `apiKeyEnv` —— 每次请求解析的凭据引用（默认 `DEEPSEEK_API_KEY`）。
- `baseURL` —— endpoint 基址（默认 `https://api.deepseek.com`；请求时 `$DEEPSEEK_BASE_URL` 覆盖）。
- `timeoutMs` —— 单请求超时（默认 60000）。

驾驶舱的 bundle 行在缺少 `PH_BOARD_RUNS` 时禁用本插件，所以普通 `dsh web` 仍能启动（面板此时报告大脑不可用）。

## Model Experience

每次 `plan` 调用一次非流式 chat-completions 请求。system prompt 固定拆解规则和 brief 语法；user 消息带 skill index JSON、mission 和之前的失败。`response_format` 是 `json_object`、`temperature` 是 0，所以回复是一个 JSON 对象、解析成一个计划。没有 session、没有 tools、没有多轮循环——有界的重规划循环在驾驶舱面板里，基于本方法加 board。

#### KV Cache effect

每次调用都把整份 skill index 和 mission 重新发送，没有跨调用缓存；重规划会连同累积的失败一起重发 index。index 按设计是紧凑的（不带证据 blob），能装进一个上下文窗口。

## Known Limitations and Deferred Work

- 有界派发循环（submit → watch → replan，上限 3）跑在浏览器面板（`ui-ph-ops`）里，不在这里，所以关掉标签页它就停；但已派发的 brief 在 runtime 里照常运行，`briefStatus` 是持久的，所以重开面板重新规划能干净地续上。常驻的 host 侧循环推迟到有无人值守运行需求时再做。
- 规划器信任模型只选 index 里的技能名；一个杜撰的名字会被当作 task brief 派发、在 runtime 里硬失败，而不是在这里被拒（harness 仍是"brief 意味着什么"的唯一权威）。
