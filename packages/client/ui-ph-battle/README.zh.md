# @deepseek-ai/dsh-client-ui-ph-battle

[English](README.md) | 中文

战报面板：`conversation.view` slot 中的一个条目，通过 `board` Host Remote 读取 harness 证据层，只做渲染。没有服务、没有业务逻辑——每个数字都来自 `board.store`（paired gate、McNemar fixed/broken、held-out 徽标、每代 Δpp）。

它先请求 `/api/board/stores` 获取 campaign 列表，选中后再请求 `/api/board/store` + `/api/board/heldout`；列表按 15s 轮询刷新，标签页隐藏时暂停、回到可见立即重跑；轮询失败保留上一份好数据。当 board 桥接未挂载时（无 `PH_BOARD_*` 环境变量的裸 `dsh web`），面板报告数据面不可用。

## 模型体验

无，因为该面板只为浏览器操作员渲染 board Remote 状态，不触及 prompt、消息、schema、流或工具结果。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 列表用固定 15s 轮询而非 `store_mtime` 驱动的刷新；对小型 `runs/` 树足够，campaign 列表变大再改。
- 可见性暂停的轮询 effect 是 ui-ph-panels 的 `usePolledLoad` 的本地孪生（以 `jscpd:ignore` 标注）；两个 fork 面板包保持独立，不为八行代码互相耦合。若出现第三个 ph 面板包，再抽成共享包。
- 本包只含战报；演进 / 机箱 / 账本面板与状态栏在兄弟包 `@deepseek-ai/dsh-client-ui-ph-panels` 中。
