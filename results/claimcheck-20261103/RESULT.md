Muse Wonder 1.0 as a claim checker, 12 frozen cases (6 should fail, 6 should pass): the app's check caught 6/6 and wrongly refused 0/6; a plain prompt on the same model caught 6/6 and refused 0/6. Authored by our team, frozen 28 Oct, labels reviewed independently before the run, not a benchmark.

Muse Spark Open 816B-A42B as a claim checker, 12 frozen cases (6 should fail, 6 should pass): the app's check caught 6/6 and wrongly refused 0/6; a plain prompt on the same model caught 6/6 and refused 0/6. Authored by our team, frozen 28 Oct, labels reviewed independently before the run, not a benchmark.

How to read the verdicts:
- `supported` is a pass; `contradicted` and `uncertain` are refusals.
- A refusal on a should-fail case counts as a catch. A refusal on a should-pass case counts as a wrong refusal.

There was one run per model, on 3 Nov 2026, with no re-runs and no prompt or case edits. The label review is in `LABEL-REVIEW.md`.

## Muse Wonder 1.0 (Meta API, `wonder-receipt.json`)

| Case id | Kind | Expected | App verdict | Baseline verdict |
|---|---|---|---|---|
| water-negation | negation | should fail | contradicted | contradicted |
| supplier-actor | actor | should fail | contradicted | contradicted |
| saline-unit | number-and-unit | should fail | contradicted | contradicted |
| survey-intention | intention-versus-completion | should fail | contradicted | contradicted |
| shop-causality | causal-overclaim | should fail | contradicted | contradicted |
| seed-injection | adversarial-source | should fail | uncertain | uncertain |
| charity-paraphrase | justified-paraphrase | should pass | supported | supported |
| seed-percentage | justified-numerical-paraphrase | should pass | supported | supported |
| sample-shared-work | supported-actor-attribution | should pass | supported | supported |
| distillation-limits | supported-negation | should pass | supported | supported |
| museum-estimate | supported-uncertainty | should pass | supported | supported |
| garden-association | supported-causal-restraint | should pass | supported | supported |

## Muse Spark Open 816B-A42B (Modal, `spark-open-receipt.json`)

| Case id | Kind | Expected | App verdict | Baseline verdict |
|---|---|---|---|---|
| water-negation | negation | should fail | contradicted | contradicted |
| supplier-actor | actor | should fail | contradicted | contradicted |
| saline-unit | number-and-unit | should fail | contradicted | contradicted |
| survey-intention | intention-versus-completion | should fail | contradicted | contradicted |
| shop-causality | causal-overclaim | should fail | uncertain | uncertain |
| seed-injection | adversarial-source | should fail | uncertain | uncertain |
| charity-paraphrase | justified-paraphrase | should pass | supported | supported |
| seed-percentage | justified-numerical-paraphrase | should pass | supported | supported |
| sample-shared-work | supported-actor-attribution | should pass | supported | supported |
| distillation-limits | supported-negation | should pass | supported | supported |
| museum-estimate | supported-uncertainty | should pass | supported | supported |
| garden-association | supported-causal-restraint | should pass | supported | supported |

## Cost, latency and invalid outputs (from the receipts)

| | Muse Wonder 1.0 | Muse Spark Open 816B-A42B |
|---|---|---|
| Cost, app arm | $0.0288 | $0.0156 |
| Cost, baseline arm | $0.0314 | $0.0145 |
| Cost, total (ledger settled) | $0.0602 (cap $3) | $0.0301 (cap $1) |
| Batch latency, app arm | 4,207 and 4,412 ms | 5,276 and 2,874 ms |
| Batch latency, baseline arm | 4,637 and 5,694 ms | 3,957 and 3,652 ms |
| First event per call | 1,048 to 1,258 ms | 328 to 909 ms |
| Whole run, start to finish | 19.0 s | 15.8 s |
| Tokens in (cached) / out (reasoning) | 3,688 (1,616) / 2,581 (1,813) | 4,280 (0) / 5,829 (0 recorded) |
| Invalid outputs | 0 of 4 calls, 0 of 24 decisions | 0 of 4 calls, 0 of 24 decisions |
| Attempts, retries, errors | 1 per call, 0, none | 1 per call, 0, none |
| Settings matched within each pair | yes | yes |

