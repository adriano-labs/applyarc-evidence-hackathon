# Final fair Wonder comparison — 2 November 2026

**No superiority demonstrated.** The application met **5/6** scoped correction/hold outcomes; a capable assistant using the same Wonder model met **6/6**. Blind preference was **five ties, one assistant win, zero application wins**. This does not establish that the application beats a capable assistant.

Candidate: `3547156a3faa7caa67b16b6392f0215e11f8cc50`. Both recorded runs kept that source unchanged. Both approaches used `muse-wonder-1.0`; the app retained native low/medium step policies and the assistant used medium. Two independent fresh-context AI graders assessed randomly labelled A/B text packets; grade hashes were verified before method mapping. This is not human validation.

The measured task starts with the same authored facts and saved documents. It tests correction and an appropriate hold when an update is ambiguous. It does **not** test first-draft preparation, a whole hosted journey, candidate effort, human time saved or hiring outcomes.

| Case | Task | App outcome | Assistant outcome | Blind preference | App machine s | Assistant machine s |
|---|---|---|---|---|---:|---:|
| FW01 | Shared authorship | Correct repair | Correct repair | Tie | 18.68 | 22.77 |
| FW02 | Weight-unit correction | Correct repair | Correct repair | Tie | 26.50 | 13.23 |
| FW03 | Scope and context introduction | Correct repair | Correct repair | Tie | 41.31 | 14.75 |
| FW04 | Credential correction | Correct repair | Correct repair | Tie | 27.66 | 12.37 |
| FW07 | Ambiguous personal contribution | Incomplete; no clarification, export allowed | Useful hold | Assistant | 13.74 | 7.35 |
| FW08 | Ambiguous energy figure | Useful hold | Useful hold | Tie | 12.04 | 12.32 |

## What passed, and what did not

Both approaches correctly completed all **four explicit repairs**, including changes across two documents. The scoped repair grades found no newly introduced unsupported factual claim, and the exact manual sentinel survived all six fair cases in both approaches. That is not a guarantee against invention and does not make disputed saved text safe.

The app completed **one of two** useful hold cases. In FW07 it had the prior notes, but asked no clarification and permitted an actual export while the earlier authorship claim was disputed. The assistant asked the required question. FW08 was a tie: both asked the necessary scope question and preserved the documents; the app export probe was blocked.

The graders also recorded inherited defects rather than silently awarding perfect documents. In FW02 both answers still omitted a form-requested reason for interest. In FW04 both retained an old paragraph with less specificity than one frozen criterion requested, while another criterion required preserving it. These qualifications do not reverse the repair ties; they prevent claiming complete or perfect application quality.

## Timing

| Timing summary | App | Same-Wonder assistant |
|---|---:|---:|
| Median, all six attempted fair cases | 22.59 s | 12.80 s |
| Median, four explicit repairs | 27.08 s | 13.99 s |
| Median provider wait, all six attempts | 22.56 s | 12.80 s |

The all-attempt medians include the app’s incomplete FW07 attempt; it is visibly marked above. These are serial harness machine times, with fixture setup excluded. Provider wait is reported separately in the JSON and per-case table below. They are not browser-interaction speed, human effort or human time saved. The application was faster in two of six individual attempts, but was slower by the overall and repair medians. No speed advantage is established.

| Case | App provider-wait s | Assistant provider-wait s | App calls | Assistant calls | App estimated cost | Assistant estimated cost |
|---|---:|---:|---:|---:|---:|---:|
| FW01 | 18.65 | 22.77 | 2 | 3 | $0.072364 | $0.078306 |
| FW02 | 26.47 | 13.23 | 2 | 3 | $0.070874 | $0.058683 |
| FW03 | 41.28 | 14.75 | 4 | 3 | $0.130513 | $0.076934 |
| FW04 | 27.64 | 12.36 | 4 | 3 | $0.085859 | $0.069462 |
| FW07 | 13.72 | 7.35 | 4 | 1 | $0.036262 | $0.033804 |
| FW08 | 12.03 | 12.32 | 3 | 1 | $0.029992 | $0.033776 |

