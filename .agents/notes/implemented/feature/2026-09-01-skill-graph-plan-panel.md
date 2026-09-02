# Agent Note: Skill-graph UI reads harness facts and executes only through the brief lifecycle

Status: implemented

English | [中文](2026-09-01-skill-graph-plan-panel.zh.md)

## Problem

Operators want to browse the complete skill taxonomy and type a natural-language task to see which robot skills would run, but the RoboCasa unified skill graph the harness reads is annotation-derived: a skill existing in it says nothing about whether this repository can execute it. A browser that joined graph nodes to policies itself, assembled a plan, called the model, or started execution would put business logic and an execution authority in TypeScript; a view that showed a symbolic chain as a run would misreport capability.

## Decision

The harness exposes `skill_library` through its MCP and CLI faces. It returns one bounded projection that unions the generated IS_A taxonomy from `unified_skill_graph.json` with installed task catalogues, embeds HAS_STAGE / REALIZES facts and bounded annotation evidence in each graph skill, keeps DECOMPOSES_TO recipes separate, and distinguishes exact dispatch bindings from same-canonical implementation candidates. The `board.skillLibrary` Remote forwards that record, and the 技能库 tab only filters, selects, and renders it as a connected Overall Skill Tree or compact outline plus a runtime-skill catalogue.

Four other `board` Remote methods serve planning: `planSkillTask` (read: retrieval over the skill graph and instruction-driven task bindings, DeepSeek strict JSON through the harness planner card, the runtime's own `validate_plan`, server-side HAS_STAGE / DECOMPOSES_TO expansion, per-leaf binding check), `submitSkillPlan` (the one explicit execute: the harness re-verifies the returned record and drops an ordinary task brief or refuses), and `briefStatus` / `cancelBrief` for the resulting handle. The 规划 tab in `ui-ph-panels` maps its simulator selector to the owning runtime session (currently RoboCasa to `session-robocasa`) and presents the harness reply as a left-to-right composite graph with nested leaf chains, readable arguments, taxonomy paths and binding states; it enables Execute only when the harness returned `executable: true`. Presentation never changes a harness verdict, and model text is rendered as text nodes.

Every verdict (`executable`, `planning_only`, `rejected`, `no_match`), every binding claim, and every refusal is computed on the motherboard. The browser holds no plan logic, no model call, and no policy access.

## Alternatives considered

**Have the agent loop call the MCP tools and render its transcript.** Rejected because the chat transcript cannot show the chain structure (stages, taxonomy path, per-leaf binding) as a stable view, and the operator would have no Execute affordance gated by the harness verdict.

**Pass the previewed plan into the runtime for execution.** Rejected because a brief is a selector plus budgets and the runtime is the sole planning and validation authority; the executed plan is the runtime's own, re-derived from the same instruction, and the panel says so.

**Mark graph skills executable through name aliases to the static skill library.** Rejected because the library's bindings are task- and scene-scoped (`pick` is `grasp_{object}` only inside `pack_all_robocasa`'s object list); an alias would claim a controller that does not exist. Aliases are display-only taxonomy links.

## Consequences

An operator can browse every graph skill and every installed runtime skill, inspect taxonomy and annotation evidence, preview a symbolic chain for any RoboCasa annotation skill, and run a bound task (`pack_all_robocasa`, `basket_smoke_vlm`) from the same UI. Unbound graph nodes and chains stay visibly unbound or planning-only. `planSkillTask` waits on a model round trip, so the panel shows a planning state for seconds. The bridge carries two write methods that pass through the harness's existing brief lifecycle unchanged.

## Testing

`ui-ph-panels/tests/skill-library-view.client.spec.tsx` pins taxonomy traversal, detail evidence, filtering, runtime bindings, and the unavailable state. `plan-view.client.spec.tsx` pins the render contract over real harness replies (planning-only, executable, rejected), Execute gating, brief polling, and that model text never becomes HTML. `plan-e2e.client.spec.tsx` drives the real harness CLI face with a fake DeepSeek server started in the test and renders the reply; it skips without the harness venv or generated graph. The harness side is covered in `physical-harness/tests/test_unified_skill_graph.py`, `test_skill_planning.py`, and `test_planning_faces.py`.
