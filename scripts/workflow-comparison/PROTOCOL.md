# Paired workflow diagnostics, version 3 (and 4)

These twelve cases have already been inspected and run. They are **seen diagnostics, not a holdout**. This version corrects known setup and instruction asymmetries. Keep every v1/v2 result; do not replace an earlier failure with a favorable later output.

## Equal task, independent methods

Both arms receive the same notes, pasted question, form requirements and fixed clarification packet. The assistant receives `documentSpecs` from the same `prepareOwnApplication` function the app uses. The optional letter asks for motivation and relevant experience; neither arm gets an extra requirement to repeat a particular contribution in it.

The app runs its real HTTP flow and normal model/review logic. The baseline runs directly through the common transport with its own careful instructions. Model and explicit effort, per-arm ceilings, ledger and serial provider scheduling are shared. Order alternates between pairs. This measures serial machine elapsed time, not applicant time or the app's fastest concurrent latency.

The fixed clarification packet is provided even when an arm asks no question. That is labelled volunteered information. The packet equalises available information; it does not prove that a useful question was asked.

## Correction scope

The app correction fact must still be uniquely identified by its exact source quote. No fuzzy matching or fact insertion is permitted. Baseline dependencies use exact evidence-quote references to the same source. These are mechanical citation checks; an independent semantic review must catch uncited, misstated or missing propositions.

Every segment citing that fact is affected. Multiple dependencies are permitted. A document with no dependency remains unaffected and must retain its original text. A missing contribution is never inserted just to manufacture a cross-document test.

The first affected segment in answer-then-letter order gets the non-factual prefix `For clarity:`. Repair must reopen this manual edit for an explicit decision. All other unaffected original segments are compared by document, stable segment id and exact wording. No semantic matching conceals a changed or removed segment.

If no original document cites the fact, the repair/model call and conflict test are unexercised. The app can update its confirmed evidence and export unchanged documents; the baseline retains its documents. This is not a successful repair test and does not establish that the original answer was complete.

## Separate measurements

- **Original completeness:** ungraded worksheet containing the original texts and actual per-document requirements. Confirmed evidence coverage alone does not prove the draft answered those requirements.
- **Technical workflow completion:** whether the bounded route reached its export. This is not semantic correctness or product usefulness.
- **Dependency scope:** unknown/not reached, no document affected, one affected, or both affected. Reports retain counts for every arm, including all failures and unexercised cases.
- **Repair evidence:** proposals, explicit decisions, final texts and original dependency ids. Cross-document repair is exercised only when both original documents were affected and repair was attempted. Do not generalise that conditional subset to all cases.
- **Lexical checks:** correction markers, obsolete phrases, word limits and exact untouched wording. Markers are not semantic truth; a correct paraphrase can miss them and an incorrect sentence can contain them.
- **Semantic review:** separate review of actor, action, negation, uncertainty, scope, quantities, completeness and unsupported claims. Identify whether its reviewer was human or another model. Keep method/time/cost out of the initial blinded view.
- **Cost and machine time:** retain known usage and unknown reservations, failures and all elapsed time. Human effort and hiring benefit are not measured.

## Historical controls that are inactive

The unchanged corpus retains the old `manual.source`, `manual.replacement` and legacy unconditional both-document expectations for provenance. Version 3 labels them as legacy expectations. They do not define active completeness or repair scope. The compound-motivation replacement was retired because legitimate atomic extraction split its evidence across separately cited segments. The app's edit operation cannot manufacture a union of those citations; the harness must not do that for it.

Unrelated manual-wording preservation remains **NOT TESTED**. Version 3 tests the affected manual-edit decision and preservation of untouched original segments.

## Remaining limits

Exact citation lookup can fail on a valid alternate extraction shape; report that as a controlled setup issue and inspect the prose. A provider refusal can be recorded as an output-parsing failure; inspect the retained response rather than calling it fabrication. Some rejected app repair wording may be absent from domain output, so this harness does not enumerate every internally attempted false statement.

These diagnostics do not establish a general win over assistants or competitors. A fair fresh evaluation needs new independently reviewed cases and actual participant timing if the claim concerns time saved.

## Running

`node scripts/compare-workflow.mjs` prints an offline manifest and makes no calls. Live execution requires `--run-live`, the exact reviewed corpus hash, explicit provider/model configuration, a new output directory, one shared ledger, a global cap, an arm cap and a fixed effort. Existing output paths are refused. Do not run inference concurrently outside that ledger/process while collecting paired results.

## Version 4: one predeclared answer after the packet (29 Oct)

In v3 the app finished 7 of 12 cases. All five that stopped did so on their own honest question after the packet contradicted the notes (practice or real, fictional or live, estimated or measured, designed or built), and nobody answered it. v4 keeps every v3 rule and adds one step, offered equally:

- After the fixed packet, each arm gets one chance to ask about a conflict: the app through its own open question, the baseline through one reconcile step.
- An arm that asks gets the same answer: the case's correction text, already frozen in the corpus before any run. Nothing was written after seeing v3.
- An arm that does not ask gets nothing more.
- When the app never confirmed the inflated packet claim, its correction and repair are recorded as caught before drafting and unexercised. That is reported, not counted as a repair success.

Run it with `WORKFLOW_PROTOCOL=v4` and the usual live options. v3 runs stay as they were. These are still seen diagnostic cases, not a holdout.
