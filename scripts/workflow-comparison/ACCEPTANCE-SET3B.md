# Set 3B: the paired correction check, declared before any run (29 Oct 2026)

Set 3 does not exercise unrelated manual wording, and it repairs both documents only when both happen to cite the corrected fact. Set 3B is a separate, declared check of exactly those behaviours. It does not change set 3, its cases or `ACCEPTANCE-SET3.md`.

**Cases.** `fixtures/workflow-comparison-set3b.json`: 8 cases written blind by a separate agent that has not seen the app's prompts or any earlier result, in fields not used in sets 1 to 3, frozen in one commit before any run. Each case is a career changer's project where the corrected contribution is central, so both the answer and the letter are expected to rely on it. Each correction states two things the applicant did and overturns an inflated claim (for example, "I led the release" becomes "Sam led it; I tested it and wrote the deployment checks"). Each case also carries one sentence the applicant writes by hand, unrelated to the correction.

**Harness, changed before any run and tested.**
1. After the first drafts, the unrelated sentence replaces the text of the first letter segment that cites no fact the correction touches (the answer's, if the letter has none).
2. The first affected segment is also edited by hand, as in set 3, so the repair must raise a conflict and get an explicit decision.
3. Then approval, the correction, repair, approval of the exact final versions and export.
4. The capable baseline gets the same hand-edited documents and the same correction, with the same instruction set as in set 3.
5. Mechanical checks: the unrelated sentence is present character for character in the final document; no affected manual edit was replaced without an explicit decision; the approvals were invalidated and renewed; NOT SUBMITTED.

**A case passes** only if both corrected actions appear in every affected document (grader: "correct"), the unrelated sentence survives exactly, no manual edit was silently overwritten, no unsupported assertion survives, every required part is answered and the pack exports NOT SUBMITTED. Every attempted case counts; a failure to complete is a failure.

**Reported:** per case and arm, everything set 3 reports, plus how many cases had both documents citing the corrected fact, how many raised the conflict, and whether the unrelated sentence survived.

**Targets, stated now:** the app's complete, usable corrected packs are at least the baseline's; the unrelated sentence survives in every completed app run; no silent overwrite; no unsupported final. Results are reported in full whether or not the targets are met.

## Clarifications, 29 Oct 19:46Z, before any run (added, nothing above replaced)

- **Both documents means both.** A case counts as a both-document repair only if both original documents cite the corrected fact and both are repaired. A case where only one document cites it is reported as a one-document case and is not evidence of both-document repair; the target above is reported on the both-document cases separately from the rest.
- **Manual wording and approval.** The approved versions are the exact final texts. A sentence the applicant wrote or edited by hand, including wording they supply when a repair falls back to their own words, is marked as their own wording, is shown as not checked by the model, and is exported only after the applicant explicitly approves that exact final version. The rule that a document changed after its review cannot be approved applies to text the app or the model changed; it never blocks the applicant's own wording, which is approved explicitly instead.

## Correction, 29 Oct 19:47Z, before any run

This replaces, openly, the end of the first clarification above ("the target above is reported on the both-document cases separately from the rest"). The denominator for the both-document outcome is every intended paired case. A case where only one document cites or repairs the corrected fact is reported as "both-document repair not exercised" and counts as a failure of both-document acceptance, never as a pass and never left out of the denominator. If no case qualifies, both-document acceptance fails.
