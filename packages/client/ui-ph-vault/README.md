# @deepseek-ai/dsh-client-ui-ph-vault

English | [中文](README.zh.md)

技能库 (Skill Vault) — the browsable wiki over the physical-harness console's sealed knowledge. One `conversation.view` tab rendering the deterministic, typed-relation graph the board vault fold emits (`board/vault.py`), plus a wiki page per node:

- **relation graph** — a `@xyflow/react` canvas laid out through **one global dagre left→right pass**, so skill lineage (DESCENDS_FROM) reads as a horizontal chain and the kinds fall into left→right ranks by edge direction: packages and skills feed capabilities (REQUIRES: skill→capability, PROVIDES: package→capability), so capabilities settle to the right with no container needed. Each kind is a distinct SVG silhouette in its own hue so it reads apart by shape and color, not just its label: skill = a blue rounded card with a left accent bar, package = a green box with a folded (notched) corner, capability = a violet stadium pill; each carries its kind glyph (bulb / box / plug), and skill status (promoted / candidate / retired) rides a secondary chip. Handles sit on the left (target) and right (source) sides so edges leave and enter horizontally; edges are colored per relation and drawn under the nodes. A relation label appears only under the cursor or in a focused node's edge set, never as resting mid-arc text. React Flow's built-in `fitView`, `MiniMap`, and `Controls` ride along. Of the nine fold relations only five draw — GOVERNS, BINDS, EVIDENCED_BY, and MOUNTED_IN target tasks/campaigns/evidence, which are not node kinds, so they never render and are omitted from the legend and chips. **Single-click focuses a node** (highlights its incident edges, reveals their labels, dims the rest); the two seven-edge families (REQUIRES, PROVIDES) start collapsed and the operator opts them in per chip. Node positions are seeded by every node-to-node edge regardless of the chips, so opting a family in or out paints or hides edges without ever reflowing the graph. A collapsible legend keys the kind shapes/hues and the drawn relations with `rendered/total` tallies; filter chips per kind / status / relation and a client-side substring search over id/task/label sit alongside.
- **node pages** — double-click a node for its wiki page: a skill page quotes the sealed evidence **verbatim** (held-out governed vs base rate, p-value, n, the ablation ladder, dev judgement), shows its lineage (DESCENDS_FROM), governed task nodes (GOVERNS), typed backlinks (CLAIMS / EVIDENCED_BY / MOUNTED_IN), and a REQUIRES capability chip flagged red when it reaches a privileged (simulator-only) read — "won't transfer to a real robot". Package and capability pages render their contributions, claims, flags, and backlinks.

Pure consumer: the graph, every status, and every number come verbatim from the board vault Remote; the fold (`src/client/graph.ts`) filters and lays out (one global dagre left→right pass over the surviving nodes) and computes nothing (charter: TS renders only). The custom node silhouettes and the legend live in `src/client/VaultGraphCanvas.tsx`. The vault is small (single-digit stores, nine cards, nine capabilities), so it is fetched whole once with a slow background refresh and the node pages derive from that same payload client-side.

Graph rendering is `@xyflow/react` (React Flow v12, MIT) with `@dagrejs/dagre` (MIT), the same component pair as `ui-ph-livegraph`. React Flow's structural stylesheet is vendored at `src/client/xyflow-base.css` (MIT) and injected through the `?inline` channel for the plugin lifetime, because the client bundler's CSS pipeline is package-local.

## Model Experience

None, as the panel renders the board vault graph for the browser operator; the agent reads the same vault through the board MCP/CLI faces (`vault` / `vault_node` / `vault_neighbors`), not this panel.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- The vendored `xyflow-base.css` must be refreshed when `@xyflow/react` is upgraded (the bundler's `?inline` channel does not resolve `node_modules` specifiers); it is a copy of the same file `ui-ph-livegraph` vendors.
- Node pages derive `out`/`backlinks` from the whole-graph payload rather than calling the `vaultNode` Remote; the derivation is byte-identical to `board.vault.node`, and the round-trip is deferred until the node count outgrows a single client-side fold.
- Search is a client-side substring filter with no server index — sufficient at the current scale, replaced when the graph outgrows one fold.
