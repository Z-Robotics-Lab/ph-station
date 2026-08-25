# Agent Note: ph 实时面板的首次 board 加载不再受标签页可见性限制

Status: implemented

[English](2026-08-25-ph-surfaces-first-load-visibility.md) | 中文

## Problem

ph 实时面板——操作机架（`ui-ph-ops`）、横跨全框的状态栏与 战报/演进/机箱/账本 面板（`ui-ph-panels`、`ui-ph-battle`）、以及 执行图谱·过程流 信息流（`ui-ph-livegraph`）——都靠一个在 `document.hidden` 时暂停的轮询刷新，好让后台的控制台不空烧 board 调用。它们每一个都把*首次*加载也卡在同一个 `!document.hidden` 判断上：`usePolledLoad` 在挂载时运行 `run()`（即 `if (!document.hidden) load()`），`BattleView` 内联了同样的写法，`useLiveFeed` 的第一个 `tick()` 在隐藏时跳过 `load()`。于是一个在其标签页报告为隐藏时*挂载*的面板——处于后台或被遮挡窗口、并非当前活动标签的操作控制台——从不发出它的首次 board 读取，永远停在空的初始渲染：机架停在 模式 未知 / 技能 0，状态栏停在 无会话，信息流停在 加载中。`visibilitychange` 处理器会在“重新变为可见”的转换上恢复，但一个始终隐藏的标签页永远收不到这样的转换，因此空状态是永久的。技能库（`ui-ph-vault`）从未暴露该缺陷，因为 `VaultView` 本就无条件运行其首次加载、只对后台刷新做门控——正是这处不对称掩盖了该 bug，如今成为参照。

决定性证据：在操作员真实的远程（后台）浏览器上，控制台停在 模式 未知 / 技能 0，全程只发出过 `board/vault`；在未修改的线上构建上，把 `document.hidden` 强制为 false 并派发 `visibilitychange`，机架在一个 tick 内就到达 模式 execution / 技能 3——证明轮询只是被暂停，而非某次 board 读取失败（全程对每个端点的 server curl 都返回 `ok: true`，且网关每次都带着可用的 Connection 抵达传输层）。

## Decision

让每个 ph 轮询的首次加载无条件运行，对齐 `VaultView`：`usePolledLoad`（`ui-ph-ops` 与 `ui-ph-panels` 两个孪生副本）在挂载时改调 `load()`，而非受可见性门控的 `run()`；`BattleView` 改调 `void loadStores()`；`useLiveFeed` 的第一个 `tick()` 无视 `document.hidden` 运行 `load()`（用一个 `first` 标志），随后回到受门控的节律。只有刷新节律与 `visibilitychange` 处理器仍受门控，因此后台控制台在首帧之后仍不空烧 board 调用——门控保留了它的用途，只是不再压制首帧。`useLiveFeed` 另把其 await 的 `load()` 包进 `try/catch`，将拒绝导向 `setOnline(false)`：它的递归 `setTimeout` 只在 `await load()` 返回后才排下一次 tick，否则一次被拒的 board 读取会跳过重排、使信息流永久停摆——这正是它那些 `ok: false` 兄弟早已具备、而 2026-08-25-ph-panels-fold-remote-reject 未延伸到本 hook 的离线折叠。

## Alternatives considered

**彻底移除隐藏标签门控。** 已否决：该门控的存在，是为了让停留在后台标签的控制台不为无人观看而每次轮询都派生一个 Python storecli 子进程。只有首帧需要绕过它。

**仅靠 `visibilitychange` 处理器恢复。** 已否决：它只在 隐藏→可见 的转换上触发，而一个始终隐藏的标签（第二显示器、被遮挡的窗口）永远收不到；面板会一直空白，直到操作员恰好聚焦它——正是所报告的症状。

## Consequences

一个在隐藏时挂载的 ph 面板会立刻绘制一次数据，随后照旧按“仅可见”节律刷新。首帧的 board 读取（挂载时一小把、一次）现在无论标签是否在前台都会发出——与前台挂载本就发出的读取相同，故不新增稳态负载。四个轮询仍是近乎一致的孪生副本（刻意的“无共享模块”解耦），如今全部对齐 `VaultView` 的首次加载规则。

## Testing

组装后的 fork 构建，在操作员自己的明文 http LAN origin 上提供服务，并在标签页报告 `document.hidden` 的真实远程浏览器中驱动，加载时即到达 模式 execution / 技能 3 / session-main 并有已填充的 过程流 信息流——正是旧构建留白的那个条件。这些仅渲染的包没有单元测试脚手架；组装应用的真实浏览器驱动就是它们的覆盖，与那次兄弟折叠改动一致。
