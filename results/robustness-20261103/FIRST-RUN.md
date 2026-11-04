# ApplyArc Evidence robustness test, 3 November 2026

Source under test: clean archive of commit `2095e52` (worktree `hackathon-v15`), installed from the lockfile on Node 24, run locally over the HTTP API with real Meta models. No repository was modified; no hosted link was used. All applicants are fictional.

## What was run

| Host | Server | Cap | Spent (ledger) | Journeys |
|---|---|---|---|---|
| Meta Muse Wonder 1.0 (`PROVIDER=meta`, `muse-wonder-1.0`) | 127.0.0.1:3170, fresh `DATA_DIR` | $10 | $7.435 | 18: eight personas as written, Ellie's sample as a control, eight personas with a plain-phrased correcting note, one rerun |
| Meta Muse Spark Open on Modal (`PROVIDER=compatible`, `meta-models/Muse-Spark-Open-816B-A42B`, chat wire, structured output) | 127.0.0.1:3171 | $3 | $0.259 | 2: Ellie's sample and the terse-bullets persona |
| Meta Muse Spark Open via Baseten (`https://inference.baseten.co/v1`, `meta-models/muse-spark-open-1026`) | 127.0.0.1:3172 | $3 | $0.328 | 2: Ellie's sample and the terse-bullets persona |

Baseten settings were established from the app's own `.env.example` and provider test at this commit, from the model id in 959 raw receipts under `evidence/baseten/`, and from a live models-list check that listed the model before any paid call.

Each journey over the API: start fresh, add notes, read them, confirm every proposed fact, check the form, answer one open question (the personal "contribution" question when asked; any other open questions skipped, as a judge pressed for time would), read and confirm the answer, check again, draft both documents, replace one sentence by hand (the opening sentence of the project answer, chosen so it did not cite the fact about to be corrected), approve both, add the correcting note in Your notes, read it, choose the correction, take every proposal, apply, approve both again, export. Wonder ran two journeys at a time; the Spark Open hosts ran one at a time. One retry was allowed where the app's error says Try again (see the note on the retry rule under failure F3).

Where the correcting note did not produce the "Use this correction" card, the runner recorded that and fell back to what a judge can still do: reject any facts proposed from the note (or press "Keep the earlier account" on the conflict question), then use Correct fact on the fact the note contradicts. The route taken is recorded per journey (`use-this-correction`, `skip-then-correct-fact`, `missed-then-correct-fact`).

Personas (`personas.mjs`): terse bullet notes (priya), long rambling notes (tom), non-native English (yusuf), notes that only say "we" (hannah), notes with no individual contribution in third person (dev), notes with numbers that must not be invented (aisha), notes with an internal contradiction about team size (ben), very short notes (leo). All on the shipped Graphcore Graduate Cloud Platform Engineer form, because the app's own-notes path only uses the default form.

## Summary per host

Invariants: (1) every confirmed fact's quote is verbatim in the applicant's text; (2) both documents within the form limits after drafting and at export; (3) every citation points to a confirmed fact and every claim is cited; (4) after the correction only sentences that cited the corrected fact changed; (5) the hand-edited sentence is byte-identical afterwards; (6) approvals cleared by the correcting note and renewed after re-approval; (7) export says NOT SUBMITTED; (8) no HTTP 5xx, no 5xx-class streamed error, no unhandled error; (9) no number in a drafted sentence that is absent from all its cited facts.

| Host and variant | Completed | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Median model step | Worst model step | Cost per journey (receipts) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Wonder, note as written (8 personas + Ellie) | 9 of 9 | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 | 11.1 s | 54.9 s (ben: write both documents) | median $0.425, range $0.306 to $0.596 |
| Wonder, plain-phrased note (8 personas + 1 rerun) | 8 of 9 | 9/9 | 9/9 | 7/8 | 8/8 | 8/8 | 8/9 | 8/8 | 8/9 | 8/8 | 12.8 s | 51.1 s (leo: propose the changes, the failed step) | median $0.401, range $0.346 to $0.481 |
| Spark Open on Modal (Ellie + priya) | 2 of 2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 4.8 s | 36.6 s (ellie: propose the changes) | median $0.130, range $0.127 to $0.132 |
| Spark Open via Baseten (Ellie + priya) | 2 of 2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 1/2 | 4.2 s | 49.0 s (ellie: write both documents) | median $0.164, range $0.140 to $0.188 |

"x/y" is passes over journeys where the invariant could be evaluated; the aborted Leo journey never reached the invariants marked 8/8. Across all 22 journeys: no HTTP 5xx, no unhandled error, no step retry was needed, and no host reached its cap. Wall time per journey: Wonder median 81 to 91 s (max 124 s); Spark Open 59 to 91 s. Per-step latencies, attempts, tool calls and tokens are in the appendix and in `runs/<host>/<persona>.json`.

How often the headline feature appeared, the "Use this correction" card after the correcting note:

| Correcting note | Wonder | Modal | Baseten |
|---|---|---|---|
| Ellie's sample (README wording) | offered, taken, repaired (1 of 1) | offered (1 of 1) | offered (1 of 1) |
| Eight personas, note as written (each starts with "Correction:" or "One correction:") | 0 of 8 conflicts raised; all 8 notes became proposed facts | priya: not raised | priya: not raised |
| Eight personas, same note without the word "correction" | 7 of 8 conflicts raised; card offered in 3 of those 7 (plus the Leo rerun: raised and offered) | not run | not run |

