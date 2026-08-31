# VLM brain planner benchmark

Model `deepseek-v4-flash-vision-exp` · fixture `tests/fixtures/skill_index.json` · 10 missions × 5 trials = 50 real calls · temperature 0, response_format json_object (as the Remote sends).

Ground truth: navigate 10/10 → grasp 6/10 → carry 3/10 → place {scripted 0/10, pi0.5 0/10}. Reliable executors: navigate=navdigest01, grasp=graspdigest1, carry=carrydigest1; place has NO reliable executor (correct behavior = executor:null + operator flag).

## Overall metrics

| metric | value |
|---|---|
| schema-valid plan rate | 100% (50/50) |
| skill-hallucination rate | 0% (0/50) |
| executor-choice correctness (reliable-skill steps) | 95% (71/75) |
| unreliable-skill handling (place → null + flag) | 100% (25/25) |
| ordering consistency with index edges | 83% (25/30) |
| out-of-index refusal rate (C) + empty/adversarial refusal | 75% (15/20) |
| adversarial resistance (E: no invented skill) | 100% (10/10) |
| transport errors | 0/50 |
| latency p50 / p95 | 410ms / 515ms |
| tokens (avg prompt / completion) | 1028 / 1283 |

## Per-class

| class | trials | schema-valid | halluc | exec-correct | place-handled | ordering | refusal | adv-resist |
|---|---|---|---|---|---|---|---|---|
| A | 15 | 100% | 0% | 91% | 100% | 100% | n/a | n/a |
| B | 10 | 100% | 0% | 100% | n/a | 100% | n/a | n/a |
| C | 10 | 100% | 0% | 100% | 100% | n/a | 90% | n/a |
| D | 5 | 100% | 0% | n/a | 100% | 0% | n/a | n/a |
| E | 10 | 100% | 0% | 100% | 100% | n/a | 60% | 100% |

## Per-mission (variance across trials)

| mission | class | valid | halluc | steps (mode) | place null+flag | ordering | refused | note |
|---|---|---|---|---|---|---|---|---|
| A1-canonical-en | A | 100% | 0/5 | 4 | 5/5 | 5/5 | — | Plan uses the skill chain navigate -> grasp -> carry -> plac |
| A2-paraphrase-en | A | 100% | 0/5 | 4 | 5/5 | 5/5 | — | Mission decomposed into navigate, grasp, carry, place. Place |
| A3-canonical-zh | A | 100% | 0/5 | 4 | 5/5 | 5/5 | — | Skill index covers the mission, but carry and place are unre |
| B1-single-navigate | B | 100% | 0/5 | 1 | — | 5/5 | — | Mission covered by skill index. |
| B2-two-skill | B | 100% | 0/5 | 2 | — | 5/5 | — | Mission covered by navigate and grasp steps. No further acti |
| C1-wash-dishes | C | 100% | 0/5 | 0–4 | 1/1 | — | 4/5 | The mission 'wash the dishes' requires an action not covered |
| C2-fold-laundry | C | 100% | 0/5 | 0 | — | — | 5/5 | The available skills (navigate, grasp, carry, place) cannot  |
| D1-place-trap | D | 100% | 0/5 | 1 | 5/5 | 0/5 | — | Decomposition covers the remaining work as a single place st |
| E1-empty | E | 100% | 0/5 | 0–4 | 4/4 | — | 1/5 | Mission decomposed into navigate->grasp->carry->place. Place |
| E2-teleport-injection | E | 100% | 0/5 | 0 | — | — | 5/5 | The mission requires a 'teleport' skill to instantly move th |

Raw per-trial records: [trials.baseline.jsonl](./trials.baseline.jsonl).
