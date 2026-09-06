# Agent Note: RSI evaluation evidence and installation status

Status: implemented

English | [中文](2026-09-05-rsi-evaluation-evidence.zh.md)

## Problem

Robot improvement trials can pass more plan nodes without satisfying more of the task. A development improvement also does not establish the separate evidence needed to install a skill. A console that labels both outcomes as publication obscures these distinctions.

## Decision

The RSI round displays the backend evaluation of fixed task obligations and keeps development acceptance separate from verified installation. Missing values remain unknown. The compact series supplies objective progress directly; the client neither selects an objective nor computes a running best. Historical node rates remain available as diagnostics. Trial graph rings follow explicit acceptance, while historical publication records retain their historical label.

Diagnosis and experience are expandable backend records. Transfer displays the recorded first accepted round and budget, including censored observations, the memory cutoff, experimental condition, and backend claim limits. Additional development-seed confirmation remains a live phase and does not establish held-out installation evidence. Existing live progress, parent graph, per-seed evidence, media, and logs retain their board routes and ownership.

Transfer resource measurements also distinguish total development-epoch cost, first accepted update cost and the cost since the acceptance preceding the selected round. The last interval includes the current round even when it is accepted. Each measurement remains a backend record of six resource units; the UI performs no accumulation or monetary conversion. A null first-acceptance record means no acceptance, while null fields in a present record mean unmeasured cost. Preserving this distinction prevents missing evidence from appearing as a free improvement. The recent interval is collapsed to keep cost reporting inside the existing transfer view.

The RSI page participates in the shared theme-variable scope. Its media and analysis occupy equal columns on wide panels and stack below 860px of container width; live images have a viewport-relative height capped at 440px and use contain fitting. This prevents native-resolution imagery from pushing all analysis below the fold. Wide evidence owns local horizontal scrolling: the round graph, task heatmap, and seed matrices retain their complete content inside panel-width containers. Grid text columns can shrink and wrap identifiers, and live panes reflow with the available panel width. Giving the graph's scroll container the entire history width would instead move the whole panel when a distant round receives focus, hiding unrelated media and audit content. Browser verification covers selecting a late round at a narrow panel width while the surrounding evidence remains horizontally stationary.

The skill-author preset submits full-plan proposals through the existing inbox. It preserves original node order, calls, goals/tasks, and verification while allowing installed action skills with valid verification to be inserted. Its assembled persona snapshot pins this scope and the distinction between development acceptance and installation.

New and resumed briefs explicitly request LLM proposals. There is no rules selector or automatic fallback; rules appears only as historical authorship. Explicit inbox proposals remain a separate submission channel. Model audit status distinguishes proposed candidates, deliberate abstention, exhausted validation budgets, and model-call errors. The console shows the backend model, prompt digest, reason, and structured error, while expandable JSON preserves the sealed audit summary and hashes. This summary does not expose complete request messages or raw model responses. A failed campaign is visibly failed with its operational log open. A null after-evaluation is not retested, with no fabricated score or chart point. Focused tests cover these states and LLM-only starts/resumes; the assembled skill-author snapshot carries the same reporting rules.

The start control defaults to a continuous brief with unlimited completed cycles and bounded per-cycle resources. Finite mode retains a positive cycle cap and shared brief budget. Model stop reasons belong to the cycle; the campaign owns its overall stop reason, and backoff remains running and cancellable. Live cycle budgets can reset while cumulative brief costs continue increasing. The client renders both scopes directly, prevents duplicate starts for an open brief, and keeps missing measurements distinct from explicitly uncapped totals.

The model settings tab edits only the next Start / resume brief. Empty draft fields delegate defaults to the harness, so asynchronous discovery cannot overwrite an operator’s selection. The board owns discovery and allowed effort names; a native datalist also permits explicit model ids when discovery is unavailable. The current campaign’s recorded configuration and each round’s requested model, effort, and actual model identity remain separate evidence. Changing settings never mutates or restarts an open brief.

## Alternatives considered

**Treat publication as verification.** Rejected because development seed improvements do not run the installation battery.

**Continue optimizing the node-rate chart.** Rejected because candidate-authored graphs can change the denominator. Node outcomes remain useful diagnostic evidence but do not define the objective.

**Compute progress and transfer in the browser.** Rejected because Python owns evidence aggregation and the console must render the same decisions exposed to the agent.

## Consequences

Submit and cancel distinguish RPC failure from a successful response before updating local pending state. A failed cancellation keeps the same brief available for retry and displays the backend error.

Historical records use the active RSI renderers; they do not need unused labels or styles from the former campaign table. Skill-library records belong to `ui-ph-vault`, so this package does not retain duplicate row types.

Older campaigns retain readable historical evidence without acquiring a verification claim. Backend evaluation is required for the fixed-objective chart; missing evaluation never falls back to node rates within a new-protocol series. Focused rendering tests cover acceptance without installation, missing data, preserved media/logs, and inflated node rates that cannot move the objective chart. Localhost inspection checks the assembled console and its round-selection flow.

The first measured round renders as a point because SVG does not paint a single-point polyline. Missing measurements still produce no point. This was verified against a real RoboCasa round after 588 historical rounds.

The training plot defaults to all history, breaking the policy line at each objective/protocol boundary and marking version changes with dashed lines. Individual epochs remain selectable; single-round epochs explain why only one point is visible. A new evaluator never hides prior rounds from the default overview, and its numerical shift does not imply learning progress. Its x-axis uses actual rounds, including singleton observations; missing measurements and round gaps break the line. The policy series selects after only for explicit acceptance, and separate candidate diamonds retain unsuccessful trials without promoting them. A paired vertical mark compares each retest to its own baseline. The 20-row history table replaces the parent tree, shares detail selection with the plot, and supports keyboard navigation and live follow. Viewing older pages anchors a round so polling cannot replace its evidence. Container-sized SVG coordinates preserve readable axis text on narrow screens. Pure data tests and rendering tests cover epoch boundaries, missing data, acceptance precedence, selection, pagination and incoming rounds; localhost mock API validation covers desktop/mobile rendering without starting an experiment.

Raw per-seed verification observations are expandable beside diagnosis, preserving evaluation, blocked verifier reads, and terminal observations for both phases. Null remains unknown and false remains false. This makes a rejected actor-dependent measurement inspectable without changing the node execution matrix.

Real LLM-run inspection exposed stale task evidence during campaign switches. Session/task keys now scope campaign data, round keys scope full evidence and media, and request ownership rejects responses from abandoned selections. Loading does not show another task's graph or audit. Deferred-response tests cover equal round numbers across tasks, late full/media responses, and switching away and back before an old campaign request returns.

A selected live round refreshes its full evidence and media when its sealed row first enters the existing series poll. The prior empty read cannot suppress final audit, probe feedback, or clips. This requires no additional polling loop.

The model budget optionally exposes a batched read-call limit between newly measured probes. The console renders the recorded limit and its reset condition without deriving a remaining allowance from cumulative evidence reads. Cached results and errors do not reset it; absent historical limits remain absent. Component tests preserve explicit zero and omit missing or null limits.

Focused component tests cover omitted defaults, submitted model/effort JSON, manual ids, discovery and transport failures, late discovery, refreshes, tab persistence, and separation from recorded configuration. The host bridge test pins the fixed read-only storecli command and verbatim discovery response. Model requests and experiments are outside these tests.
