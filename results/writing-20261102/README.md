# Writing checks — 2 November 2026

These small synthetic comparisons measured prepared-state composition of a project answer and cover letter. They did not measure onboarding, human effort, hiring outcomes or customer use. **They did not demonstrate an app writing-quality or speed advantage over a capable assistant using the same Muse Wonder model.** Earlier [correction/clarification results](../wonder-20261102/comparison.md) and [Spark results](../BLIND-RESULTS.md) remain separate and unchanged.

## Six fresh pairs: corrected presentation

The app used frozen source `1c81e04`; it and a capable same-Wonder assistant received the prepared candidate evidence and document requirements. Each produced both documents. Twelve arms completed in the amended run. Grading used anonymous paired output; the first presentation flattened paragraph structure, so its writing preference result was superseded by regrading the **same outputs** with their actual paragraphs. This was a presentation correction, not a new model run or selection of better output.

The corrected presentation grade found **four assistant wins, two ties and no app wins**. All 12 packs were judged usable and met their word caps. One app letter (WF05) omitted the role and company. The earlier paragraph-flattened grade is retained in the development record; it is not used as the final preference result.

| Machine measure, amended run | App | Same-Wonder assistant |
|---|---:|---:|
| Completed arms | 6/6 | 6/6 |
| Provider requests | 59 | 22 |
| Median elapsed composition time | 33.052 s | 12.271 s |
| Range | 32.544–86.041 s | 8.878–14.088 s |

The amended run's token-priced estimate was **$1.846469**. The original harness incorrectly required an explicit request-body `model` field: four assistant arms completed, four app arms failed that harness check and four arms were not attempted. Those outcomes and their **15 requests / $0.286919** remain counted. Including that aborted run, the experiment used **96 requests / $2.133388** estimated usage; conservative cumulative reservation was **$29.590408 of the $30 cap**. The amended comparison does not erase the harness failures or their cost. A local harness audit also printed some assistant prose to the case author. No case or output content reached the implementation writer/root, no prompts, cases or product code were tuned, and a different independent grader assessed the outputs. The case author did not grade them.

## Final four fresh pairs: optional letter policy rejected

Four new synthetic cases were sealed before the candidate was frozen. The candidate was `20f54121a0cbb4ef10796eb08970d74e32d9eda4`, with the optional concise-letter selection prompt. The app and assistant used **Muse Wonder 1.0 at medium effort**, the same supplied evidence and form requirements, counterbalanced paired order, one attempt per provider request and no external rerolls. The app text in the grading packet retained its actual segment/paragraph presentation. This was not a repeat of the preceding six cases.

One independent blind AI grader preferred the assistant in **all four pairs: three slight preferences and one clear preference**. All eight packs were usable; the grader found no material unsupported claim. All word caps were respected and all letters named the exact role and company. This is one grader's scoped judgment, not a factual guarantee or human preference study.

| Machine measure | App | Same-Wonder assistant |
|---|---:|---:|
| Completed arms | 4/4 | 4/4 |
| Failed arms | 0 | 0 |
| Provider requests | 23 | 13 |
| Median elapsed composition time | 16.485 s | 9.208 s |
| Range | 11.380–21.970 s | 7.777–13.621 s |

All **36 provider requests** are counted. Total token-priced usage was **$0.707878**; conservative reservation was **$10.012640 of the $20 cap**, with zero active reservations at completion. No failure was rerun or excluded. Costs are estimates from token receipts, not invoices. Machine times exclude human reading, editing and approval; the app was slower in these measurements. Different cases and code between rounds prevent a causal speed comparison across rounds.

The optional policy did not meet its predeclared acceptance rule and was **reverted**, rather than presented as an improvement. The retained source `0e79bf7324350e0f93efae544f7e0db53b865e0e`, now a historical hosted version, has the same tracked source tree as `211d3222f8db5eb030ce0e4e3da287368a1a18a6`. These four pairs tested the rejected `20f5412` policy; they are not a fresh evaluation of the retained candidate. **Absent employer motivation was NOT TESTED.** Passing word limits, including a role/company frame and retaining paragraphs are useful mechanical/presentation checks; they do not establish strong writing.

## Retained review-context fix: known regression, not fresh comparison

The retained fix supplies the sentence reviewer with separate active source passages. It removes superseded historical quote spans using the existing correction authority, preserves intact actor/negation context, never joins text across a removed gap and requires a cited quote to fit within one active passage. This addresses the observed failure where a trailing superseded marker caused valid earlier contribution text to be rejected.

One complete draft replay of the **known corrected-facts sample**, on exact source `211d322`, finished in **37.563 seconds / seven provider requests / $0.289113 token-priced estimate**, with no provider failures or external retries. Both documents retained the applicant's dmesg finding and personal Helm fix, credited Sam with the quota check and retained the applicant's testing. The letter introduced the project on its own. Final word counts were **246/300** for the answer and **276/400** for the letter; no sentence was dropped. Six source-retention controls also passed. This known-case check and those controls do not rewrite either writing comparison or prove general model reliability.

The earlier replay on `556aab4` failed to retain the finding/Helm contribution in the answer while the letter retained it. That failed replay used eight requests in 40.556 seconds with a $0.319597 token-priced estimate; its output and receipts remain preserved. After the structural fix, a clean archive of `0e79bf7` passed a locked install, 1,019 tests across 171 files, the client build and a 19-step in-process fixture journey. These source and fixture checks do not prove the new hosted real-model journey.

## Version and publication boundary

The existing [public repository](https://github.com/adriano-labs/applyarc-evidence-hackathon) began at public main `160d270`. The [published v10 film](https://adriano-labs.github.io/applyarc-evidence-hackathon/) and [hosted receipts](../wonder-20261102/) demonstrate `a404886`. Those historical artifacts remain unchanged. The historical `0e79bf7` release used revision `applyarc-evidence--refine0e79bf7`, image digest `sha256:c15ce9b5966fab0bcf0b4f081c2384a64174e1bf15b1bcb088168a829c1dff21`, with matching JavaScript and CSS. Its known-case journey completed, but the cropped capture was rejected. The current host runs `782561a` as `applyarc-evidence--notice782561a`; its [completed v13 real-Wonder journey](../hosted-20261102/v13-782561a/) is separate known-case evidence. The replacement v12 film is prepared for publication review. None of those later checks changes the writing-comparison results or relabels the old v10 metrics.
