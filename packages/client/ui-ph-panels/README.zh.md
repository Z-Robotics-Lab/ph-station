# @deepseek-ai/dsh-client-ui-ph-panels

[English](README.md) | 中文

演进（RSI 监视器）、机箱、账本三个面板，加上全框架的状态栏。每个都是一个 slot 条目，通过 `board` Host Remote 读取 harness 证据层并只做渲染——没有服务、没有业务逻辑。每个数字都来自 `board.store` / `board.cards`；TS 只做格式化（pp ×100 带符号、mtime → 时长），不做任何计算。唯一的写是演化台头部的 Run RSI 提交，它把操作员的选择经 `board.submitBrief` 原样转发。

- **演化台头部：Run RSI + 链条 stepper**（RSI 总览标签页顶部）—— 一个替代手写 `{"kind":"rsi","task":...}` brief 的启动器：task 下拉来自机箱能力卡 `task_bindings` 的平铺，session 下拉只列 `runtime.boot` 会话中实时 `runtimeStatus` mode 为 `evolution` 的（各自带心跳年龄；超过约 10 分钟显示灰色「runtime 可能已失活 (stale)」徽章——只显示事实，绝不拦截提交），提交按钮把两个字符串经 `/api/board/submitBrief` 发出，零客户端校验（运行时是唯一权威；返回的 `submitted` 文件名会回显）。其下是七步链条 stepper（领块 → 标定 → 门禁 → prereg → dev → held-out → 装入），位置来自最新 rsi `campaignProgress` 心跳的 `stage`，并渲染 done/total 进度条、三个种子块、首死分布小条形图，以及门禁 c1..c6 判据的红/绿 chip（来自封存的 `runtime.rsi_scheduled` 会话行；链条运行中回退到心跳自带的 verdict 字段）；NO-GO 渲染为带标注的诚实结果，绝不是错误态。
- **演进**（`conversation.view` 标签页）—— `/api/board/stores` + `/api/board/store` 渲染每代 Δpp 条形图（dev/blind/held-out 差值、晋升事件、McNemar fixed/broken），`/api/board/rounds` 渲染 progress.md feed`/api/board/campaignProgress` 驱动顶部的进行中卡片：每个正在跑的脚本路径电池（`runs/*/progress.json` 心跳）一张，含 done/total 进度条、成功数、首死 top-3 芯片，以及由 python 提供的时间戳纯显示换算出的预计剩余；campaign 运行期间仅心跳读取收紧到 5s 轮询，没有进行中 campaign 时卡片不渲染（不占位）。
- **机箱**（`conversation.view` 标签页）—— `/api/board/cards` 卡片网格：名称、actuation、needs_sim、contribute 计数与 manifest 摘要。doctor 尚未接线（还没有 `scripts/plugin_doctor.py`），因此用一个标注 `体检: 未接入` 的槽位占位——绝不伪造。
- **账本**（`conversation.view` 标签页）—— `/api/board/ledger` seed-block 表格：范围、burn 状态、来源行。`parse_ledger` 不返回 task / holdout 字段，这些列因此缺席而不是被发明出来。
- **状态栏**（`shell.overlay` 条）—— MODE 与 boot 事实来自最新运行时会话的 `runtime.boot` 行（`/api/board/sessions` + `/api/board/session`），心跳来自会话 mtime，board 桥接可达性来自 fetch 是否成功。boot 行携带 `render` 键时还会显示取景窗开/关 chip；没有该键的行（较老的会话）不显示 chip——以存在为信号，绝不猜测。
- **任务台 chips**（输入框上方的 `conversation.input.dock` 行）—— 小型预设按钮（stack / lift_geometric 任务、最新战报），经会话输入面把可编辑的提示词模板预填进输入框草稿；它们从不提交——操作员改好 seed/参数后自己发送。

每个面板与状态栏共享一个 15s 轮询，标签页隐藏时暂停、回到可见立即重跑；轮询失败保留上一份好数据。当 board 桥接未挂载时（无 `PH_BOARD_*` 环境变量的裸 `dsh web`），每个面板报告数据面不可用。

## 模型体验

无，因为面板只渲染 board Remote 状态；任务台 chips 只预填一段可编辑的输入框草稿，只有操作员发送时它才作为普通用户消息到达模型。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 固定 15s 轮询而非 mtime 驱动的刷新；对小型 `runs/` 树足够，变大再改。
- 演进 Δpp 条形图使用固定的 40pp 满刻度参考（一个扫视线索；每根条旁边都有精确的带符号数值）。
