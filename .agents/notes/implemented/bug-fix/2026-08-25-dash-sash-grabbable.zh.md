# Agent Note: 实验台 dock 分隔条在桌面指针下可抓取

Status: implemented

[English](2026-08-25-dash-sash-grabbable.md) | 中文

## 问题

实验台 dashboard（`packages/client/ui-ph-dash`）把每个会话视图排进一个 dockview 网格，网格里的分组靠拖拽组间分隔条（sash）来调整大小。内置的 dockview（`dockview.css`，来自 dockview-core v8.2.0）把每条 sash 画成 4px 宽、静止时透明（`--dv-sash-color: transparent`）、仅在悬停 0.5s 延迟后才着色，而且**只**在 `@media (pointer: coarse)` 下把指针命中区扩大到 ±10px。在实验室操作员的桌面指针下，这就留下一条 4px、不可见、反馈延迟的分隔条：操作员看得见 1px 的分隔线，却找不到也点不中抓取目标，于是下方面板看起来无法调整大小——cockpit（lab）分组与其下方标签分组之间的竖向 sash「拖不动」。让 dock 避开吸底 composer 带的预留已经单独落地（`DashView.module.css` `.stage` `padding-bottom: var(--dsh-composer-height)`），dock 填满 stage 内容盒、没有死白带；剩下的问题纯粹是精确指针下 sash 抓不住。

## 决定

`dockview-ph.css`——DashView 加在 dockview 根节点 `.dv-ph` 类上的 PH 着色层，在内置样式表之后注入——在 `.dv-ph` 作用域内新增（不触碰 dashboard 之外的任何东西）：

- **可见的静止抓手**：每条启用的 sash 上一段居中的短把手（`::after`，2×24px，`border-radius: 2px`），静止时很淡（`currentColor` 16%），悬停或拖拽时变亮（45%），在两个轴上都横跨分隔线摆放，使分隔条读起来「可拖」。
- **≥6px 的桌面命中区**：把 dockview 只给粗指针的那条放大的 `::before` 命中带，在 `@media (pointer: fine)` 下按每侧 4px 重新加上（4px sash + 8px = 12px 目标）。内置的 `@media (pointer: coarse)` ±10px 命中带原样保留，触摸仍保有更大的目标。
- **即时悬停反馈**：sash 悬停/激活着色改用 `transition-delay: 0s`，取代 dockview 的 0.5s 延迟。

内置的 `dockview.css` 仍是逐字拷贝；整套抓取形态都落在 PH 覆盖层上。

## 备选方案

**改内置的 `dockview.css`（加宽 sash、去掉 coarse 门限）。** 否决：`dockview.css` 是被 THIRD_PARTY_NOTICES 标注的固定逐字拷贝，本地改动会在每次 dockview 同步时被重新套用。PH 着色层正是为此存在——在 `.dv-ph` 上把 dockview 装饰映射到 PH 中性 token——抓取形态就该放这。

**把 sash 本身加宽到 ≥6px。** 否决：sash 宽度同时是面板之间的可见间隙；加宽它会让每条分隔条变粗、并移动网格几何。透明的 `::before` 命中带在不改变布局的前提下扩大目标，和 dockview 自己扩大触摸目标的做法一致。

**靠既有的 1px `--dv-separator-border` 线当作可拖提示。** 否决：那条线是静态分隔、没有悬停态、也和抓取目标无关；操作员本来就看得见它，却依然抓不住 4px 的 sash。会随悬停响应的抓手，才是「在这拖」的信号。

## 影响

每条组间 sash（竖向和横向）现在都显示静止抓手，并在桌面指针下的 12px 带内任意处接受拖拽；触摸行为不变。代价是每侧 4px 的命中带会盖住相邻面板边缘，因此距分组边界 4px 内的指针会触发调整大小、而不是够到那里的面板内容——这与 dockview 在触摸下做的取舍相同，且被 `.dv-ph` 作用域限定在 dashboard 内。抓手是每条分隔条中央一个始终存在的小标记。

## 测试

无头 Chromium 在 1840px 与 1280px 宽度下驱动 fork 构建（`node apps/cli/lib/bin.js web`）：打开某会话的实验台标签，dockview 根节点的底边等于 stage 内容底边（无死白带）；把竖向 sash 向上拖 150px 再拖回，右列两个分组高度随之变化、且刷新后仍保留（布局写入 `ph.dash.layout.v1`）；sash 的 `::after` 抓手与 `::before` 命中带在精确指针下解析生效。这些纯视图包没有单元测试骨架；装配后应用的无头驱动就是它们的覆盖。
