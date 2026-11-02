# Blind results, every loss included

Every case is synthetic: a fictional applicant's notes, a real-style form, one question to answer and one correction. Each case on each host was run through two methods:
- through the app;
- through a capable prompted assistant we built as the baseline, given the same form, requirements, question and correction.

**Who graded:**
- Two fresh-context AI grader sessions graded the anonymised packs. The graders were OpenAI Codex sessions that never saw the method key, the source code, timings, costs or earlier results.
- In sets 3 and 3B, one grader graded every set 3 case on both hosts and the other graded every set 3B case.
- In set 4, both graders graded every case.
- These are AI graders, not human testers or users. The samples are small. Hosts are reported separately and never pooled.

**What ran where:**
- Sets 3 and 3B ran at commit `3ac2b3c` (tag `eval-candidate-1`).
- Set 4 was written by an independent author and left unread until the code was frozen. It ran once, on Modal only, at `53dc9ab` (tag `eval-candidate-2`).
- Release `v1.0.0` adds fixes made after set 4; they were not re-tested blind.

**Declared before each run:**
- the pass rules: `scripts/workflow-comparison/ACCEPTANCE-SET3.md`, `ACCEPTANCE-SET3B.md`, `ACCEPTANCE-SET4.md` and `FINAL-ACCEPTANCE-20261029.md`;
- the protocol: `PROTOCOL-V5-20261029.md`;
- the cases: `fixtures/workflow-comparison-holdout-3.json` (set 3), `workflow-comparison-set3b.json` and `workflow-comparison-set4.json` (sha256 `17fa00a9774dc1b12666f1cddb56f334e254be1c114851a0cddd5f7fbf8a3562`).

## Summary

| Set (host, model) | Finished, app / assistant | Quality, app / assistant | Finished packs with an unsupported detail | Correction right | Preference, app / assistant / tie | Verdict |
|---|---|---|---|---|---|---|
| 3 (Meta API, Spark 1.3) | 12 / 16 of 16 | sendable 7 / 15 | 0 / 0 cases | both documents 3/16 / 4/16 | 1 / 8 / 7 | LOSS |
| 3 (Modal, Spark Open) | 14 / 16 of 16 | sendable 10 / 8 | 0 / 5 cases | both documents 0/16 / 3/16 | 6 / 5 / 5 | INCONCLUSIVE |
| 3B (Meta API, Spark 1.3) | 8 / 8 of 8 | sendable 1 / 3 | 1 / 0 cases | both documents 5/8 / 6/8 | 0 / 4 / 4 | LOSS |
| 3B (Modal, Spark Open) | 8 / 7 of 8 | sendable 3 / 2 | 1 / 4 cases | both documents 8/8 / 3/8 | 4 / 1 / 3 | INCONCLUSIVE |
| 4, fresh (Modal, Spark Open) | 5 / 9 of 10 | complete and supported 4 / 4 (both graders) | 1 of 5 / 4 of 9 packs | not separately reported | grader A 3 / 6 / 1; grader B 3 / 7 / 0 | NOT MET |

**Why each verdict:**
- **Set 3:** the app missed the "at most one failure to finish per host" rule, with 4 failures on Meta and 2 on Modal. On Meta it was also below the assistant on sendable packs.
- **Set 3B:** the app held the applicant's own sentence in all 16 finished runs, but it invented one location when joining two facts, on each host. The zero-unsupported target therefore failed.
- **Set 4:**
  - the app finished 5 of 10 against the "at most one failure" rule;
  - one finished pack turned one learner into a group, so the zero-unsupported target failed;
  - its machine time was longer.

## Every failure, kept in the denominators

**Sets 3 and 3B:**
- **App, set 3, Meta:**
  - shopfront: it asked a second question beyond the protocol's allowance, and drafting was safely blocked;
  - grain store: the repair needed the applicant's own wording;
  - regatta and brewery: the model's output could not be read.
- **App, set 3, Modal:** shopfront (the same second question); joinery (a timeout).
- **App, set 3B, both hosts:** one location invented when joining two facts, one case per host.
- **Assistant, set 3B, Modal:** store cleaning. It returned empty documents, so the hand edit could not be placed.

