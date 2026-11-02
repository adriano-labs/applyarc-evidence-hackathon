# Muse Wonder evidence — 2 November 2026

These are synthetic-data results. They are not customer outcomes or evidence of human time saved.

## Current hosted browser journey

The [sanitized v10 trace](hosted-v10-trace.json) and [actual approved pack](hosted-v10-approved-pack.md) come from source **`a404886ef80daadd24306fda526582e0b218e9a4`**, deployed as `applyarc-evidence--approvalsa404886`. Ellie and teammate Sam are fictional. The Graphcore form is a dated public snapshot. The pack is unchanged from the export and remains **NOT SUBMITTED**.

The recorded journey added the whole conflicting note once. Wonder asked about authorship; the applicant chose **Use this correction**, reviewed two proposed repairs and kept 17 passages untouched. The applicant-written opening stayed exact. Approvals cleared immediately when the note was added and were explicitly renewed before export.

The project answer is version 3, **203/300 words**; the cover letter is version 2, **161/400 guide words**. Both name Sam as the patch author and retain the applicant’s three actions: reproducing the failure, testing his fix and writing incident notes. The letter’s first repair lacked local failure context. Its review triggered a targeted revision that added the confirmed `/dev/shm` 64 MB / PyTorch failure context. This is recovery from an imperfect proposal, not first-pass perfection. One applicant-written project-answer sentence remains labelled as their own words, outside the model evidence check. Twelve employer-portal tasks remain.

| Recorded measure | Whole trace | Repair, review, revision and review |
|---|---:|---:|
| Application receipts | 12 | 4 |
| Provider attempts | 19 | 4 |
| Native tool calls | 20 | 0 |
| Summed request time | 114.666 s | 29.435 s |
| Usage-priced estimate | $0.394786 | $0.112538 |

Every receipt names `muse-wonder-1.0`. Extraction and clarification used low effort; writing and repair/review used medium. Request totals exclude human reading, typing and approval and can include overlapping calls. They are not journey duration, a speed promise, a provider invoice or a credit balance. The interface rounds the whole trace to **1 min 54 s / $0.395**.

The sanitized trace retains model, effort, tool names, usage, estimated cost and timing; provider identifiers, account budgets and rate-limit balances were removed. Approved-pack SHA-256: `74b1d39f3008b4465c2424bedb7ca15d7ca0c4031065f3cff7d01b1c39cfe82a`. The original trace hash is retained in the JSON. Final video editing/review and its accessible public URL remain pending.

## Hosted HTTP journey and approval boundary

The same source also completed all **19 commands** of a separate real-Wonder synthetic HTTP journey. [Sanitized proof](hosted-a404886-proof.json).

- Script elapsed: **145.182 seconds**; writing both documents: **59.397 seconds**; proposing repairs: **37.969 seconds**.
- Export remained **NOT SUBMITTED** after explicit approvals.
- Adding one further ordinary note immediately cleared current approvals while preserving documents and export history.
- Direct approval returned HTTP 409 `not-ready`; direct export returned HTTP 409 `not-approved`. Both said “Read your new evidence first.”
- Cleanup verified zero sources, zero facts and no documents in that test workspace.

This is a known-case scripted hosted check, separate from the browser recording. The guard forces evidence review and fresh approval; it does not prove better semantic conflict detection. Source `a404886` passed 965 local tests and the build.

## Six-case comparison: no superiority demonstrated

Read the [full comparison](comparison.md) or [machine-readable results](comparison.json). It evaluated **`3547156`**, before the later approval-boundary fix. Two fresh-context blind AI graders found **five ties and one assistant win**. The app met 5/6 scoped outcomes; the same-model prompted assistant met 6/6. Both completed all four explicit repairs. Median repair machine time was **27.08 seconds** for the app and **13.99 seconds** for the assistant.

Four repair pairs came from the first run; two new independently authored hold cases replaced invalid comparisons after a disclosed fixture repair. The app missed one ambiguity and allowed an old approved export. The failed result remains a failure after the code fix; it is not rewritten as a pass. Both approaches also retained small inherited completeness gaps in two cases. This is prepared-state correction evidence, not a full first-draft benchmark or human study.

## Historical evidence

The [v9 trace](hosted-v9-trace.json) and [v9 approved pack](hosted-v9-approved-pack.md) are retained for source `3547156`. They are superseded as the current browser demonstration by v10 above; they must not be relabelled as `a404886` results.

[Earlier Spark comparisons](../BLIND-RESULTS.md) retain their losses and failures. Those model results do not transfer to Wonder. Earlier historical traces remain labelled by model and source revision.