## Every failure

F1. Correcting notes that call themselves a correction are read as new facts, never as a conflict. Step "read the correcting note". Wonder 8 of 8 personas, Modal priya, Baseten priya. The result was `{accepted: n, conflict: false}` and the note's sentences arrived as proposed facts, for example "Mateo wrote the Karpenter autoscaler config, not me." proposed beside the confirmed "I wrote the Terraform modules for the node pools and the Karpenter autoscaler config myself". A judge who confirms them ends with two contradictory confirmed facts and no repair. Reproduction: `node run.mjs --host wonder --base http://127.0.0.1:3170 --personas priya` (note text in `personas.mjs`, `correction.text`); raw: `runs/wonder/priya.json`. Control: the same notes without the word (`--plain`) raised a conflict in 7 of 8 (`runs/wonder/*-plain.json`), and Ellie's note, which has no such word, raised one on all three hosts.

F2. Conflict raised but no "Use this correction" card, 4 of 7 on Wonder plain (priya, hannah, dev, leo first run). The model's `priorQuote` was the whole earlier answer sentence, which extraction had split into two confirmed facts (for example "I wrote the GitHub Actions workflow that builds the images and runs the integration tests" and "I set up the k3s server"); `view.sourceCorrections` was empty because the offer requires exactly one matching fact. The judge's only ways on are "Keep the earlier account" or "Explain instead", then Correct fact. Raw: `runs/wonder/dev-plain.json` (`conflictQuestion`, `offer: null`).

F3. Repair step died with a cut-short answer. Persona leo, plain note, first run, step "propose the changes": streamed error `incomplete`, message "The answer was cut short (max_output_tokens). Nothing was changed." (502-class). The `revise` sub-call (output budget 4000 tokens) ran out of tokens, as its receipt shows (`error: "incomplete"`). The repair stayed open, approvals stayed cleared, export blocked. The UI does offer Try again for this code (`client/src/useWorkspace.js:10`), but the runner's first retry rule keyed on the message text and did not retry; a full rerun of the same journey completed on the "Use this correction" route with 9 of 9 invariants, so the cut-off reproduced in 1 of 2 runs. Raw: `runs/wonder/leo-plain.json`, `runs/wonder/leo-plain-rerun.json`.

F4. Repair offered nothing for sentences that were still true. Persona hannah, plain note (fact corrected from "I built the Grafana dashboards and the alert rules" to "Aoife wrote the alert rules, not me. I built the Grafana dashboards and ran the load tests."). Both sentences "I built the Grafana dashboards." came back as needs-review with an empty reason: the model's rewrite was the unchanged sentence, and the app treats an unchanged rewrite as no proposal. Keeping them stripped their citation, so the export carried two uncited claims (invariant 3 failed). Raw: `runs/wonder/hannah-plain.json`.

F5. Repair left the contradiction in place. Persona leo, as written: after the correction "Mira set up the cluster. I wrote the containerd proxy fix.", the project answer's opening "I set up a three-node k3s cluster…" got "No supported rewrite was returned" (needs-review) while the letter's equivalent sentence was rewritten to "Mira set up…". Keeping it exported an answer that says the applicant set up the cluster, against the corrected fact. Raw: `runs/wonder/leo.json`.

F6. Invented or derived number on Baseten. Persona priya: the answer said "We worked as a team of three comprising me and two platform engineers" citing only "team: me + 2 platform engineers (Mateo, Jen)"; the number 3 appears in no cited fact. The deterministic number rule in `claims.js` is not applied on the live path, and the model reviewer accepted it. Raw: `runs/baseten/priya.json`. The same persona's Wonder and Modal drafts did not do this.

F7. A number-only correction never raises a conflict. Persona aisha, both phrasings on Wonder: "The p95 on the order service went from 1.8 s to 400 ms, not 300 ms." was proposed as a fact next to the confirmed "…went from 1.8 s to 300 ms…". Raw: `runs/wonder/aisha.json`, `runs/wonder/aisha-plain.json`.

F8. An internal contradiction in the notes survives into the export. Persona ben: "Team of three: me, Sara and Kofi." and "By the end all five of us were using it daily" were both confirmed and the as-written export contains "There were three of us: Sara, Kofi and me." and "By the end, all five of us were using it daily". No question was asked about it in either run. Raw: `runs/wonder/ben.json`.

F9. The model asked for something the notes already said. Persona priya on Modal and Baseten: the notes state the decision ("spot instances for the batch node pool, on-demand for the Argo controller. cheaper, jobs are retryable anyway"), the extraction quoted it without the reason and linked it to no requirement, and the check step asked "why did you choose spot instances…". Skipping that question left "One technical decision you made and why" listed as not answered in the export even though the exported text covers it. Wonder linked the fact and asked nothing. Raw: `runs/modal/priya.json`, `runs/baseten/priya.json`.

F10. Every persona's cover letter is signed "Yours sincerely, Ellie" or "Kind regards, Ellie" on all hosts, because own notes on the shipped form never set the applicant's name. Raw: any `runs/*/<persona>.json`, `export.documents[1].text`.

F11. A cut-short call is billed by the ledger but shown as free. In F3 the `revise` receipt records attempts 0, cost $0, error `incomplete`, while the transport settled the call's real cost before throwing. "What Meta did" under-reports that step.