**Set 4:**
- **App, three stops from our own test harness:** retail-to-appointments, kitchen-to-quality and nursery-to-training-admin. The harness demanded one exact correction quote where the app had validly split it into two facts.
- **App, one more harness stop:** outdoor-retail-to-field-assistant, where only a final full stop differed.
- **App, hotel-to-service-desk:** a real product failure. After the applicant answered a conflict question, the old broad fact stayed confirmed beside the narrower answer, so the draft had both. The correction then needed the applicant's own wording, which the scripted journey could not supply. This is fixed in `v1.0.0`: each earlier fact now waits for the applicant's decision. It was not re-tested blind.
- **Assistant, warehouse-to-learning-support:** its pack was incomplete.
- **Not counted as wins:** the four harness stops are failures too. They are not evidence of four AI repair failures, nor of four would-be successes.

## Set 4, case by case

"Complete and supported" means the pack:
- finished;
- answered every required part of the form;
- carried the correction right in every affected document;
- kept the applicant's contribution and their own sentence;
- had no unsupported detail.

Unfinished drafts are never counted as complete. Their flags are not counted as completed-output inventions.

| Case | App | Assistant | Preferred by grader A / B |
|---|---|---|---|
| warehouse-to-learning-support | finished; unsupported (one learner became a group) | not finished (incomplete) | app / app |
| hotel-to-service-desk | not finished (repair needed the applicant's wording) | complete and supported | assistant / assistant |
| grounds-work-to-community-projects | complete and supported | finished; unsupported | tie / app |
| outdoor-retail-to-field-assistant | not finished (harness: full stop) | finished; not complete | assistant / assistant |
| workshop-to-fleet-coordination | complete and supported | complete and supported | app / assistant |
| nursery-to-training-admin | not finished (harness: split fact) | complete and supported | assistant / assistant |
| print-room-to-publishing | complete and supported | finished; unsupported | app / app |
| electrical-to-facilities | complete and supported | complete and supported | assistant / assistant |
| kitchen-to-quality | not finished (harness: split fact) | finished; unsupported | assistant / assistant |
| retail-to-appointments | not finished (harness: split fact) | finished; unsupported | assistant / assistant |

**Totals, the same under both graders:**
- complete and supported: app 4, assistant 4;
- finished packs with an unsupported detail: app 1 of 5, assistant 4 of 9;
- every form part answered: app 5, assistant 8.
- applicant-written sentence retained exactly among completed packs: app 5/5, assistant 9/9. This is preservation, not a separate correction-correctness measure.

**Differences between the two graders:**
- They disagreed on two preferences (grounds work, workshop); both answers are kept.
- Strictly sendable finished packs: grader A gave app 2, assistant 0; grader B gave app 3, assistant 2.
- The flags differ in seriousness. The app's one flag turned a single learner into a group. Most of the assistant's flags were milder: recency wording, "assigned" or "exhaustive" wording, an ungrounded same-weekend link, and generic busy-workplace wording.

**Machine time and cost, set 4:**
- Median serial machine time, finished arms: app 45.93 s, assistant 15.68 s.
- Median serial machine time, all arms: 49.74 s and 15.93 s.
- Usage-priced estimate for the whole run of 10 cases: app $1.01, assistant $0.31.
- These are harness times and price estimates, not hosted latency, human time saved or a bill.

## Limits

- AI graders, not users; small samples; the same cases across hosts within a set.
- We built the baseline ourselves. Its approvals are scripted, while the app's approvals are enforced and tied to exact versions.
- In sets 3 and 3B, the first packets left out the optional cover letter's specification. The same graders then assessed those criteria for every side, still blind to which side was which. The first grades are kept unchanged.
- The cases of sets 3, 3B and 4 have now been seen, so they can serve only as regression tests.
- The fixes after set 4 (conflict decisions, the "them" guard and the others in `v1.0.0`) were not re-tested on fresh cases.
- Sources show the applicant's account, not its truth.

To re-run a comparison, see "Run it with a model" in the README. Every arm, including failures, is kept in the report.
