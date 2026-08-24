# Agent Note: 在无法记住“已忽略”的源上把内测声明关掉

Status: implemented

[English](2026-08-25-ph-welcome-notice-gate-remote-origin.md) | 中文

## Problem

产品级的内测声明（`内测声明`，`WelcomeNotice`）会阻塞应用，直到其确切的文案版本被确认；该确认通过 welcome 设置作用域（settings scope）持久化。在 loopback 浏览器上，作用域跟随持久的 Host 段，声明只显示一次。而在非 loopback 源上——实验室操作员的 LAN 路径 `http://172.26.112.106:3081`，一个明文 http 的不安全上下文——作用域会解析为 memory 模式，因为无法访问仅限 loopback 的设置 API。`WelcomeNoticeStore` 把 memory 模式当作一个从 `false` 起步的进程内确认，于是声明照常渲染，`acknowledge()` 只推进本进程，刷新后忽略状态即丢失：上游 DeepSeek 的 beta 声明在操作员真正使用的 LAN 源上**每次**加载都重新弹出。

## Decision

在 memory 模式作用域上，声明读作已确认：`WelcomeNoticeStore.derive` 对 `mode === 'memory'` 发布 `acknowledged: true`，于是 `WelcomeNotice` 完成其引导步骤、什么也不渲染。一个无法持久化“已忽略”的源，再也不会被一个它记不住的声明反复打扰。loopback 行为不变——持久路径仍然显示声明一次并记录确认——因此只有固定“远端重复弹出”行为的两处测试发生变化（`welcome-store.client.spec.ts` 的 memory 用例、`apply.client.spec.ts` 的远端浏览器用例，以及 `remote-welcome.e2e.ts` 驱动现在断言声明绝不阻塞远端源）。现已无用的进程内 `localAcknowledged` 字段及其 `acknowledge()` 写入被移除。

## Alternatives considered

**为 fork 彻底移除 welcome-notice 注册（机架行）。** 声明是上游的 beta 宣传，并非本实验室的，因此彻底移除有其道理。已否决，作为更大、更有风险的改动：它会连带删除或重写组件、store、文案、locale 键、两处引导单元测试、loopback 引导 e2e 及其快照，以及 scaffold 管线，并会移除在仍能持久化的 loopback 主机上那次仅有的一次性声明。memory 模式门控以最小 diff 从根本上修复了报告的 bug（LAN 源）；若实验室希望在 loopback 上也去掉声明，彻底移除仍可随后进行。

**在 memory 模式作用域上把确认持久化到 `localStorage`。** `localStorage` 在不安全上下文可用，因此声明会显示一次然后保持。已否决：它仍会在每个浏览器上显示一次上游 beta 文案，而“全新加载时无声明”正是操作员源的验收标准；对一个够不到持久存储的源直接自动确认，更简单且满足该标准。

## Consequences

LAN／不安全源永不显示内测声明；loopback 主机不变。门控以作用域的 `memory` 模式为判据——即“持久存储不可达”的确切信号——而非硬编码的源检查，因此它也覆盖未来任何无法持久化的作用域。若实验室日后希望在 loopback 上也去掉声明，那属于上面的彻底移除改动，而非本门控。

## Testing

两处 welcome 单元测试断言：memory 模式／远端浏览器作用域在加载后现在读作 `acknowledged: true`。loopback 测试（`welcome-notice.client.spec.tsx`、`apply.client.spec.ts` 的 loopback 用例，以及带快照的 loopback 引导 e2e）保持不变并仍然通过，固定了“持久路径仅一次”的行为。跨明文 http LAN 源的无头驱动断言：没有 `内测声明` 对话框挂载，且应用未被置为 inert，跨一次刷新亦然。
