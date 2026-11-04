# Robustness test, 3 November 2026: before and after the fix

Scripted journeys over the app's HTTP API with real Meta models, local servers, fictional applicants. Each journey: notes, facts confirmed, one question answered, both documents drafted, one sentence rewritten by hand, both approved, a correcting note added, the correction chosen, every proposal taken, approved again, exported. Nine invariants are checked in code (`harness/run.mjs`): quotes word for word, documents within limits, every citation to a confirmed fact and every claim cited, only citing sentences changed by the correction, the hand-edited sentence byte-identical, approvals cleared and renewed, NOT SUBMITTED, no 5xx or unhandled error, no number in a sentence that its cited facts don't state.

| | First run (source `2095e52`) | Re-test after the fix (source `5d3c42a` = `2c4aff0` plus the fix commit, same harness) |
|---|---|---|
| Journeys | 22: Muse Wonder 18 (eight applicants with the correcting note as written, Ellie's sample, the same eight with a plain-phrased note, one rerun), Muse Spark Open on Modal 2, via Baseten 2 | 11: Muse Wonder 9 (the eight applicants with the note as written, and Ellie), Muse Spark Open on Modal 2 |
| Completed | 21 of 22 (one repair step cut short by the output limit; it completed on a rerun) | 11 of 11 |
| "Use this correction" offered | Ellie on all three hosts; the other applicants in 4 of 17 attempts (a note that began "Correction:" was read as new facts on every host) | 11 of 11, on both hosts |
| Invariants | every completed journey passed except one uncited pair of still-true sentences and one derived number ("a team of three" from "me + 2", via Baseten) | 98 of 99: Wonder's review refused one still-true sentence ("I wrote the containerd proxy fix.") with a wrong reason; the app held it for the applicant instead of rewriting it, and keeping it left it uncited |
| Cost per journey | Wonder $0.31–$0.60; Spark Open $0.13–$0.19 | Wonder $0.34–$0.48 (median $0.41); Modal $0.14–$0.15 |

What the fix changed (`fix: hold up on applicants' own notes`): a note that calls itself a correction still raises the conflict; the correction card is offered when the earlier quote spans several facts; a cut-short revision no longer aborts the repair; a still-true sentence keeps its citations; the number rule runs before the model review; own notes no longer inherit the sample's name; questions never name the app's buttons, and numbers, dates and measurements count as conflicts.

Limits: one scripted path per applicant, small samples, the runner answered one question per journey and kept any sentence the repair could not rewrite. The applicants and their notes are fictional (`harness/personas.mjs`). Rates here are observations, not estimates.

Files: [first run, every failure and its reproduction](FIRST-RUN.md); raw per-journey records under `runs/first/` and `runs/retest/` (every step's latency, receipts with tokens and cost, snapshots, invariants); the harness under `harness/` (run from a checkout with a local server: `node harness/run.mjs --host wonder --base http://127.0.0.1:<port> --personas ellie,priya`).
