# Agent Note：RSI 一键化——board Remote 的 submitBrief 写方法 + 只渲染板面事实的启动器/stepper

状态：implemented

[English](2026-08-28-rsi-one-click-launcher-stepper.md) | 中文

## 问题

跑一次 RSI 要手写 `{"kind":"rsi","task":...}` brief JSON、靠场外信息知道哪个 session 的 runtime 是 evolution 模式启动的、还要赌那个 runtime 活着（曾有一张 brief 在死 inbox 里躺了 21 小时无人认领）。控制台只能事后通过进行中卡的 `stage` chip 看到链条。修复必须把投递变成两次点击、让整条纪律链可见，同时不把任何判断挪进 TypeScript。

## 决定

`dsh-ph-board` 获得它唯一的写方法 `submitBrief(briefJson, session)`：两个字符串原样转发为 `storecli submit_brief --brief/--session`（主机侧在同一个 `board/brief_drop` 原子写上实现该子命令，与 `mcp_server.submit_brief` 共享实现，返回相同的 `{submitted, inbox}`）。两侧都零校验——常驻 runtime 是 brief 语义的唯一权威，坏 brief 应该在 runtime 的 `failed/` 里可见地失败，而不是被客户端揣测拦截。

演化台头部（`RsiRun.tsx`，控制台自己的 inject face）把板面事实渲染成启动器：task 下拉平铺机箱能力卡的 `contributes.task_bindings`；session 下拉只列 `runtime.boot` 会话中实时 `runtimeStatus.mode` 为 `evolution` 的，各自带 session-log mtime 年龄，超过约 10 分钟显示灰色 stale 徽章——只显示事实，绝不拦截提交（安静的 runtime 可能看着 stale 但活着；由 runtime 裁决）。返回的 `submitted` 文件名回显，并提示到下方 stepper 跟进。

七步 stepper（领块 → 标定 → 门禁 → prereg → dev → held-out → 装入）的位置来自最新 rsi `campaignProgress` 心跳的 `stage`，经一张显示映射表（`STAGE_POS`，与 `STAGE_KEYS` 同一种词汇渲染手法），并展示 done/total、三个种子块、首死分布，以及门禁 c1..c6 判据的红/绿 chip。判据优先取按 brief stem 匹配到的封存 `runtime.rsi_scheduled` 会话链行；链条运行中回退到心跳自带的 `verdict`/`failed` 字段；NO-GO 渲染为带标注的诚实结果（「诚实 NO-GO」），绝不是错误态。

## 备选方案

**客户端校验 brief（task 存在、session 新鲜）。** 否决：runtime 是唯一权威；客户端检查会分叉规则集并腐烂。

**从 `runtime_events` 读门禁载荷。** 检查后否决：`runtime.rsi_scheduled` 由 `rt.log.append` 追加——是 `read_session` 暴露的会话链行，不是 opstream 事件——所以 stepper 走现有的 `session` Remote 读它。

**对 stale session 禁止提交。** 否决：mtime 年龄是启发信号不是存活判决；徽章显示年龄，操作员自己决定。

## 后果

board Remote 不再是纯只读；`submitBrief` 是它唯一的写，两个包的 README 已如实改口。双侧契约（flag 名、输出 JSON）由本文与主机侧 storecli 测试各自钉住；经部署好的控制台做联合实测是封口的集成步骤。

## 测试

Fork 侧：`tsc -b tsconfig.client.json` + 完整 `build:lib`（host face 重新生成带新方法的 Typert remote client）；包级 oxlint（只剩既有的兄弟文件 `usePolledLoad` 发现项）。这两个包没有 vitest。对着已启动 evolution runtime 的 UI 实测刻意留给与主机侧 `submit_brief` 子命令的编排联调。
