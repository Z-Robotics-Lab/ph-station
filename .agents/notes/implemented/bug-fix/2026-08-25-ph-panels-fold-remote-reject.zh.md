# Agent Note: ph 面板把被拒的 board 读取折叠为离线，而非永久转圈

Status: implemented

[English](2026-08-25-ph-panels-fold-remote-reject.md) | 中文

## Problem

ph 只读面板（战报/演进/机箱/账本 标签页与横跨全框的状态栏）通过注入的 `fetch*` 辅助函数访问 board Remote，其类型为 `() => Promise<RemoteResult<unknown>>`；每个视图的轮询回调 await 其中之一并按 `.ok` 分支，把失败折叠进自身的离线状态。这是对 `RemoteResult` 契约的字面解读——载体（carrier）失败以 `ok: false` 到达——但 `ClientRemoteService.invoke`（`packages/api/gateway/src/client/index.ts`）会在装配类故障（参数个数不符、参数未通过其 codec、缺少 Context binder、或没有可用的 Connection）时*抛出拒绝*，这是刻意为之，好让编程错误响亮地暴露；客户端网关测试固定了这些拒绝行为。因此一次被拒的 board 读取会从轮询回调中逃逸：`void load()` 吞掉了该拒绝，没有任何状态 setter 运行，视图便永远停在初始渲染——四个列表面板停在 加载中，状态栏停在 模式 未知 / 无会话——既不重试请求也不显示错误。一次瞬时拒绝（加载顺序间隙导致 `connection` 短暂缺失、未来的 codec 变更）就能把整条 board 状态栏变成一个静默的永久转圈。

## Decision

每个面板轮询回调——`BattleView` 中的 `loadStores`，以及 `EvolutionView`、`CardsView`、`LedgerView`、`StatusBar` 中的 `load`——都用 `try/catch` 包住其 board 读取，并把拒绝导向其 `ok: false` 分支已在使用的同一离线出口：四个列表面板用 `setError(message)`（渲染为既有的“数据面不可用”状态），状态栏用 `setOnline(false)`。任何原因导致的 board 读取拒绝现在都读作 board 不可用，绝不会是无尽的 加载中。网关对装配类故障保留其响亮的拒绝；由消费者负责折叠，与面板自身“加载失败即呈现为离线”的预期一致。

## Alternatives considered

**在 `ClientRemoteService.invoke` 内部把装配类故障折叠为 `ok: false`。** 已否决：网关刻意拒绝参数个数不符、错误的 codec 输入、或缺失的 Context，好让这些编程错误对调用方响亮暴露；`packages/api/gateway/tests/gateway.client.spec.ts` 固定了该行为，且每个 Remote 消费者都依赖它。为修复一个消费者而在全应用范围内将其静默，等于把响亮的编程错误信号换成隐藏的信号。

**在两个 inject 面处用一个共享 guard 辅助函数包住每个注入的 `board.*()`。** 已否决：它触及的调用点（十一处）多于五个轮询出口，且两个 ph 客户端包被刻意解耦、没有共享模块（`BattleView` 内联自己的轮询也出于同一原因），因此该辅助函数无论如何都会跨包重复；而每个视图的 `try/catch` 恰好落在它所保护的 加载→数据/错误 转换点上。

## Consequences

被拒的 board 读取会退化为可见的离线状态而非永久转圈，代价是两个解耦包中五段几乎相同的 `try/catch`——这与它们已重复的内联轮询保持一致。列表面板在一次失败轮询后保留其最后可用数据（数据保持已设置，仅 `error` 更新）；状态栏标记 board 离线。选中时的明细钻取读取（store/heldout）本就退化为其空状态，不受影响。

## Testing

无头 Chrome 通过明文 http 的 LAN 源（不安全上下文，即实验室操作员的路径）驱动 fork 构建：打开某会话的 战报 标签页会发出 `board/stores`（HTTP 200）并渲染真实的 campaign 行，状态栏读作 MODE execution / session-main / board online——正是折叠不得回归的正常路径。这些纯视图包没有单元测试骨架；装配后应用的无头驱动即其覆盖，而拒绝分支复用了该驱动经由 `ok: false` 已经行使的离线出口。
