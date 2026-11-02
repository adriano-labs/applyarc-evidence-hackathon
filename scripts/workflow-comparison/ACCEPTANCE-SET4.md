# Set 4: a small fresh validation on Modal, declared before any case is opened or run (2026-10-30T07:19:10Z)

Set 3 and set 3B stand as recorded (FINAL-RESULTS-RECONCILED.md at eval-candidate-1): LOSS on Meta, INCONCLUSIVE on Modal, acceptance not met. Their cases are exposed and serve only as regression tests. Nothing in this file replaces ACCEPTANCE-SET3.md, ACCEPTANCE-SET3B.md or FINAL-ACCEPTANCE-20261029.md.

**Cases.** `fixtures/workflow-comparison-set4.json`: 10 cases written by a separate fresh-context author who has not seen the source, the prompts or any earlier result. They use set 3's case structure and fields not used before, and are written honestly rather than to trick any implementation. They are frozen in one commit, with the corpus sha256 recorded, before any run. No implementation agent sees them before the source candidate is frozen.

**Protocol.** PROTOCOL-V5-20261029.md, with the set 3B hand-edit step on every case (`WORKFLOW_SET3B=1`), so manual-text survival is measured too. Host: Muse Spark Open on Modal only, the proposed judge runtime. One run per arm, at the frozen evaluation SHA (eval-candidate-2), with the corpus sha256 checked by the harness. Grading is blind, by the same independent reviewers as set 3, with method, timing and cost hidden.

**The app passes set 4 only if,** on Modal:
1. its complete, usable corrected packs are at least the baseline's;
2. no completed final contains an unsupported claim;
3. it fails to complete at most one case;
4. the hand-written sentence survives in every completed run.

**Reported** as WIN, TIE, LOSS or INCONCLUSIVE, with every failure in the denominators and everything set 3 and 3B report (required parts answered, contribution kept, both-document correction, manual text, approvals, NOT SUBMITTED, machine wait, cost), next to set 3 and 3B exactly as recorded.

**Limits, stated now:** ten cases is a small validation sample, not proof of general superiority. The graders are AI, not users. The baseline is our own capable prompted assistant. The harness times are serial and are not hosted latency.

## Clarification, 2026-10-30T07:40:33Z, before any case is opened or run (added; nothing above replaced)

The author's metadata (not the cases, which stay unread until the source freeze) says that eight cases can be answered from the supplied notes and clarification answer, and that two deliberately keep a genuine information gap. All ten count in every denominator. Criterion 3 stands as written: a case that does not reach a completed, exported pack counts as a failure to complete, so if both gap cases stay incomplete, criterion 3 is not met. For diagnosis only, each incomplete run is also reported by cause: (a) the app asked a precise question for information the case genuinely lacks and invented nothing; (b) a parse or invalid-output failure; (c) a timeout or provider error; (d) anything else. This split never turns an incomplete run into a pass.
