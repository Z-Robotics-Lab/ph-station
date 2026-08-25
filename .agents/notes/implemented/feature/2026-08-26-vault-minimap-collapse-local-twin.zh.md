# Agent Note: 技能库 MiniMap 折叠采用本地孪生副本，而非共享抽取

Status: implemented

[English](2026-08-26-vault-minimap-collapse-local-twin.md) | 中文

## Problem

技能库（`ui-ph-vault`）的图谱画布无条件挂载 React Flow 的 MiniMap。在窄的 dockview 面板里，这块 172×116 的小地图正好压在它所概括的图上，盖住操作员想看的节点。执行图谱（`ui-ph-livegraph`）早已解决了同一个问题：操作员开关、按面持久化的偏好、以及窄面板下先行折叠的默认值。技能库缺这套机制，两个图谱面板在一个基础交互上行为不一致——而显而易见的修法会诱使人把这约 20 行机制抽成共享包，这正是本 note 所拥有的决策。

## Decision

`VaultGraphCanvas` 以带注释的 `jscpd:ignore` **本地孪生副本**镜像 livegraph 的机制：`readMiniPref`/`writeMiniPref` 把操作员的选择持久化在 `ph:phvault:minimap` 下（`ph:phlivegraph:minimap` 是兄弟键），显式开关优先于默认值；没有已存偏好时，实时面板宽度低于 `MINI_NARROW`（1000px）则折叠小地图。面板宽度搭载在画布本已运行的 refit `ResizeObserver` 上——不加第二个观察器。开关按钮用内联的 tabler map/map-off glyph 渲染，沿用 `KindGlyph` 的 vendored-inline 模式，让技能库继续不依赖 `ui-ph-icons` 叶子包。

`VaultGraphCanvas.tsx` 里的孪生注释指明 `LiveGraphView` 是镜像副本，与同文件已有的 refit 观察器孪生注释一致。

## Alternatives considered

**把机制抽成共享包（或作为工具塞进 `ui-ph-icons`）。** 已否决。ph 面板包是刻意解耦的——`DashView` 写明面板不能跨 client-bundle-purity 门导入另一插件的 provider，而此前每一处共享形状（`usePolledLoad` 孪生、refit 观察器、会话选取规则）都是带注释的 `jscpd:ignore` 孪生副本，并留有成文规则“只有第四个 ph 面板包出现才抽成共享包”（见[首载可见性 note](../bug-fix/2026-08-25-ph-surfaces-first-load-visibility.zh.md)，那次修复正是横跨这些孪生副本落地的）。新开一个共享叶子要付整套包装仪式——invariant 模块、catalog 再生成、purity 注册——只为两个面板共用的约 20 行。在第三个图谱面板需要这机制之前，先例成立。

**从 `ui-ph-icons` 导入开关 glyph。** 已否决：技能库刻意保持对 icons 叶子包零依赖——`KindGlyph` 已把 bulb/box/plug 的路径内联，并有注释说明该面板保持自足。再内联一个 glyph 是一致的；为一个图标新增一条包依赖边则不是。

**仅用 CSS 缓解（窄面板下缩小或挪位小地图）。** 已否决：操作员有时无论宽窄都想让地图消失，而 livegraph 已确立操作员熟悉的“开关＋偏好”习语。技能库单独走另一套行为，等于同一控件出现第二套词汇。

## Consequences

两个图谱面板现在行为一致，代价是多一份约 20 行的副本，且两侧文件都点名了镜像——与 refit 孪生早已背负的维护义务相同。共享抽取的重新引入条件已在上文记录：第三个 ph 图谱面板采用此机制（或按轮询器先例，总数达到第四个 ph 面板包）即足以支持开叶子包。

## Testing

技能库包的测试只钉住纯 fold；这个控件靠浏览器验证：在 scratch 组件实验室里，开关能隐藏与显示小地图、向偏好键写入 `1`/`0`，保存 `1` 后整页重载以折叠态挂载；组装后的控制台在操作员的 LAN origin 上以真实 board 数据渲染出开关，宽面板下地图默认显示。
