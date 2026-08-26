# Agent Note: 战役实时进度卡读心跳文件，而不是读运行时

Status: implemented

[English](2026-08-26-campaign-progress-live-card.md) | 中文

## 问题

脚本路径电池（`probe_kitchen_thaw.py` 及其 campaign 同类）按 harness 的两态铁律运行在常驻运行时之外，因此不产生 `runtime_events.jsonl`，控制台没有任何可看的实时流。一次 150 集的标定要跑约 14 分钟，期间演进面板什么都不显示；操作员只能在封存后看到 store。修复必须新增一个实时面，同时不把渲染态变成证据，也不把统计挪进 TypeScript。

## 决定

harness 主机侧写 `runs/<store>/progress.json`（临时文件 + `os.replace` 原子覆写，每完成一集写一次，异常全部吞掉——心跳挂了绝不杀电池），内容为 done/total/时间戳/label 加上 python 侧折好的滚动统计（成功数、首死直方图）。`board.store.campaign_progress` 扫描心跳并计算 `running` 标记（120 秒内新鲜且 done < total）；三个调用面（storecli、MCP、本包的 `campaignProgress` Remote）转发同一个 dict，字节等价由主机侧 `tests/test_campaign_progress.py` 钉死。`EvolutionView` 据此逐字渲染进行中卡片：TS 侧唯一的算术是进度条宽度和预计剩余——后者是对 python 提供的 `started_ts`/`updated_ts`/`done` 的纯显示换算。campaign 运行期间仅心跳读取收紧到 5s 间隔；其余时间面板保持共享的 15s 节奏；没有进行中 campaign 时卡片不渲染（不占位）。

## 备选方案

**让 campaign 走常驻运行时以复用 `runtime_events`。** 拒绝：两态铁律刻意把电池挡在运行时之外（worker 池下每集新开 kernel）；为一根进度条弯曲架构是本末倒置。

**在 TypeScript 里折叠首死直方图 / 判定 running。** 拒绝：宪章的既定红线——统计住在 `board/` Python 侧，fork 只逐字渲染（塑造 `sessionProgress` 的同一条规则）。

**为进度加推送通道（SSE/长轮询）。** 拒绝：每几秒完成一集；在既有 execFile 面上 5s 轮询对操作员不可分辨，也不引入新传输。`runtimeFrame` 的常驻 worker 先例只适用于实测 spawn 成本压住帧率的情形。

## 后果

电池结束或崩溃后，最后一份 `progress.json` 留在 store 目录里；board 将其报告为 `running: false`、卡片消失，文件本身作为无害的活状态残留躺在封存证据旁。若未来某电池的单集节奏快于 120 秒新鲜窗口的假设，常量只在一处（`board/store.py::_PROGRESS_RUNNING_S`）。

## 测试

主机侧：`tests/test_campaign_progress.py`（写入原子性 + 永不抛出、tracker 折叠、running/stale/done 三分、空 runs、三脸字节等价）；base-gate 快照同 commit 刷新。fork 侧：typecheck + build；对部署好的控制台用合成心跳做活体验证（截图归档在主机侧 `local-archive/robocasa-adapt/progress-card/`）。