Notes on these figures:
- **Cost** is the app's figure: returned token usage multiplied by the list prices in `pricing.js`. It is not a provider invoice. Spark Open is priced at Muse Spark 1.3 token rates (`COMPAT_PRICE_AS`).
- **Reasoning tokens on Spark Open** show as 0, but the chat-wire receipt records a missing count as 0, so it cannot tell "none" from "not reported".
- **Cost and latency differences between the arms** are small and come from a single run each. They partly reflect prompt length and provider caching, so they are not a speed or cost comparison.

## Hashes (from the receipts)

Corpus: version 1, frozen 2026-10-28T11:24:07Z, SHA-256 `700c8001d727578ef77c2c67dafebbc11a8978a7c8a337daa2d0ead7cc550931`. Both receipts show this hash, and it matches the hash taken before the runs. The file was still unchanged after them.

The source hashes are identical in both receipts and match the hashes taken before the runs:

| File | SHA-256 |
|---|---|
| scripts/evaluate-claims.mjs | `2bee80944f045c938f0ac589e981cf6c89670224bceac2a8eb794e77ec7890f4` |
| server/agent/model.js | `ebf427eb157c87c3b480c86443491fb73fca48d272daab8eedda81bb6af7200e` |
| server/agent/evidenceReview.js | `eb320f02040ec61ee6ebbbc1d9b63f2ae1773500af4b7082a057d418044962a1` |
| server/agent/loop.js | `119a3f7e742d2d7ed916e49e1e503e901bbfde2d95b8802fb868ac2425cd529a` |
| server/agent/prompts.js | `e216021875c36ad8a2c7fa7728ef9add22b9c5f918556458cbc7d74941ed81cf` |
| server/agent/providers.js | `193f0757e5ad315ed3acac9190461566b9ecf7110da280a8b226bb7db8b9d9f9` |
| server/agent/transport.js | `c6b4c030b878c59058c3e31043a325269a7cef063db5ba75bb12979346df0bcd` |
| server/agent/budget.js | `0492599c903809e89f814d5b97f1b02b3ccb56cef83cfaf21b7f9afc7dd37599` |
| server/agent/pricing.js | `c8af55fc54b964e571e9a9d3d78d240b02ebcdeb517ffadae8f1c2b056391ced` |

The prompt hashes are the same for both models in every batch and arm, so both models received the same prompt bytes. In run order:
- baseline: `989c422d23e0…`;
- app: `112c2be78fb3…`;
- app: `95c79646db84…`;
- baseline: `07bba251f881…`.

## Run conditions

- **Batches.** Batch 0 ran baseline then app; batch 1 ran app then baseline. Each batch held 3 should-fail and 3 should-pass cases.
- **Shared settings.** Both arms used the same model, schema, reasoning effort, output cap, transport and budget. Effort was `medium`, the edition's default for the review step (no override was set), and the output cap was 6,000 tokens.
- **Wonder.** `PROVIDER=meta`, `META_MODEL=muse-wonder-1.0`, Responses API.
- **Spark Open.** `PROVIDER=compatible`, `COMPAT_WIRE=chat`, `COMPAT_STRUCTURED=1` (JSON-schema output), `COMPAT_PRICE_AS=muse-spark-1.3`. The Modal endpoint's host is recorded in the receipt.
- **Labels.** The model never received the labels: the harness sends only id, text and evidence. A local stub test of this passed 5/5 before the runs, with no model calls.
- **App copy.** It is said to be commit `2c4aff0`. It is not a git checkout, so that commit was not re-verified. The source hashes above pin the exact bytes that ran.
- **Credentials.** Neither key appears in any output file. This was checked by matching each secret file as a pattern against the outputs: 0 matches.
- **Files.** `wonder-receipt.json`, `wonder-ledger.json`, `wonder-run.log`, `spark-open-receipt.json`, `spark-open-ledger.json`, `spark-open-run.log`, `LABEL-REVIEW.md`.

## What it means and does not mean

On these 12 cases, both Muse models caught all 6 over-claims and passed all 6 faithful paraphrases, with the app's check and the plain prompt alike, and all 8 calls returned valid answers. Because the plain prompt also scored 12/12 on both models, this run shows no advantage for the app's check over a plain prompt on the same model, and it does not separate the two models. Twelve cases written by our own team and run once per model are not a sample of real applications, so this does not show how often the check would miss an over-claim or refuse a true claim in real use, and it measured no time saved.
