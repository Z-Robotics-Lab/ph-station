# @deepseek-ai/dsh-client-ui-ph-vault

English | [中文](README.zh.md)

技能库 (Skill Library) — the one browsable page over the physical-harness skill graph, view id `vault` (the sole EVOLUTION-group tab beside RSI; the former 技能 table in `ui-ph-ops` and 能力卡 grid in `ui-ph-panels` are folded in). It renders the deterministic five-kind graph the board vault fold emits (`board/vault.py`: skill / class / benchmark / package / capability; edges IN_CLASS, DEPENDS_ON, BOUND_TO, EVIDENCED_ON plus the legacy relations) in three columns, one shared selection:

- **class tree** (left) — one row per class node (name · skill count), expandable to its IN_CLASS skills, each with its kind mark (segment ▶ / verify ✓ / decide ⑂ / perceive ◉ / plan ☰) and summed k/n evidence; above it a benchmark filter (keeps skills with an EVIDENCED_ON edge to the pick), an embodiment filter (keys of `skill.bindings`), and a substring search. Legacy nodes (sealed skills, cards, capabilities) sit under one trailing "卡片与能力" section so nothing disappears.
- **wiki graph** (center) — the `@xyflow/react` canvas (one global dagre left→right pass, per-kind silhouettes and hues, edges colored per relation, labels under the cursor or on the selection's edges) drawing the selection's neighborhood: a class → itself, its skills, and their DEPENDS_ON / BOUND_TO / EVIDENCED_ON neighbors; a library skill → its direct neighbors (the derived DEPENDS_ON family is dense; depth 2 would reach most of the fold); any other node → its depth-2 neighborhood; no selection → the whole fold with the dense REQUIRES / PROVIDES families hidden. A single click selects; the tree and detail follow.
- **wiki detail** (right) — skill: class chip, kind, description; 契约 (requires / ensures / clobbers chips); args · limits; 绑定与执行器 (embodiment · executor · transport · ref · sha8); 证据 (per embodiment k/n and by_executor rows); 依赖 (DEPENDS_ON out = 依赖于, in = 被依赖, each a link carrying the edge's rule); benchmark links with n/k; 失败模式; 所在卡片. Class: its skills with evidence and the benchmarks they cover. Benchmark: embodiment, tasks, arms, card, covered skills. Package: the card's manifest fields (provides, task/campaign bindings, bundles, actuation, needs_sim, third-party flags, claims) plus typed links. Legacy sealed skills and capabilities keep their evidence-verbatim pages.

The side columns collapse per pane, and below ~880px the three columns stack.

Pure consumer: the graph, every status, and every number come verbatim from the board vault Remote; `src/client/graph.ts` indexes it client-side (by kind, adjacency by relation), folds the class tree and the selection's neighborhood, and lays out (one global dagre left→right pass) — it computes no statistic (charter: TS renders only). The custom node silhouettes and the legend live in `src/client/VaultGraphCanvas.tsx`. The vault is small, so it is fetched whole once (`board.vault`) with a slow background refresh and every column derives from that same payload; no extra faces are read.

Graph rendering is `@xyflow/react` (React Flow v12, MIT) with `@dagrejs/dagre` (MIT), the same component pair as `ui-ph-livegraph`. React Flow's structural stylesheet is vendored at `src/client/xyflow-base.css` (MIT) and injected through the `?inline` channel for the plugin lifetime, because the client bundler's CSS pipeline is package-local.

## Model Experience

None, as the panel renders the board vault graph for the browser operator; the agent reads the same vault through the board MCP/CLI faces (`vault` / `vault_node` / `vault_neighbors`), not this panel.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- The vendored `xyflow-base.css` must be refreshed when `@xyflow/react` is upgraded (the bundler's `?inline` channel does not resolve `node_modules` specifiers); it is a copy of the same file `ui-ph-livegraph` vendors.
- Node pages derive `out`/`backlinks` from the whole-graph payload rather than calling the `vaultNode` Remote; the derivation is byte-identical to `board.vault.node`, and the round-trip is deferred until the node count outgrows a single client-side fold.
- Search is a client-side substring filter with no server index — sufficient at the current scale, replaced when the graph outgrows one fold.