F12. The conflict question can leak an internal instruction: ben, plain note, question text "Should six weeks replace the four-week migration length, using Correct fact, or do the two lengths describe different stages?".

Also observed, not counted as failures: extraction refused one fact for aisha because its statement carried a number the quote did not (the guard worked); duplicate proposals were refused by the domain for priya, hannah, leo; drafts for the shortest notes were thin (leo: 61 to 64 of 300 words, with two requirements left out as the app says); Modal priya's repaired paragraph ends "…reviewed Mateo's Karpenter autoscaler configuration. Mateo reviewed them.", a dangling pronoun the retention review accepted; aisha's repaired sentence dropped the still-true context "after the move, mostly because the old VM was starved".

## Product bugs to fix first

1. Conflict detection switches off when the note calls itself a correction. `server/agent/prompts.js:25` tells the model that "an explicit correction source replaces the historical wording", and the model applies that to any note containing the word. Fix: state in the prompt that a source is an explicit correction only when its `kind` in `active_source_context` is `correction` (the kind is already sent, `server/domain/sourceConflicts.js:61`), and that a note describing itself as a correction is ordinary notes that must be raised as a conflict. Add a deterministic backstop in `server/flows.js:93` (`read`): when a later notes or answer source yields proposed facts and no conflict, run the existing reviewer (`server/agent/evidenceReview.js:36`) with each proposed fact as the claim and, as evidence, the confirmed facts that share two or more content stems with it (`server/domain/claims.js:52`); a `contradicted` verdict becomes a held conflict via `holdSourceConflict` with that fact's quote as `priorQuote`. Expected effect: F1, and probably F7.

2. "Use this correction" is only offered when exactly one fact matches. `server/domain/sourceConflictCorrection.js:21` returns nothing when the model's earlier quote spans two facts, which happened in 4 of 7 raised conflicts. Fix: when several facts from the prior source match, keep the ones cited in the drafts and rank by word overlap with the note's quote; offer the best one, or one card per match, and let `resolveSourceConflict` accept any fact in that list. Expected effect: F2.

3. An unchanged rewrite counts as no proposal. `server/domain/repair.js:76-77` only sets `after` when the reviewed text differs from `before`, so a sentence that is still true becomes needs-review with no reason, and keeping it strips its citation. Fix: when the usable rewrite equals the current text, mark the item as proposed-unchanged, keep its citations on apply, and never leave `reason` undefined. Expected effect: F4, part of F5.

4. A cut-short revise call aborts the whole repair. `server/agent/repairFlow.js:79` and `server/agent/draftFlow.js:156` continue without the revision only for `invalid-output`; `server/agent/model.js:18` gives `revise` a 4000-token output budget that reasoning can exhaust. Fix: treat `incomplete` the same way (go on without the revision, say so in the stage label) and raise the revise budget to 8000 like repair. Expected effect: F3, and the receipt gap F11 once `server/agent/loop.js:99-101` records the settled usage of a turn whose transport call threw after settlement (`server/agent/transport.js:206-213`).

5. The deterministic number rule is skipped on the live path. `server/domain/documents.js:64` returns the model review for any claim when a review exists, so `claimProblem`'s "a claim states a number its facts do not" (`server/domain/claims.js:105`) never runs for real drafts. Fix: run the number check before consulting the review, for every provider; it is cheap and matches the product rule in `server/agent/prompts.js:72`. Expected effect: F6.

6. Own notes keep the sample's name. `server/domain/workspace.js:18` defaults the applicant to "Ellie", `server/app.js:32` seeds every workspace with it, and `startSample` (`server/flows.js:63`) never sets a name either. Fix: default to no name, set `ws.applicant.name` from the sample in `startSample`, ask for a first name in the own-notes path, and let `server/domain/frames.js:3` sign off without a name when none is given. Expected effect: F10.

7. Questions about things the notes already say, and "not answered" labels that are wrong. `server/flows.js:112` (`check`) trusts the model's coverage links; on Spark Open the decision fact was quoted without its reason and left unlinked. Fix: before adding a model question, look for a confirmed fact whose statement shares two or more content stems with the requirement text and offer a one-click link instead of a free-text question; at export, compute "not answered" from the cited facts of the document text rather than from coverage alone. Expected effect: F9.

8. Contradictions inside one source and number-only contradictions. `server/agent/prompts.js:22` lists scope, actor, setting and negation as conflict triggers; numbers and dates are missing, and nothing compares proposed facts with each other. Fix: add "a different number, date or measurement for the same thing" to the trigger list, and after extraction flag two proposed facts from one source whose quotes share three or more content stems but state different numbers. Expected effect: F7, F8.

9. Strip app instructions from the applicant-facing question: filter "Correct fact" and similar product terms out of `question` text in `holdSourceConflict` (`server/domain/sourceConflicts.js:75`) or tell the model not to name app buttons. Expected effect: F12.

## Paragraph that would be honest in the README

