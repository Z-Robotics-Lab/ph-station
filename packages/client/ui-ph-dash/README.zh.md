# @deepseek-ai/dsh-client-ui-ph-dash

[English](README.md) | 中文

实验台 —— physical-harness 控制台的拖拽组合式仪表盘。一个 `conversation.view` 条目（id `dash`，order −20，最左标签页、会话默认首屏），承载一个 [dockview](https://dockview.dev) 面板网格。它复用标签条读取的同一份 `conversation.view` 账目，把每个视图经授权的 `renderSlot` 渲染出来，让对话、图谱·过程流驾驶舱、技能库、战报及其余驾驶舱面板在同一屏上停靠、分屏、缩放、并列成标签——不重写任何面板。只渲染——本包只做排布，不做任何计算。

排布按 workspace 持久化在 `localStorage`（带版本号的键；schema 漂移或损坏的存储会退回默认布局），工具栏按钮可重置。一根可拖动的分隔条为输入框保留一条带，下限是裸输入行，上限是实时测量的输入框高度。dockview 的结构样式表加 PH 色调经 `?inline` 通道注入并伴随插件整个生命周期，因为客户端打包器的 CSS 管线是包内局部的。唯一净新增运行时依赖是 `dockview-react`（MIT）。

执行图谱与过程流 ticker 通过 livegraph 的 `RunFeedProvider` 共享一个运行选择，该 provider 在 `lab` 视图内部；默认布局因此把 `lab` 停靠为驾驶舱面板，在其时间轴上选一个运行会同时驱动两半。独立的执行图谱 / 过程流面板仍可停靠，但各自自带 feed——仪表盘不能跨纯度门禁引入另一个插件的 provider。

## 模型体验

无，因为该仪表盘只排布经 `renderSlot` 渲染的既有 `conversation.view` 面板，不注册任何模型可见内容。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 布局只持久化在浏览器 `localStorage`；换浏览器或清空配置后从默认排布重新开始。
- 运行选择只在停靠的 `lab` 视图内部于图与 ticker 之间同步；独立的执行图谱 / 过程流面板各持独立 feed，因为纯度门禁禁止引入另一个插件的 provider。
