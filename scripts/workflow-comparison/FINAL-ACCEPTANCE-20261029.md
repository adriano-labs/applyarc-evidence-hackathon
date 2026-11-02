# Final acceptance, declared before any run (29 Oct 2026)

This adds to `ACCEPTANCE-SET3.md`; it replaces nothing. That file, its criteria and the set 3 corpus stay exactly as frozen in e3c6734. Where the two differ, a case must meet both.

## (a) Complete against the actual form

- **What counts as a required part.** For every case, the required parts are read from that case's own form text (the question, its word limit and its requirement lines), by the blind grader, independently of the app's requirement list and of any checklist a model writes for itself.
- **Pass.** Every required part is answered in the final wording of the document the form asks it in. A missing required part fails the case even when every remaining sentence is cited and supported. "Partly answered" fails.
- **The app's own behaviour.** Against the requirement list the applicant confirmed, a document with a requirement no kept sentence covers gets one full redraft naming what is missing; if it is still missing, the document is shown as incomplete and is never presented as ready. Checked by unit tests and from the run report.

**A complete, usable corrected pack** means all of these at once: the run completed; both documents are within their limits; every required part is answered (grader); the correction is correct in every affected document (grader: "correct"; "partial" fails); no unsupported assertion (grader); unrelated manual text survives exactly, or is put to the applicant as a conflict (set 3B); the approvals were invalidated by the correction and the exact final versions were approved again; the export says NOT SUBMITTED.

**Target.** On the proposed judge runtime, the app's count of complete, usable corrected packs is at least the capable baseline's, on set 3 and on set 3B separately. Refusals, failed runs and cases graded on an unrepaired draft count as not usable. Every report states how many cases exercised each behaviour (clarification, repair in both documents, manual conflict, unrelated manual text).

## (b) Hung requests, two mocked tests before the fix

1. A model stream that sends its first event and then stops is ended within the stall limit and reported as a failure the applicant can retry; usage that may have been spent stays reserved; nothing already saved changes.
2. A transcription request that never answers is ended within its time limit with a plain message; its spend stays reserved; the notes already typed are untouched.

## (c) Checks the app enforces, never optional

1. A document whose latest review failed, or whose text changed after it was reviewed, cannot be approved or exported by any route.
2. While a question waits for the applicant, no model call is made; the screen keeps the input and edits; after the answer, the flow resumes into the corrected documents.

Each of these has a unit test that fails without its behaviour. Tests that already prove a line are named in the bounded round's commit message; missing ones are added with it.

## Clarification, 29 Oct 19:47Z, before any run (added, nothing above replaced)

Beside (c)1: "text changed after it was reviewed" means text the app or a model changed. The applicant's own wording, whether edited by hand or supplied when a repair falls back to their own words, is marked as theirs, shown as not checked by the model, and is approved explicitly by the applicant as that exact final version; it is never blocked by (c)1 and never exported without that approval. The same policy is in `ACCEPTANCE-SET3B.md`.
