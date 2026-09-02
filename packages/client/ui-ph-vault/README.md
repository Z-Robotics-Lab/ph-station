# @deepseek-ai/dsh-client-ui-ph-vault

English | [中文](README.zh.md)

技能库 (Skill Library) — the one browsable page over the physical-harness skill graph, view id `vault` (the sole EVOLUTION-group tab beside RSI; the former 技能 table in `ui-ph-ops` and 能力卡 grid in `ui-ph-panels` are folded in). It renders the deterministic five-kind graph the board vault fold emits (`board/vault.py`: skill / class / benchmark / package / capability; edges IN_CLASS, DEPENDS_ON, BOUND_TO, EVIDENCED_ON, INSTANCE_OF, PROVIDES, MOUNTED_IN plus the legacy relations) in three panes, one shared selection.

The three layers, and the boundary between them (also the canvas legend):

- **能力 capability** — a kernel interface slot: ten fixed names such as `embodiment.env`, `policy.driver`, `task.planner`.
- **卡片 card** (package) — a plugin directory with a manifest, the install unit; it PROVIDES capabilities and hosts executors.
- **技能 skill** — a SkillRecord: a symbolic contract (requires / ensures / clobbers) + a binding to a card's executor (BOUND_TO) + evidence.

Cross-layer relations are only PROVIDES (card → capability), MOUNTED_IN (card → embodiment card), and BOUND_TO (skill → card); within skills: DEPENDS_ON, INSTANCE_OF, IN_CLASS. The legacy `runs/*/skills` records (status candidate / promoted / retired) and their relations (DESCENDS_FROM, GOVERNS, REQUIRES, CLAIMS, SUPERSEDES, EVIDENCED_BY, BINDS) are history.

- **class tree** (left) — one row per class node (name · skill count), expandable to its IN_CLASS skills (instances nest under their generic behind a `+n` toggle; the count stays the full membership), each with its kind mark (segment ▶ / verify ✓ / decide ⑂ / perceive ◉ / plan ☰) and summed k/n evidence; above it a benchmark filter (keeps skills with an EVIDENCED_ON edge to the pick), an embodiment filter (keys of `skill.bindings`), and a substring search. Cards and capabilities sit under their own "卡片与能力" section; the legacy sealed skills under "历史记录", shown only while the 历史 chip is on. Opening a class in the tree opens its canvas swimlane (one shared state).
- **layered canvas** (center) — the `@xyflow/react` surface laid out by `graph.ts` in three fixed columns, left→right **能力 | 卡片 | 技能**: capabilities stacked; cards stacked under sub-headers by what they provide (具身 = an `embodiment.*` seam, 执行器 / 策略 = any other seam, 任务 / 基准 = benchmarks and mission cards, 其他); one swimlane (xyflow parent node, labeled `grasp · 14`) per class, header-only while collapsed, its generic skills as children once opened (lane chevron, tree row, or selecting the class / a member), instances collapsed under their generic behind a `+n` badge. Nodes stack with gaps at fixed column x, so none overlap; every edge is a smoothstep leaving the side that faces its other endpoint; the viewport refits after every change. An edge whose endpoint is collapsed folds to what stands for it — an instance to its generic, a member to its lane — and parallel folds merge into one counted edge (`DEPENDS_ON ×3`), so the all-collapsed frame is the class overview.
  - **Relation chips** above the canvas: 依赖 DEPENDS_ON · 前置/保证 (draws the records' requires / ensures predicate refs as small nodes in a fourth column, wired predicate → skill and skill → predicate) · 实例 INSTANCE_OF · 绑定 BOUND_TO · 提供 PROVIDES · 挂载 MOUNTED_IN · 证据 EVIDENCED_ON · 历史 (the legacy records as one lane plus every legacy relation). On at load: 依赖, 实例, 绑定, 提供, 挂载, and 证据 when the fold draws any; off: 前置/保证, 历史.
  - **Layer mode**: 「能力与卡片」 draws the two left columns with an empty skills column — selecting a card shows 「添加技能 · n」, which adds the skills BOUND_TO it (with their class lane), beside 「添加全部技能」 and 「清空」; 「技能」 draws the swimlane column alone; 「全部」 (default) draws all three.
  - A collapsible **legend** under the chips carries the three-layer definition and the edge color key.
- **wiki detail** (right) — skill: class chip, kind, description; 契约 (requires / ensures / clobbers chips); args · limits; 绑定与执行器 (embodiment · executor · transport · ref · sha8); 证据 (per embodiment k/n and by_executor rows); 依赖 (DEPENDS_ON out = 依赖于, in = 被依赖, each a link carrying the edge's rule); benchmark links with n/k; 失败模式; 所在卡片. Class: its skills with evidence and the benchmarks they cover. Benchmark: embodiment, tasks, arms, card, covered skills. Package: the card's manifest fields (provides as capability links, task/campaign bindings, bundles, actuation, needs_sim, third-party flags, claims), 绑定到它的技能 (BOUND_TO in) as links, plus the remaining typed links. Capability: contract, doc, 提供它的卡片 (PROVIDES in) as links, plus the remaining backlinks. Legacy sealed skills keep their evidence-verbatim pages.

The side columns collapse per pane, and below ~880px the three columns stack.

Pure consumer: the graph, every status, and every number come verbatim from the board vault Remote; `src/client/graph.ts` indexes it client-side (by kind, adjacency by relation), folds the class tree, and lays the columns out by stacking (`layered`) — it computes no statistic (charter: TS renders only). The custom node silhouettes, swimlanes, and headers live in `src/client/VaultGraphCanvas.tsx`; the chips, mode, and legend in `VaultView.tsx`. The vault is small, so it is fetched whole once (`board.vault`) with a slow background refresh and every column derives from that same payload; no extra faces are read.

Graph rendering is `@xyflow/react` (React Flow v12, MIT), the same component `ui-ph-livegraph` uses (no dagre: the column layout is a fixed stack). React Flow's structural stylesheet is vendored at `src/client/xyflow-base.css` (MIT) and injected through the `?inline` channel for the plugin lifetime, because the client bundler's CSS pipeline is package-local.

## Model Experience

None, as the panel renders the board vault graph for the browser operator; the agent reads the same vault through the board MCP/CLI faces (`vault` / `vault_node` / `vault_neighbors`), not this panel.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- The vendored `xyflow-base.css` must be refreshed when `@xyflow/react` is upgraded (the bundler's `?inline` channel does not resolve `node_modules` specifiers); it is a copy of the same file `ui-ph-livegraph` vendors.
- Node pages derive `out`/`backlinks` from the whole-graph payload rather than calling the `vaultNode` Remote; the derivation is byte-identical to `board.vault.node`, and the round-trip is deferred until the node count outgrows a single client-side fold.
- Search is a client-side substring filter with no server index — sufficient at the current scale, replaced when the graph outgrows one fold.
- The cards column's 任务 / 基准 sub-group is a name heuristic (`mission` in the card id, or a benchmark's card) until the manifest carries a role field; MOUNTED_IN draws only when both endpoints are nodes (the live fold's MOUNTED_IN edges target a session id, so the chip currently draws nothing).
