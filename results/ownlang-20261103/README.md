# The own-language build, 3 November 2026

Ana's Portuguese path, built and measured on 3 November 2026, from about 19:03 UTC to `a859bf8` at 23:42 UTC. Ana is fictional and her three clips are synthetic. Costs are token-priced estimates from the receipts, not invoices. Every failure is kept. Home-folder paths in these logs and records are shown as `~/`, and the build machine's temporary folder as `<tmp>/`: they were rewritten before publication, and nothing else in the files was changed. The reports are kept as they were written during the build; names of development-only services are withheld and marked, as in the build log.

The commit hashes in these files come from the build's working repository. Two of them carry the same source tree as commits in this repository: `1983147` is `a859bf8` (on both live links from 3 November, 23:54 UTC, until `b8902ae` and then `0399f93` replaced it on 4 November) and `13615c3` is `d87dd35`.

| Path | What it holds |
|---|---|
| `PROBE.md` | The probe on the unchanged engine (19:03 to 19:50 UTC), Portuguese and Polish |
| `BUILD-REPORT.md` | The build stage (19:57 to 20:55 UTC): tests, the first three Muse Wonder journeys, clip measurements, failures and causes |
| `KEYWORDS-TEST.md`, `keywords-test.jsonl` | The Voice Transcribe keywords test (about 21:05 UTC) |
| `FIXES-REPORT.md` | The fix stage (21:13 to 22:00 UTC): findings, commits, break checks, the re-voiced clip, the 21:40 journey |
| `REVIEW.md` | A code review of the build stage, kept as written |
| `baseline/`, `after/`, `ellie/` | The base build's tests, prompt and schema hashes, and Ellie's fixture journey before and after, normalised |
| `live/runs/` | Journeys `ana-1` to `ana-3` (20:36 to 20:40 UTC), an earlier run on the old prompt, key moments for Ana and Ellie, `summary.json` |
| `live/try-1` to `try-3` | The three earlier journeys (19:36 to 19:43 UTC) |
| `live/run-fixed-transcript/` | The 22:03 to 22:08 UTC journey whose transcript was checked and fixed first; its state is Ana's prepared key moment (`fixtures/ana-prepared-wonder-20261103.json`) |
| `live/run-fixed-km/` | That prepared key moment run through the API at 22:09 UTC: 25.8 s, $0.0703, 2 reopened, Verify 7 of 7 |
| `live/clip-*.json`, `hint-check.json` | Clip and language-hint measurements |
| `fix/` | The fix stage's commit checks, journeys, the 21:40 journey (`fix/live/run-1`), the 21:43 key moment (`fix/live/ana-km-1`), the keywords re-check (`kw-check.json`) and browser passes |
| `spark/` | Ana's journey on Muse Spark Open via Modal and the keep-warm check |
| `ui/`, `screens/` | Browser passes at 1440 and 390 px, fixture and live, with their screens |
| `break/` | The build stage's break checks |
| `polish/` | The last changes before `a859bf8` (see below) |
| `final-vitest.log`, `final-build.log` | The build stage's final test and build logs |

## `polish/`: the changes after the live judge scenarios

- `base-vitest.log`, `final-vitest.log`, `final-build.log`: 198 files and 1,222 tests before; 200 files and 1,252 tests after; the build that produced `index-B3nTXPTT.js` and `index-TYu-XHW3.css`.
- `break-checks.log`: six changes undone one at a time; each made its tests fail, and each passed again once restored, with the files byte-identical.
- `journey-13615c3.*`, `journey-1983147.*`: Ellie's fixture journey before and after; the normalised outputs are identical. `journey-1983147-ana.log`: the same script pointed at Ana's sample stopped at `changeFact`, because the app asked for the English meaning of the correction, which that script does not send; Ana's fixture journey runs inside the test suite (`test/ownlang.ana.test.js`) instead.
- `ui-1440.log`, `ui-390.log`, `ui/`: a local browser pass at 1440 and 390 px with a few of its screens, the pack and the Evidence Pass. Screens marked `REPLAYED` replay a recorded transcript with repeated words, to show **Remove the repeats**.
- `live-spark-1.log`, `live-spark-1/`: Ana's key moment on Muse Spark Open from a local server before the deploy: read as new facts, **Correct this fact**, Verify 7 of 7. `spark-warm-1.json`: the keep-warm check (HTTP 200).

The Spark Open receipts in `spark/` name the Modal endpoint's host; that is an address, not a secret.