## All attempts and costs, including invalid comparisons

| Group | Arm attempts | Provider calls | Local ledger cost estimate | Conservative maximum reservations |
|---|---:|---:|---:|---:|
| Four fair repair pairs | 8 | 24 | $0.642995 | $5.701084 |
| Two fair replacement hold pairs | 4 | 9 | $0.133834 | $2.074648 |
| All six fair pairs | 12 | 33 | $0.776829 | $7.775732 |
| Two original invalid hold pairs | 4 | 9 | $0.149547 | $1.898852 |
| All attempts, including invalid holds | 16 | 42 | $0.926376 | $9.674584 |

All **42 provider calls settled**, with **no provider retries and no unsettled usage**. The overall local ledger estimate is **$0.926376**; the cumulative conservative reservations were **$9.674584**, within the $20 comparison allowance. These are usage-priced ledger estimates, not a provider invoice or a current credit-balance check. Reasoning tokens are already included in output tokens.

## Excluded original hold attempts

FW05 and FW06 remain in the original report and audit trail. My fixture setup omitted the original source’s `read: true` metadata. As a result, the app’s extraction request lacked the earlier notes while the assistant received them. Their hold comparisons are invalid; do not count them as fair wins/losses or hide their cost.

The versioned harness restored normal completed-read metadata. A no-provider regression captured the actual extraction request, proved both original and new sources were present, failed against the old adapter and passed against v2. Two genuinely new cases from a new source-blind author were then frozen and run as FW07/FW08. This is a disclosed replacement procedure, not an untouched single six-case run.

| Excluded case | Arm | Recorded status | Machine s | Provider calls | Estimated cost |
|---|---|---|---:|---:|---:|
| FW05 | baseline | held-for-clarification | 5.07 | 1 | $0.028924 |
| FW05 | app | unresolved-without-verified-safe-hold | 18.39 | 4 | $0.059967 |
| FW06 | app | unresolved-without-verified-safe-hold | 12.02 | 3 | $0.027820 |
| FW06 | baseline | held-for-clarification | 6.38 | 1 | $0.032836 |

## Release boundary

This report evaluates only candidate `3547156a3faa7caa67b16b6392f0215e11f8cc50`. A subsequent export-freshness guard is outside these results. Passing deterministic guard tests must not be presented as improved semantic conflict detection or a new 6/6 comparison. A post-fix replay of FW07 is an exposed diagnostic, not fresh evidence.

Six synthetic cases are too small for broad superiority or reliability claims. This evidence supports a truthful demonstration of controlled correction and preservation, while openly identifying the missed ambiguity and the remaining latency cost. It does not support a first-place prediction.

## Evidence record

[Machine-readable results](comparison.json) retain exact outcomes, usage, timing and source hashes. Local paths were removed. The underlying input documents are synthetic. The scope, failed case, excluded attempts and later-fix boundary above remain unchanged.

---

Retrospective supplement, 2 November 2026; no reruns or score changes.

## Recorded application actions

The six-case comparison also retained the scripted application route count. Each of the four completed corrections used eight requests: change fact, run repair, take each of two proposals, apply, approve each document, export. The two ambiguity cases used four and three requests, including one deliberate export-safety probe each. Total: **39 requests**, or **37 excluding those two probes**. The missed ambiguity remains a failed case despite its HTTP requests succeeding.

Each arm received the same update text once. The assistant received one automatically assembled context packet per case; no browser copying, user review, saving or export was measured for it. **Its user-action count is unobserved, not zero.** These API counts are not human clicks, typing or cognitive effort, and provider/tool calls are counted separately.

This fills the protocol's action-count record but establishes **no operator-effort or human-time advantage**. The verdict remains five ties and one assistant win: app 5/6, same-Wonder assistant 6/6; the app was slower on median repair time. The experiment began with prepared facts/documents and did not measure full application preparation.
