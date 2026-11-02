# Acceptance for held-out set 3, declared before any run (29 Oct 2026)

**Cases:** `fixtures/workflow-comparison-holdout-3.json`, 16 cases written blind by a separate agent (fields not used in sets 1 or 2; 7 where the notes contradict the inflated claim), frozen in this commit.

**Arms:** the app at the final commit of the bounded quality round; the capable baseline, unchanged; the one-shot request (first drafts only, `STATUS-QUO.md`).

**Hosts:** Meta (Muse Spark 1.3) and the proposed judge host, Muse Spark Open on Modal. Baseten only once its credit terms are verified. The judge host is accepted only if the corrected full journey passes there; credit balance alone selects nothing.

**The app passes a case only if all of these hold** (every attempted case counts; a failure to complete is a failure):
1. No empty, malformed or over-limit document is ever presented as ready. A document that cannot be drafted within one full redraft fails closed with a plain message.
2. Every part of the corrected contribution is accounted for in the final documents ("correction: correct" from the grader; "partial" fails).
3. Approval of a changed document is invalidated (mechanical, from the report).
4. No unsupported assertion survives in a final document.
5. Unrelated manual text survives, or is put to the applicant as a conflict (where the harness makes it visible).

**Reported for every case and arm:** completion, refusals, false refusals (a refused sentence the grader finds supported), requirement coverage, usable, latency, cost, and review load (sentences the applicant had to decide on).

**Grading:** one blind AI grader for all 16 cases per host; if a second grader is used, it grades all 16, and every disagreement and failure is kept. Human source-based adjudication is reported as such, not as blind.

**Targets, stated now:** on each host, the app's unusable count is not above the baseline's; the app's sendable-as-is count is not below the baseline's; unsupported finals are 0; at most one failure to complete per host. Results are reported in full whether or not the targets are met.