Robustness check, 3 November 2026, source `2095e52`: 22 scripted journeys over the HTTP API on three Meta hosts (Muse Wonder 1.0, 18 journeys; Muse Spark Open on Modal and via Baseten, 2 each) with eight fictional applicants whose notes differ in style, plus Ellie's sample. 21 of 22 completed; one Wonder repair step ended with a cut-short model answer and completed on a rerun. Every completed journey exported NOT SUBMITTED with both documents within their limits, every citation pointing to a confirmed fact, only sentences citing the corrected fact changed, and the hand-edited sentence untouched; there were no HTTP 5xx errors and no retries were needed. The conflict card appeared for Ellie's sample on all three hosts, but for the other eight applicants it appeared in 4 of 17 attempts: a note that begins "Correction:" was read as new facts rather than a conflict on every host, and when the earlier answer had been split into two facts the card was not offered. In those cases the Correct fact route still repaired the documents, with one case where a still-true sentence was left for the applicant to review. Spark Open via Baseten once wrote "a team of three" from a note that said "me + 2". Wonder journeys cost $0.31 to $0.60 each with a median model step of 11 to 13 s; Spark Open journeys cost $0.13 to $0.19 with a median step of 4 to 5 s. Method, every failure and the raw receipts are in `robustness/RESULTS.md`.

## Limits of this test

One scripted path per persona (two for the plain-phrased variant of leo), so rates such as 7 of 8 are small-sample observations, not estimates. The runner answered only one question per journey and skipped the rest, chose "keep" for any sentence the repair could not rewrite, and would have kept its own hand-edited sentence if that sentence had conflicted (it never did). Wonder ran two journeys at once; latencies were not noticeably different from the single-journey Spark Open runs, but the ledger delta per journey is not meaningful under concurrency, so per-journey cost is the sum of that workspace's receipts (which matched the ledger total to the cent). The manual sentences and clarifying answers were written in advance and are consistent with each persona's notes. Invariant 9 counts "three" as a number the facts do not state even when it is derivable from "me + 2"; that is the app's own rule.

## Files

