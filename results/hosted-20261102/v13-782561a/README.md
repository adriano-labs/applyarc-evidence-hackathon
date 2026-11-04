# Hosted Wonder journey v13 — 2 November 2026

**Completed known-case browser journey; replacement film ready for publication review.** Source `782561aacb0af062ef83bdf8a45bfe30108d1f58`, Azure revision `applyarc-evidence--notice782561a`. This uses the fictional Ellie/Sam sample and a dated public Graphcore form. It is not a fresh comparison, a human-effort study or proof of stronger writing.

[Journey receipt](journey-receipt.json) · [sanitized model trace](hosted-trace.json) · [unchanged approved pack](approved-pack.md) · [sanitized recorded UI](activity-dom.txt) · [hashes and redactions](MANIFEST.json)

## What happened

Wonder read the notes, asked for clarification and drafted the project answer and cover letter from confirmed evidence. The final recorded workspace shows **14 confirmed facts**. The applicant edited the opening sentence themselves, then corrected an earlier claim that they had written the Helm patch: Sam wrote it; the applicant reproduced the failure, tested his fix and wrote the incident notes.

The app proposed repairs in **both documents**. A review required a targeted revision and another review; this was not first-pass perfection. The completed receipt records **21 other sentences unchanged**, including the exact applicant-written opening. The final pack credits Sam with the patch and retains the applicant's three actions. Both documents were approved again and the export remains **NOT SUBMITTED**, with 12 employer-portal tasks remaining.

- Project answer: version 3, **247/300 words**.
- Cover letter: version 2, **204/400 guide words**.
- One project-answer sentence remains explicitly the applicant's own words, not checked against their facts.

The pack is byte-identical to the downloaded export. Its word counts were independently recounted from the final document bodies, including the letter's greeting/signoff. This documentation check did not rerun a model or recreate the before/after workspace comparison. The unchanged-sentence count comes from the completed journey receipt.

## Actual model work

Every stage names **Muse Wonder 1.0**. Extraction and clarification used low effort; writing, review, repair and revision used medium. Native tools were `form_requirements` (3), `verify_quote` (16) and `word_count` (4).

| Recorded measure | Complete trace | Repair / review / revision / review |
|---|---:|---:|
| Model stages | 12 | 4 |
| Provider attempts, including tool turns | 21 | 4 |
| Native tool calls | 23 | 0 |
| Summed model-stage time | 139.651 s | 32.510 s |
| Token-priced cost estimate | $0.5190288 | $0.1390896 |

The interface rounds the total to **2 min 19 s total model time / $0.519**. Stages can overlap, so their sum is not elapsed journey time or the applicant's waiting time. Costs are estimates, not invoices or balances. The trace records zero unsettled calls and zero injected faults. The repair revision remains visible; this is recovery from an imperfect proposal, not an error-free or single-call claim.

The final text remains open to criticism: the repair separates Sam's ownership from the passive description of the fix, and the letter lists several technical details. This successful workflow does not reverse the [fresh blind writing losses](../../writing-20261102/) or establish a speed advantage.

## Source, privacy and publication boundary

The deployed source adds the visible allowance-fallback explanation to the retained source-passage/UI fixes. A fresh isolated synthetic visitor was used after an earlier visitor's allowance was exhausted. This did not renew that earlier visitor's allowance or change the existing caps. The server may start a new workspace on a clearly labelled handwritten fixture when allowance is unavailable; that fixture is not Meta output.

The source passed **1,023 tests across 171 files**. Its clean archive passed a locked install, production client build and the 19-step in-process fixture journey. ARM reports the revision ready/running; both served JavaScript and CSS match that production build. The image digest is `sha256:5e61c45a48c3a87aa22efd5a14a1b38db060fd1499f962cddbb8ddffed05f799`. Tests and fixture checks remain distinct from the real hosted journey above.

The public trace and UI copy remove provider request UUIDs, global account spending/balances and rate-limit balances. They retain model/effort, visible tool receipts, token counters, timing, costs and stage outcomes. Numeric reasoning-token counts are retained; there is no private reasoning content. Original and sanitized hashes are explicitly separate in the manifest and receipt. No real applicant/customer data, credentials or session cookies were found in the inspected artifacts. The synthetic approved pack needed no redaction.

The older [0e79bf7 journey](../#historical-0e79bf7-journey) and [published v10 evidence](../../wonder-20261102/) remain historical. **The [2:40 replacement film candidate](video-candidate.json) is ready for publication review. It has not replaced the public v10 yet.**
