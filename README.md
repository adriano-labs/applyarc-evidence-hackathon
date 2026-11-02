# ApplyArc Evidence

**Application answers you can stand behind.** A workspace for the applicant to write, inspect and correct a project answer and cover letter together.

Muse Wonder reads the applicant’s notes, asks about missing details and proposes writing tied to confirmed evidence. When the applicant corrects who did the work, the app identifies affected passages in both documents, shows the proposed changes and protects their manual edits. The applicant approves the final versions. The export is **NOT SUBMITTED** and lists the employer-portal steps still to do.

Built as a standalone submission for the Meta Global AI Developer Hackathon, Startup track. No employer screening, candidate ranking or automatic application submission. [Event provenance](PROVENANCE.md).

## Try the judge journey

[Open the hosted demo](https://applyarc-evidence.jollystone-892bee18.northeurope.azurecontainerapps.io/). It is unlisted but publicly reachable, with separate cookie-based visitor workspaces and no sign-in. **Use the fictional sample or synthetic notes only.** Cookie separation is not private authentication.

1. Choose **Try it with Ellie’s notes**, review the extracted facts and confirm them.
2. For the recorded fictional example, answer the contribution question: “I wrote the Helm patch that mounted a memory-backed emptyDir with a size limit per job.” Draft and read the project answer and cover letter.
3. Edit the opening sentence yourself, then approve both documents. To reproduce the recording, use: “Our four-person final-year team built a GPU job runner for the department's machine learning teaching cluster, from September 2025 to March 2026.” This gives you wording to check was preserved.
4. In **Your notes**, add this note **once**: “Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes.”
5. When the conflicting account is raised, choose **Use this correction**. Review the proposals in **both** documents. If a passage you edited conflicts, make its explicit keep/change decision.
6. Check that Sam owns the patch, Ellie’s three actions remain, and each document explains the failure on its own. Approve the new versions and download the pack. It must still say **NOT SUBMITTED**.

The live model can vary its wording. If it asks a different useful question, answer from the displayed fictional facts. Do not invent missing information to finish. If the allowance prevents a new live workspace, the labelled fixture sample is available; fixture output is not Meta output.

**Current hosted build, 2 November:** source `a404886`, revision `applyarc-evidence--approvalsa404886`, with 965 local tests and build passing. Its real-Wonder browser journey completed on this build: [trace](results/wonder-20261102/hosted-v10-trace.json) and [approved documents](results/wonder-20261102/hosted-v10-approved-pack.md).

A separate [hosted HTTP check](results/wonder-20261102/hosted-a404886-proof.json) completed 19 commands in 145.182 seconds, verified that new evidence clears approvals and blocks export, and cleaned its synthetic workspace. These are known-case runs, not human time-saving measurements. [Evidence and version boundaries](results/wonder-20261102/).

**Public submission materials:** [watch the 2:06 demo](https://adriano-labs.github.io/applyarc-evidence-hackathon/) · [source repository](https://github.com/adriano-labs/applyarc-evidence-hackathon). Both are public. Publication is not final competition submission.

The video uses the actual hosted interface and Wonder outputs, a fictional applicant and disclosed synthetic narration. Initial preparation and some waits/navigation are shortened; one result is paused for reading. It is not an uninterrupted live run. The viewing page includes captions, transcript and the unchanged approved video.

## What the comparison actually found

Six synthetic prepared-state correction/clarification cases compared the app with a capable assistant using **the same Muse Wonder model**. Two fresh-context blind AI graders found **five ties and one assistant win**. The app met 5/6 scoped outcomes; the assistant met 6/6. Both completed all four explicit repairs and retained the specified manual sentence in every fair case.

| Measure | ApplyArc | Same-Wonder assistant |
|---|---:|---:|
| Scoped task outcomes | 5/6 | 6/6 |
| Explicit repairs | 4/4 | 4/4 |
| Appropriate clarification holds | 1/2 | 2/2 |
| Median explicit-repair machine time | 27.08 s | 13.99 s |

**We have not demonstrated superiority or human time saved.** The app missed one authorship ambiguity and allowed an old approved export. The later approval-boundary fix requires evidence review and renewed approval, but does not prove better model conflict detection. The failed case remains a failure. The comparison measured prepared-state corrections, not full first-draft quality; both approaches retained small inherited omissions in two cases.

Four repair pairs came from the first run. Two original hold comparisons were invalid because our fixture omitted prior context from one arm; their attempts and cost remain recorded, and two new cases replaced them after the harness fix. [Full Wonder method and every result](results/wonder-20261102/comparison.md). [Earlier Spark results, including losses](results/BLIND-RESULTS.md), remain separate.

## How Meta is used

- **Muse Wonder 1.0** through Meta’s Responses API: evidence extraction, clarification, document writing, sentence review and cross-document repair. The recorded journey uses native tool calls for quote verification, form requirements and word count, with structured outputs and streaming.
- **Bounded revision:** the checker evaluates proposed writing against the cited facts and each document’s context. A failed check can trigger a targeted revision; unresolved work stays for the applicant. These are fallible model judgments, not proof that a personal account is true.
- **Visible receipts:** **What Meta did** shows model, effort, tools, reported tokens, cached tokens, estimated cost and timing. The [sanitized hosted trace](results/wonder-20261102/hosted-v10-trace.json) records 19 provider attempts; the known-case rehearsal needed a repair revision. It is not a first-pass or speed claim.
- **Other supported Meta paths:** Muse Spark 1.3 on Meta’s API; Muse Spark Open on a compatible host; optional Muse Voice Transcribe. Their historical results are labelled separately. We do not claim every supported capability was used in the filmed run.

The model proposes. Application code controls the saved facts, edits, approval versions, conflict decisions and export. Adding ordinary evidence clears current approvals; unread evidence or proposed facts block approval and export even when the model raises no question. Direct fact corrections invalidate affected documents. No model action can submit an application.

## Run from this repository

Use Node 24+ and pnpm 10. Fixture mode is the default, works without keys, and is labelled on screen.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm start       # http://localhost:3000
```

In another terminal, `pnpm journey` runs a no-key fixture journey in process. It does not measure the hosted model. No private ApplyArc repository or service is required.

```bash
docker build -t applyarc-evidence .
docker run --rm -p 127.0.0.1:3000:3000 -e PROVIDER=fixture applyarc-evidence
```

The container runs as an unprivileged user; `/app/data` is its writable state directory. This command uses temporary container storage. The Docker launch itself has not been verified in the current test environment. The clean `378128d` source archive passed a fresh locked install, 965 tests, build and the complete 19-step no-key fixture journey. This publication snapshot has identical runtime files; README, provenance and comparison notes changed for packaging and recorded action counts. [Publication and development history](PROVENANCE.md).

For real Meta calls, copy `.env.example` to `.env`, set `PROVIDER=meta`, `META_API_KEY` and `META_MODEL=muse-wonder-1.0`, then start with `node --env-file=.env server/index.js`. Keep keys outside source control. With no global effort override, extraction/clarification use low and the other steps medium. `.env.example` also documents the compatible-host settings.

`SPEND_CAP_USD` is an application reservation threshold, not an absolute provider billing ceiling: input tokens are estimated. Leave allowance headroom and verify provider controls. Cost receipts are token-priced estimates, not invoices. Real calls require usable provider access; fixture checks do not establish it.

In the recording, the `$80` meter is the cumulative shared demo allowance, not this journey's price or the provider's remaining credit. This journey's 12 step receipts contain 19 model turns and 19 provider attempts, including tool-result continuations, for about `$0.395`. Those counts do not imply 19 retries; the trace records no extra transport retry attempts. Summed model-request time is not human time saved.

## Reliability and limits

Saved state uses atomic writes and revision checks; stale saves are refused. Interrupted work can be retried without silently discarding saved text. Retries and model loops are bounded. Keys stay server-side. A user’s manual writing remains explicitly theirs; it is not silently certified by the evidence checker. A dated form snapshot may differ from the employer’s current portal.

An edited sentence can retain its earlier numbered evidence references for context. The pen/“Your words” label and export notice mean that the edited wording has not been re-verified; a reference is not certification of the sentence or the applicant's story.

The work has been exercised with synthetic applicants, automated tests, a hosted rehearsal and small AI-graded comparisons. It has not established human time savings, customer demand or better hiring outcomes. [Product scope](PRODUCT.md), [MIT licence](LICENSE).

Development used Claude Code, OpenAI Codex and GitHub Copilot CLI. Runtime model results are Meta results; development-tool use is not substituted for runtime proof.