- `app/`: clean archive of `2095e52` with dependencies installed; not modified.
- `personas.mjs`, `run.mjs` (journey driver and invariant checks, reusing the app's `apiClient`), `start-host.sh` (server launcher; keys read inside its shell only), `report.mjs` (tables from the raw JSON).
- `runs/<host>/<persona>[-plain][-rerun].json`: raw per-journey records (every step's latency, HTTP statuses, receipts with tokens and cost, snapshots, invariants). `runs/<host>/summary*.json` is written per invocation of `run.mjs`; the Ellie control run overwrote `runs/wonder/summary.json`, so use the tables in this file (built from the per-journey records) rather than that summary. `runs/fixture/` is the no-key dry run of the runner on the hand-written fixture, not Meta output.
- `logs/run-*.log`: step logs; `logs/<host>.log`: server output; `data/<host>-<stamp>/`: each server's workspaces and ledger.
- `report-tables.md`: the appendix below, regenerable with `node report.mjs wonder modal baseten`.

Servers started for this test were stopped afterwards (ports 3170 to 3172 free); no key value appears in any file under `robustness/`.

# Appendix: full tables per host and variant

## Meta Muse Wonder 1.0 (wonder): ledger total spent $7.435 of cap $10.000

### Meta Muse Wonder 1.0: correcting note as written (9 journeys)

| Measure | Value |
|---|---|
| Journeys completed of attempted | 9 of 9 |
| Correction route | missed-then-correct-fact: 8; use-this-correction: 1 |
| Invariant 1 quotes verbatim | 9 of 9 evaluable |
| Invariant 2 within limits | 9 of 9 evaluable |
| Invariant 3 citations confirmed | 9 of 9 evaluable |
| Invariant 4 only citing sentences changed | 9 of 9 evaluable |
| Invariant 5 manual sentence intact | 9 of 9 evaluable |
| Invariant 6 approvals cleared and renewed | 9 of 9 evaluable |
| Invariant 7 export NOT SUBMITTED | 9 of 9 evaluable |
| Invariant 8 no 5xx or unhandled error | 9 of 9 evaluable |
| Invariant 9 no number outside cited facts | 9 of 9 evaluable |
| Median model-step latency | 11.1 s over 51 model steps |
| Worst model step | 54.9 s (ben: write both documents) |
| Cost per journey (sum of receipts) | median $0.425, min $0.306, max $0.596, total $3.785 |
| Wall time per journey | median 91.3 s, max 124.0 s |
| Step retries (Try again) | 0 across 9 journeys |
| Provider attempts / turns / tool calls | 176 / 176 / 195 |

| Persona | Style | Completed | Correction route | Invariants | Retries | Attempts | Tools | Tokens in/cached/out | Cost | Wall |
|---|---|---|---|---|---|---|---|---|---|---|
| aisha | notes with numbers that must not be invented | yes | missed-then-correct-fact | 9/9 | 0 | 15 | 20 | 45677/25548/11038 | $0.306 | 55.9 s |
| ben | notes with an internal contradiction | yes | missed-then-correct-fact | 9/9 | 0 | 28 | 25 | 73411/40112/22762 | $0.596 | 124.0 s |
| dev | notes missing the individual contribution (third person, passive) | yes | missed-then-correct-fact | 9/9 | 0 | 18 | 22 | 56070/30376/13240 | $0.374 | 62.9 s |
| ellie | the shipped sample (README judge journey) | yes | use-this-correction | 9/9 | 0 | 20 | 20 | 60013/23908/16446 | $0.478 | 107.1 s |
| hannah | notes that say only "we" | yes | missed-then-correct-fact | 9/9 | 0 | 22 | 26 | 66257/37624/15132 | $0.425 | 98.1 s |
| leo | very short notes | yes | missed-then-correct-fact | 9/9 | 0 | 18 | 14 | 38210/25384/13269 | $0.322 | 91.3 s |
| priya | terse bullet notes | yes | missed-then-correct-fact | 9/9 | 0 | 19 | 23 | 55212/26444/13850 | $0.397 | 106.7 s |
| tom | long rambling notes | yes | missed-then-correct-fact | 9/9 | 0 | 16 | 23 | 66279/30344/14692 | $0.444 | 76.8 s |
| yusuf | non-native English | yes | missed-then-correct-fact | 9/9 | 0 | 20 | 22 | 59644/31644/16224 | $0.443 | 90.1 s |

| Model step | Journeys | Median | Worst | Retried | Provider attempts (sum) | Tool calls (sum) |
|---|---|---|---|---|---|---|
| read the notes | 9 | 14.2 s | 19.7 s | 0 | 30 | 114 |
| check what the form still needs | 8 | 5.9 s | 11.2 s | 0 | 10 | 2 |
| write both documents | 9 | 35.9 s | 54.9 s | 0 | 73 | 27 |
| read the correcting note | 9 | 8.1 s | 17.1 s | 0 | 22 | 29 |
| propose the changes | 9 | 12.3 s | 33.1 s | 0 | 22 | 0 |
| read the answer | 7 | 8.1 s | 25.7 s | 0 | 19 | 23 |

#### Failures and findings, Meta Muse Wonder 1.0, correcting note as written

**aisha** (notes with numbers that must not be invented; question answered: none)

- no-question: the model asked nothing
- conflict-missed: the correcting note raised no conflict; 1 fact(s) were proposed from it instead Proposed as facts: ["Correction: the p95 on the order service went from 1.8 s to 400 ms, not 300 ms."]

**ben** (notes with an internal contradiction; question answered: contribution: "In the shared GPU box project for the game dev society, which parts did you personally build or do yourself, rather than Sara or Kofi?")

- conflict-missed: the correcting note raised no conflict; 1 fact(s) were proposed from it instead Proposed as facts: ["Correction: the migration took six weeks, not four."]
- skipped questions: motivation: "What about this role and this company appeals to you after your work on the shared GPU box for the game dev society?"
- loop decisions: check again: No question needed: 1 requirement will be left out of the drafts | write both documents: Revising 1 unsupported sentence | write both documents: Revising 1 unsupported sentence | write both documents: Adding your own contribution to the letter | propose the changes: Revising 2 unsupported repair sentences

**dev** (notes missing the individual contribution (third person, passive); question answered: contribution: "In the CI pipeline and preview environments project for the student startup in Bristol, which parts did you build or fix yourself?")

- conflict-missed: the correcting note raised no conflict; 2 fact(s) were proposed from it instead Proposed as facts: ["Lena wrote the integration-test job in the workflow.","I wrote the build and push jobs and set up the k3s server."]

**ellie** (the shipped sample (README judge journey); question answered: contribution: "In your final-year GPU job runner project, what did you personally work on or do yourself?")

- loop decisions: propose the changes: Revising 2 unsupported repair sentences

**hannah** (notes that say only "we"; question answered: contribution: "In your feature flag service project with Aoife, Dan and Priti, which parts did you personally build or work on?")

- conflict-missed: the correcting note raised no conflict; 2 fact(s) were proposed from it instead Proposed as facts: ["Aoife wrote the alert rules, not me.","I built the Grafana dashboards and ran the load tests."]
- loop decisions: write both documents: Adding your own contribution to the letter

**leo** (very short notes; question answered: contribution: "In setting up the three-node k3s cluster for the robotics society, what did you do yourself?")

- conflict-missed: the correcting note raised no conflict; 2 fact(s) were proposed from it instead Proposed as facts: ["Mira set up the cluster.","I wrote the containerd proxy fix."]
- needs-review: no usable rewrite for answer/answer-1: No supported rewrite was returned. Check this sentence against the corrected fact.
- skipped questions: decision: "When you set up the three-node k3s cluster on the old office desktops, what was one technical decision you made and why did you choose it?" | motivation: "Thinking about your work on the robotics society k3s cluster, why do you want this role and this company in your own words?"
- loop decisions: check again: No question needed: 2 requirements will be left out of the drafts

**priya** (terse bullet notes; question answered: contribution: "In your Brightwater Analytics placement, where you moved the nightly risk batch jobs to EKS with Mateo and Jen, which parts did you personally do yourself?")

- conflict-missed: the correcting note raised no conflict; 2 fact(s) were proposed from it instead Proposed as facts: ["Mateo wrote the Karpenter autoscaler config, not me.","I wrote the Terraform modules for the node pools and reviewed his autoscaler change."]

**tom** (long rambling notes; question answered: none)

- no-question: the model asked nothing
- conflict-missed: the correcting note raised no conflict; 2 fact(s) were proposed from it instead Proposed as facts: ["Correction: I set up the Tailscale mesh myself.","Josh only lent me the second mini PC's RAM."]

**yusuf** (non-native English; question answered: contribution: "In your group of four students' Ansible automation project for the computer science department, which part did you personally do?")

- conflict-missed: the correcting note raised no conflict; 3 fact(s) were proposed from it instead Proposed as facts: ["the certificate problem was found by my friend Emre from the web server logs","I wrote the Ansible playbooks","I tested the permission fix"]
- loop decisions: write both documents: Revising 1 unsupported sentence

### Meta Muse Wonder 1.0: correcting note plain (9 journeys)

| Measure | Value |
|---|---|
| Journeys completed of attempted | 8 of 9 |
| Correction route | missed-then-correct-fact: 1; use-this-correction: 4; skip-then-correct-fact: 4 |
| Invariant 1 quotes verbatim | 9 of 9 evaluable |
| Invariant 2 within limits | 9 of 9 evaluable |
| Invariant 3 citations confirmed | 7 of 8 evaluable (1 not reached) |
| Invariant 4 only citing sentences changed | 8 of 8 evaluable (1 not reached) |
| Invariant 5 manual sentence intact | 8 of 8 evaluable (1 not reached) |
| Invariant 6 approvals cleared and renewed | 8 of 9 evaluable |
| Invariant 7 export NOT SUBMITTED | 8 of 8 evaluable (1 not reached) |
| Invariant 8 no 5xx or unhandled error | 8 of 9 evaluable |
| Invariant 9 no number outside cited facts | 8 of 8 evaluable (1 not reached) |
| Median model-step latency | 12.8 s over 50 model steps |
| Worst model step | 51.1 s (leo: propose the changes) |
| Cost per journey (sum of receipts) | median $0.401, min $0.346, max $0.481, total $3.567 |
| Wall time per journey | median 81.4 s, max 121.1 s |
| Step retries (Try again) | 0 across 9 journeys |
| Provider attempts / turns / tool calls | 160 / 160 / 195 |

| Persona | Style | Completed | Correction route | Invariants | Retries | Attempts | Tools | Tokens in/cached/out | Cost | Wall |
|---|---|---|---|---|---|---|---|---|---|---|
| aisha | notes with numbers that must not be invented | yes | missed-then-correct-fact | 9/9 | 0 | 14 | 24 | 47484/24664/12675 | $0.350 | 63.3 s |
| ben | notes with an internal contradiction | yes | use-this-correction | 9/9 | 0 | 20 | 27 | 62201/35472/16097 | $0.436 | 94.1 s |
| dev | notes missing the individual contribution (third person, passive) | yes | skip-then-correct-fact | 9/9 | 0 | 17 | 22 | 51397/26164/13545 | $0.377 | 61.2 s |
| hannah | notes that say only "we" | yes | skip-then-correct-fact | 8/9 (failed 3) | 0 | 18 | 26 | 49957/28328/13290 | $0.358 | 74.4 s |
| leo (rerun) | very short notes | yes | use-this-correction | 9/9 | 0 | 19 | 17 | 40692/22440/16944 | $0.416 | 121.1 s |
| leo | very short notes | no (propose the changes: incomplete) | skip-then-correct-fact | 2/9 (failed 6, 8) (5 not reached) | 0 | 18 | 15 | 39329/23720/13931 | $0.346 | 115.2 s |
| priya | terse bullet notes | yes | skip-then-correct-fact | 9/9 | 0 | 19 | 23 | 55494/29236/14500 | $0.401 | 77.7 s |
| tom | long rambling notes | yes | use-this-correction | 9/9 | 0 | 16 | 20 | 55021/25944/14004 | $0.402 | 81.4 s |
| yusuf | non-native English | yes | use-this-correction | 9/9 | 0 | 19 | 21 | 56749/29596/18333 | $0.481 | 115.7 s |

| Model step | Journeys | Median | Worst | Retried | Provider attempts (sum) | Tool calls (sum) |
|---|---|---|---|---|---|---|
| read the notes | 9 | 13.6 s | 19.9 s | 0 | 28 | 116 |
| write both documents | 9 | 30.8 s | 48.4 s | 0 | 60 | 22 |
| read the correcting note | 9 | 6.0 s | 7.6 s | 0 | 18 | 26 |
| propose the changes | 9 | 18.6 s | 51.1 s | 0 | 22 | 0 |
| check what the form still needs | 7 | 6.3 s | 18.5 s | 0 | 12 | 5 |
| read the answer | 7 | 7.3 s | 12.9 s | 0 | 20 | 26 |

#### Failures and findings, Meta Muse Wonder 1.0, correcting note plain

**aisha** (notes with numbers that must not be invented; question answered: none)

- no-question: the model asked nothing
- conflict-missed: the correcting note raised no conflict; 1 fact(s) were proposed from it instead Proposed as facts: ["The p95 on the order service went from 1.8 s to 400 ms, not 300 ms."]

**ben** (notes with an internal contradiction; question answered: contribution: "In the shared GPU box project for the university game dev society in Newcastle, which parts did you personally build, configure or troubleshoot?")

- skipped questions: motivation: "Why do you want this role and this company, in your own words?"
- loop decisions: check again: No question needed: 1 requirement will be left out of the drafts

**dev** (notes missing the individual contribution (third person, passive); question answered: contribution: "In the CI pipeline and preview environments project for the student startup's web app, which parts did you personally build or change?")

- no-correction-offer: the conflict was raised but "Use this correction" was not offered (the earlier quote did not match exactly one confirmed fact) Earlier: "I wrote the GitHub Actions workflow that builds the images and runs the integration tests, and I set up the k3s server."

**hannah** (notes that say only "we"; question answered: contribution: "In your feature flag service project with Aoife, Dan and Priti, what part of the work did you personally do?")

- no-correction-offer: the conflict was raised but "Use this correction" was not offered (the earlier quote did not match exactly one confirmed fact) Earlier: "I built the Grafana dashboards and the alert rules, and I ran the load tests that found the connection limit."
- needs-review: no usable rewrite for answer/answer-13: 
- needs-review: no usable rewrite for letter/letter-7: 
- invariant 3 citations confirmed FAILED: {"sentences":25,"badCitations":[],"uncitedClaims":["answer/answer-13","letter/letter-7"]}

**leo (rerun)** (very short notes; question answered: contribution: "What did you personally do in setting up the robotics society k3s cluster and fixing the image-pull problem?")

- skipped questions: decision: "Why did you choose k3s and three nodes for the robotics society cluster on the old office desktops?" | motivation: "In your own words, why do you want this role and this company?"
- loop decisions: check again: No question needed: 2 requirements will be left out of the drafts | propose the changes: Revising 1 unsupported repair sentence

**leo** (very short notes; question answered: contribution: "In the robotics society k3s cluster project, what did you do yourself rather than as part of the team?")

- ABORTED at step "propose the changes": `incomplete`: incomplete: The answer was cut short (max_output_tokens). Nothing was changed.
- receipt revise in "propose the changes" recorded error `incomplete` (attempts 0, cost $0.000)
- no-correction-offer: the conflict was raised but "Use this correction" was not offered (the earlier quote did not match exactly one confirmed fact) Earlier: "I set up the cluster and wrote the containerd proxy fix; the other members ran their jobs on it."
- invariant 6 approvals cleared and renewed FAILED: {"afterFirstApproval":{"answer":"approved","letter":"approved"},"afterCorrectingNote":{"answer":"none","letter":"none"},"afterCorrection":{"answer":"none","letter":"none"}}
- invariant 8 no 5xx or unhandled error FAILED: {"http5xx":[],"streamed5xxClass":["propose the changes: incomplete"],"unhandled":0}
- skipped questions: decision: "Why did you choose k3s for the three-node cluster on the old office desktops for the robotics society?" | motivation: "Why do you want this role at this company, in your own words?"
- loop decisions: check again: No question needed: 2 requirements will be left out of the drafts | propose the changes: Revising 2 unsupported repair sentences

**priya** (terse bullet notes; question answered: contribution: "In the move of the nightly risk batch jobs onto EKS at Brightwater Analytics, which parts did you do yourself rather than Mateo or Jen?")

- no-correction-offer: the conflict was raised but "Use this correction" was not offered (the earlier quote did not match exactly one confirmed fact) Earlier: "I wrote the Terraform modules for the node pools and the Karpenter autoscaler config myself, and Mateo reviewed them."

**tom** (long rambling notes; question answered: none)

- no-question: the model asked nothing
- loop decisions: write both documents: Revising 1 unsupported sentence

**yusuf** (non-native English; question answered: contribution: "In your group of four students' Ansible automation project for the computer science department, what did you do yourself?")

- loop decisions: propose the changes: Revising 1 unsupported repair sentence

## Meta Muse Spark Open on Modal (modal): ledger total spent $0.259 of cap $3.000

### Meta Muse Spark Open on Modal: correcting note as written (2 journeys)

| Measure | Value |
|---|---|
| Journeys completed of attempted | 2 of 2 |
| Correction route | use-this-correction: 1; missed-then-correct-fact: 1 |
| Invariant 1 quotes verbatim | 2 of 2 evaluable |
| Invariant 2 within limits | 2 of 2 evaluable |
| Invariant 3 citations confirmed | 2 of 2 evaluable |
| Invariant 4 only citing sentences changed | 2 of 2 evaluable |
| Invariant 5 manual sentence intact | 2 of 2 evaluable |
| Invariant 6 approvals cleared and renewed | 2 of 2 evaluable |
| Invariant 7 export NOT SUBMITTED | 2 of 2 evaluable |
| Invariant 8 no 5xx or unhandled error | 2 of 2 evaluable |
| Invariant 9 no number outside cited facts | 2 of 2 evaluable |
| Median model-step latency | 4.8 s over 12 model steps |
| Worst model step | 36.6 s (ellie: propose the changes) |
| Cost per journey (sum of receipts) | median $0.130, min $0.127, max $0.132, total $0.259 |
| Wall time per journey | median 69.1 s, max 79.5 s |
| Step retries (Try again) | 0 across 2 journeys |
| Provider attempts / turns / tool calls | 22 / 22 / 0 |

| Persona | Style | Completed | Correction route | Invariants | Retries | Attempts | Tools | Tokens in/cached/out | Cost | Wall |
|---|---|---|---|---|---|---|---|---|---|---|
| ellie | the shipped sample (README judge journey) | yes | use-this-correction | 9/9 | 0 | 12 | 0 | 27634/0/23025 | $0.132 | 79.5 s |
| priya | terse bullet notes | yes | missed-then-correct-fact | 9/9 | 0 | 10 | 0 | 22126/0/23386 | $0.127 | 58.7 s |

| Model step | Journeys | Median | Worst | Retried | Provider attempts (sum) | Tool calls (sum) |
|---|---|---|---|---|---|---|
| read the notes | 2 | 3.8 s | 4.2 s | 0 | 2 | 0 |
| check what the form still needs | 2 | 5.1 s | 5.4 s | 0 | 2 | 0 |
| read the answer | 2 | 1.5 s | 1.6 s | 0 | 2 | 0 |
| write both documents | 2 | 31.9 s | 36.3 s | 0 | 8 | 0 |
| read the correcting note | 2 | 3.3 s | 4.8 s | 0 | 2 | 0 |
| propose the changes | 2 | 23.4 s | 36.6 s | 0 | 6 | 0 |

#### Failures and findings, Meta Muse Spark Open on Modal, correcting note as written

**ellie** (the shipped sample (README judge journey); question answered: contribution: "On your final-year GPU job runner for the department's machine learning teaching cluster, what part did you personally own or build within the group of four?")

- loop decisions: propose the changes: Revising 2 unsupported repair sentences

**priya** (terse bullet notes; question answered: contribution: "On the Brightwater EKS migration with Mateo and Jen, what did you personally build or own yourself?")

- conflict-missed: the correcting note raised no conflict; 2 fact(s) were proposed from it instead Proposed as facts: ["Mateo wrote the Karpenter autoscaler config, not me.","I wrote the Terraform modules for the node pools and reviewed his autoscaler change."]
- skipped questions: decision: "For the nightly risk batch move to EKS at Brightwater, why did you choose spot instances for the batch pool and on-demand for the Argo controller?"
- loop decisions: check again: No question needed: 1 requirement will be left out of the drafts

## Meta Muse Spark Open via Baseten (baseten): ledger total spent $0.328 of cap $3.000

### Meta Muse Spark Open via Baseten: correcting note as written (2 journeys)

| Measure | Value |
|---|---|
| Journeys completed of attempted | 2 of 2 |
| Correction route | use-this-correction: 1; missed-then-correct-fact: 1 |
| Invariant 1 quotes verbatim | 2 of 2 evaluable |
| Invariant 2 within limits | 2 of 2 evaluable |
| Invariant 3 citations confirmed | 2 of 2 evaluable |
| Invariant 4 only citing sentences changed | 2 of 2 evaluable |
| Invariant 5 manual sentence intact | 2 of 2 evaluable |
| Invariant 6 approvals cleared and renewed | 2 of 2 evaluable |
| Invariant 7 export NOT SUBMITTED | 2 of 2 evaluable |
| Invariant 8 no 5xx or unhandled error | 2 of 2 evaluable |
| Invariant 9 no number outside cited facts | 1 of 2 evaluable |
| Median model-step latency | 4.2 s over 12 model steps |
| Worst model step | 49.0 s (ellie: write both documents) |
| Cost per journey (sum of receipts) | median $0.164, min $0.140, max $0.188, total $0.328 |
| Wall time per journey | median 79.9 s, max 90.7 s |
| Step retries (Try again) | 0 across 2 journeys |
| Provider attempts / turns / tool calls | 32 / 32 / 0 |

| Persona | Style | Completed | Correction route | Invariants | Retries | Attempts | Tools | Tokens in/cached/out | Cost | Wall |
|---|---|---|---|---|---|---|---|---|---|---|
| ellie | the shipped sample (README judge journey) | yes | use-this-correction | 9/9 | 0 | 16 | 0 | 32260/8960/37112 | $0.188 | 90.7 s |
| priya | terse bullet notes | yes | missed-then-correct-fact | 8/9 (failed 9) | 0 | 16 | 0 | 29419/8320/26467 | $0.140 | 69.2 s |

| Model step | Journeys | Median | Worst | Retried | Provider attempts (sum) | Tool calls (sum) |
|---|---|---|---|---|---|---|
| read the notes | 2 | 3.2 s | 3.5 s | 0 | 2 | 0 |
| check what the form still needs | 2 | 5.2 s | 5.4 s | 0 | 2 | 0 |
| read the answer | 2 | 1.5 s | 1.7 s | 0 | 2 | 0 |
| write both documents | 2 | 40.0 s | 49.0 s | 0 | 16 | 0 |
| read the correcting note | 2 | 2.8 s | 3.2 s | 0 | 2 | 0 |
| propose the changes | 2 | 27.1 s | 28.7 s | 0 | 8 | 0 |

#### Failures and findings, Meta Muse Spark Open via Baseten, correcting note as written

**ellie** (the shipped sample (README judge journey); question answered: contribution: "For your GPU job runner on the six-workstation k3s cluster, what did you personally build or own yourself?")

- loop decisions: write both documents: Adding your own contribution to the letter | write both documents: Revising 1 unsupported sentence | propose the changes: Revising 1 unsupported repair sentence

**priya** (terse bullet notes; question answered: contribution: "On your Brightwater Analytics project moving nightly risk batch jobs to EKS with Mateo and Jen, what did you personally do (using "I")?")

- conflict-missed: the correcting note raised no conflict; 2 fact(s) were proposed from it instead Proposed as facts: ["Mateo wrote the Karpenter autoscaler config, not me.","I wrote the Terraform modules for the node pools and reviewed his autoscaler change."]
- invariant 9 no number outside cited facts FAILED: {"checked":14,"flagged":[{"sentence":"answer/answer-2","text":"We worked as a team of three comprising me and two platform engineers, Mateo and Jen.","numbers":["3"],"cited":["team: me + 2 platform engineers (Mateo, Jen)"]}]}
- skipped questions: decision: "For your Brightwater Analytics EKS migration, what was your reasoning for choosing spot instances for the batch pool and on-demand for the Argo controller?"
- loop decisions: check again: No question needed: 1 requirement will be left out of the drafts | write both documents: Adding your own contribution to the letter | write both documents: Revising 1 unsupported sentence | propose the changes: Revising 1 unsupported repair sentence

