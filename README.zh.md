# physical-harness 操作台 (ph-station)

[English](README.md) | 中文

`ph-station` 是 **physical-harness** 的操作台（实验室控制台）——一个在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`，MIT）之上换标扩展的 fork。它把上游 harness 作为接口层保留，并新增了一组只读面板，将主机（motherboard）的演进证据直接呈现在对话旁边。

## 与上游的关系

- 与上游一致，采用 [MIT](LICENSE) 许可；完整保留上游署名与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
- 保留 `upstream` git remote（`deepseek-ai/deepseek-harness`），以便向前合并上游的修复与特性。
- fork 的全部新增内容都落在一个 host package、七个 client package 以及控制台品牌里：
  - `packages/host/dsh-ph-board` —— 只读的 `board` Host Remote，把面板桥接到主机的证据层。
  - `packages/client/ui-ph-battle` —— 战报面板。
  - `packages/client/ui-ph-panels` —— 演进 / 机箱 / 账本 面板、任务台 chips 以及状态栏。
  - `packages/client/ui-ph-ops` —— 指挥员侧栏与 graph-first 任务驾驶舱。
  - `packages/client/ui-ph-livegraph` —— 执行图 实时执行图面板。
  - `packages/client/ui-ph-vault` —— 技能库 Skill Vault wiki 面板。
  - `packages/client/ui-ph-dash` —— 实验台 dockview 仪表盘，把其余面板停靠在同一屏。
  - `packages/client/ui-ph-icons` —— 共享的驾驶舱图标集，vendored 的 tabler-icons MIT 子集。
  - **品牌** —— `packages/client/ui-brand-official` 中的 `physical-harness` 字标与 `PH` 徽标。

<a id="run"></a>

## 运行

本实验室中，控制台**不单独启动**。它由主机的 cockpit 脚本拉起：该脚本会构建本 fork、注入 `PH_BOARD_*` 路径，并在 `http://127.0.0.1:3080` 提供 Web UI：

```sh
/home/yusenzlabpc/Desktop/physical-harness/scripts/cockpit
```

<a id="run-from-source"></a>

## 开发

```sh
pnpm install     # install workspace dependencies
pnpm run build   # tsc emits lib/types, tsdown bundles the runtime
pnpm run dev:web # watch-mode Web UI for panel development
```

仓库约定见 [AGENTS.md](AGENTS.md)。

## 面板

所有面板都是对话旁的只读操作面；每个数字都来自 `board` Remote（`board.store` / `board.cards`），由它读取主机证据层。TypeScript 只做格式化，不做任何计算。

- **任务台** —— 输入框上方的预设 chips，用于预填一段可编辑的任务提示词（永不自动发送）。
- **战报** —— 单次 campaign 的战报：paired gate、McNemar fixed/broken、held-out 徽标、每代 Δpp。
- **演进** —— RSI 监视器：每代 Δpp 条形图，以及进度 feed。
- **机箱** —— 从 plugin manifest 读取的机箱卡片网格。
- **账本** —— seed-block 账本表格。
- **状态栏** —— MODE、boot 事实、心跳、board 可达性，以及取景窗（render）chip。

## 许可证

[MIT](LICENSE)。第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
