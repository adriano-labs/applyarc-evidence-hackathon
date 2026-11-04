# The live builds of 3 and 4 November 2026, and the live checks on them

When these records were made, both live links ran source `541283d` (both now run `e4d6099`, which is `3ee23f2` plus the two PR #13 fixes). Before it, `a859bf8` ran from 3 November, 23:54 UTC; on 4 November, after a double check of the live links, the film script, the docs, the rules and the polish code (each finding then checked by a second reviewer), `b8902ae` replaced it, `0399f93` replaced that the same morning, and `541283d` followed the founder's final judge pass in the afternoon. The applicants are fictional and Ana's voice is synthetic. Costs are token-priced estimates from the receipts, not invoices. Home-folder paths in these logs and records are shown as `~/`, and the build machine's temporary folder as `<tmp>/`: they were rewritten before publication, and nothing else in the files was changed.

## What changed after `a859bf8`

- `b8902ae`: after her note is read as new facts, **Correct this fact** is the main button, and before those facts are checked it can set them aside, so the correction is listed once; repeats of up to three words ("pessoa poder pessoa poder", which reached the pack and the Evidence Pass on `a859bf8`) are named on the transcript, the spoken answer and the spoken correction, and **Remove the repeats** takes them out in one tap, never silently; the full workspace and the typed route show the plain English meaning, without "Correction:"; on the open link the Evidence Pass credits Muse Wonder for the drafts prepared before the visit and Muse Spark Open for the correction and repair; the walk-through tag reads "nothing is submitted"; a paid call under half a cent shows as "< $0.01".
- `0399f93` (two commits on `b8902ae`): the offer above her note's facts keeps clear of the fact card; below 420 px the spend pill is hidden, so the phone bar keeps two rows; the downloaded trace starts `"status": "NOT SUBMITTED"`; and the form check gets the reading step's 8,000-token output budget, after Muse Spark Open's check answer was cut short at 4,000 tokens on the open link (`footage/record-live-4.log`, 4 November, the step starting 08:25:08 UTC; the app said so and offered **Try again**).

- `541283d` (one commit on `0399f93`): the finish screen runs **Verify this run** by itself on arrival and after each export, so the key-moment route shows its result; the rewrite in progress reads **Rewriting…** / **Reviewing…** with a turning mark; her spoken note's **Add** button appears only once there is text, and the remembered correction is offered as **Show the written correction**; the top bar no longer shows the demo spend (each run's cost stays in What Meta did).

## Release record of `541283d`, `0399f93` and `b8902ae` (`release/`)

- `release-541283d.log`: revisions `applyarc-evidence--final6-541283d` (Muse Wonder, `SPEND_CAP_USD` 78) and `applyarc-evidence-open--openfinal6-541283d` (Muse Spark Open via Modal), image `sha256:07ce307a645b31a2781ec7e2e9aa7846df75046290112ff7dd655501230585b2`; on both links the served `index-BqT4FJGp.js` and `index-DUZgOJDQ.css` match the production build of that source. `digest-541283d.txt`, `image-push-541283d.log`, `vite-build-541283d.log`. `clean-541283d-*`: a clean `git archive` with a locked install passed 201 test files and 1,260 tests, the build, the 19-step fixture journey and a no-key start (HTTP 200).

- `release-0399f93.log`: revisions `applyarc-evidence--final5-0399f93` (Muse Wonder, `SPEND_CAP_USD` 78) and `applyarc-evidence-open--openfinal5-0399f93` (Muse Spark Open via Modal), both on image `applyarc-evidence@sha256:c206f24724cbd1bcff0f2e39425771e52f8f7faf1300d88c3819046d557bd4ce`; on both links the served `index-CTfHWkk0.js` and `index-BxQybPeM.css` match the production build of that source. `digest-0399f93.txt`, `image-push-0399f93.log` (pushed 4 November, 08:35:00 UTC), `vite-build-0399f93.log`. `clean-0399f93-*`: a clean `git archive` with a locked install passed 201 test files and 1,259 tests, the build, the 19-step fixture journey and a no-key start (HTTP 200).
- `release-b8902ae.log`: revisions `applyarc-evidence--final4-b8902ae` and `applyarc-evidence-open--openfinal4-b8902ae`, image `sha256:66b83a9a0a7aa69e8fcca557975ec7f8f941d5dd4898980bbb169489a95a7110`, served `index-Bfmij_WL.js` and `index-BlbJJtEb.css` matching its build; pushed 08:17:34 UTC; `clean-b8902ae-*`: 201 files, 1,259 tests, build, journey, no-key start.

## Live checks on `541283d` (`live-541283d/`)

| Folder | When (4 Nov, UTC) | What | Result |
|---|---|---|---|
| `ana-km/` | 12:59 | Ana's key moment on the main link, through the app's API | Contradiction asked in Portuguese; 2 reopened; Verify 7 of 7; 30.5 s; $0.0809 |
| `ellie-km/` | 13:00 | Ellie's key moment on the main link | Contradiction asked; 2 reopened; Verify 7 of 7; 52.9 s; $0.1521 |
| `spark-full-1/` | 13:24 | Ana's full journey on the open link (Muse Spark Open on Modal), her written note, through the app's API | 13 model steps, 13 Modal request ids; Verify 7 of 7; NOT SUBMITTED; 150.1 s; $0.1281 |
| `spark-full-2/` | 13:27 | The same, again | 9 model steps, 9 Modal request ids; Verify 7 of 7; NOT SUBMITTED; 130.5 s; $0.0969 |
| `open-km/` | finished 13:25 | Ana's key moment on the open link, in a browser at 1440 px | Spark Open flagged the contradiction itself, in Portuguese; she kept the earlier account; **Correct this fact**; 2 sentences reopened across both documents, 40 untouched; Verify 7 of 7; 3 model steps; $0.0235 |
| `open-km-attempt1/`, `-attempt2/`, `-attempt3/` | finished 13:01, 13:10 and 13:23 | The same check, kept | 1 and 2: the script pressed **Keep the earlier account** again while the card was closing and timed out; 3: Verify 7 of 7, then the script's last screenshot matched two Verify panels (the finish screen's is new) |

## Live checks on `0399f93` (`live-0399f93/`) and `b8902ae` (`live-b8902ae/`)

Scripted through the app's own API against the live links, except `open-km`, which drove a browser at 1440 px.

| Folder | When (4 Nov, UTC) | What | Result |
|---|---|---|---|
| `live-0399f93/ana-km/` | 08:36 | Ana's key moment on the main link, from the state prepared at 22:03 to 22:08 UTC on 3 November | Her correction heard; contradiction asked in Portuguese; 2 reopened; Verify 7 of 7; 4 model steps; 33.9 s; $0.0666 |
| `live-0399f93/ellie-km/` | 08:37 | Ellie's key moment on the main link | Contradiction asked; 2 reopened; Verify 7 of 7; 6 model steps; 47.7 s; $0.1132 |
| `live-0399f93/open-km/` | 08:37 to 08:38 | Ana's key moment on the open link | Muse Spark Open read her note as new facts; the screen said so and **Correct this fact** led; 2 sentences reopened across both documents, 40 untouched; Verify 7 of 7; 3 model steps; 19 s; $0.0252 |
| `live-b8902ae/ana-km/` | 08:19 | As above, on `b8902ae` | Contradiction asked in Portuguese; 2 reopened; Verify 7 of 7; 34.2 s; $0.0773 |
| `live-b8902ae/ellie-km/` | 08:20 | As above | Contradiction asked; 2 reopened; Verify 7 of 7; 48.5 s; $0.1226 |
| `live-b8902ae/open-km/` | 08:21 | As above; its screens show the new offer before her note's facts are checked | Read as new facts; **Correct this fact**; 2 reopened, 40 untouched; Verify 7 of 7; 3 model steps; $0.0223 |

## The film's footage (`footage/`)

- `record-live-7.log`: the footage the film uses, recorded on `541283d` from the live links: the main link 16 of 16 steps (13:09:58 to 13:14:52 UTC) and the open link 7 of 7 (13:14:54 to 13:19:16 UTC). `live-7-main-trace.json` is the trace downloaded in that run (13 model steps: 3 Muse Voice Transcribe, 10 Muse Wonder; 24 tool calls; 17 Meta request ids; $0.401; `"status": "NOT SUBMITTED"`) and `live-7-main-evidence-pass.html` its Evidence Pass. `record-live-6.log` (13:01:21 to 13:08:16 UTC, `541283d`): the main run stopped at step 15, where the recorder pressed the finish screen's new **Verify this run** button instead of the drawer's (fixed in the recorder); the open run passed 7 of 7.
- `record-live-5.log`: footage recorded earlier on `0399f93` from the live links: the main link 16 of 16 steps (08:38:12 to 08:43:23 UTC) and the open link 7 of 7 (08:43:25 to 08:45:13 UTC). As the check screen asks, the recorder fixes misheard words on screen: it taps **Remove the repeats**, then types any listed fix it finds ("Lides" to "Leeds", "Chamome" to "Chamo-me"); it also taps **Remove the repeats** under her spoken answer. `live-5-main-trace.json` is the trace downloaded in that run (13 model steps: 3 Muse Voice Transcribe, 10 Muse Wonder; 26 tool calls; $0.428; `"status": "NOT SUBMITTED"`) and `live-5-main-evidence-pass.html` its Evidence Pass. Verify this run, on screen in that run: 19 of 19 confirmed facts quote Ana's text word for word; 30 of 30 drafted statements cite a confirmed fact and state no number their facts do not; 2 of 2 approvals match the current version; the export is stamped NOT SUBMITTED; the model review supported 30 cited sentences and held back 0; the check of sentences in her own wording had none to check.
- Every earlier attempt is kept. `record-live-1.log` (00:00:58 to 00:08:45 UTC, `a859bf8`): the main run stopped at the correction step and the open run at its welcome, both on the recorder's side (a wait matched an always-visible link too early; the open link's button had been renamed). `record-open-live-2.log` (00:10:57 to 00:16:24): the main run stopped at the correction step (the recorder's click on **Next: correct one fact** went to a hidden copy of the button); the open run passed 7 of 7. `record-main-live-3.log` (00:17:21 to 00:22:36): the main run passed 16 of 16; this was the footage before the double check. `record-live-4.log` (08:19:51 to 08:30:08, `b8902ae`): the main run passed 16 of 16; the open run stopped when Muse Spark Open's form-check answer was cut short at 4,000 output tokens and the recorder did not press **Try again**; `0399f93` raises that budget, and the recorder now presses **Try again** once.

## Release record of `a859bf8` (`release/`)

- `release-a859bf8.log`: the two revisions that went ready, `applyarc-evidence--final3-a859bf8` (Muse Wonder, `SPEND_CAP_USD` 78) and `applyarc-evidence-open--openfinal3-a859bf8` (Muse Spark Open via Modal), both on image `applyarc-evidence@sha256:f89531422af3d4edd7b8d6ed14a04faeab476a3b56961c6c717cb6a6ebc64789`; then, for each link, the JavaScript and CSS it serves (`index-B3nTXPTT.js`, `index-TYu-XHW3.css`) against a production build of the source: `ASSETS MATCH` on both. It records the number of settings and two limits, and no setting values.
- `digest.txt`, `image-push.log`: the image digest and the end of the registry build log (pushed 3 November, 23:54:31 UTC; base `node:24-slim`).
- `vite-build.log`: that production build.
- `clean-a859bf8-*`: a clean `git archive` of `a859bf8` with a locked install: 200 test files and 1,252 tests passed, the build passed, the 19-step fixture journey passed, and the app started with no key (HTTP 200). `clean-a859bf8-result.txt` is the summary.

## Live checks on `a859bf8` (`live-a859bf8/`)

Scripted through the app's own API against the live links, except `open-km`, which drove a browser.

| Folder | When (UTC) | What | Result |
|---|---|---|---|
| `ana-full/` | 3 Nov 23:56 | Ana's full journey on the main link: her three clips through Muse Voice Transcribe, Muse Wonder for every agent step; the script does not fix the transcript | 22 of 22 quotes word for word; the dignity question asked in Portuguese; 30 cited sentences supported, 0 held back; contradiction caught; 2 sentences reopened, 0 untouched changed; Verify 7 of 7; NOT SUBMITTED; 10 Wonder steps, 26 tool calls; 133.7 s; $0.4158 (with three control transcription calls) |
| `ana-km/` | 3 Nov 23:58 | Ana's key moment on the main link, from the state prepared at 22:03 to 22:08 UTC | Her correction heard; contradiction asked in Portuguese; 2 reopened; Verify 7 of 7; 4 model steps; 23.1 s; $0.0701 |
| `ellie-km/` | 3 Nov 23:58 | Ellie's key moment on the main link | Contradiction asked; 2 reopened; Verify 7 of 7; 5 model steps; 47.3 s; $0.1335 |
| `open-km/` | 3 Nov 23:59 to 4 Nov 00:00 | Ana's key moment on the open link, in a browser at 1440 px | Muse Spark Open read her note as new facts; the screen said so and offered **Correct this fact**; 2 sentences reopened across both documents, 40 untouched; both documents approved at version 2; pack and Evidence Pass stamped NOT SUBMITTED with the demo line; Verify 7 of 7; 3 model steps, 0 tool calls; 17 s; $0.0231 |

The three scripted folders hold the run's `report.json` (with every receipt: model, host, timing, tokens, cost and the provider's request ids), the app's state after each step and the export; `open-km/` holds the browser log (`live-log.json`, with each step's model, timing and cost), its screens and the downloaded Evidence Pass. The `*.log` files are the drivers' summaries.

## Live judge scenarios on `d87dd35` (`scenarios-d87dd35/`)

`REPORT.md` is the report of seven scripted browser scenarios on both live links at `d87dd35` (3 November, about 22:35 to 23:00 UTC), kept as written. `shots/` holds 14 of its 185 screens: Ana's full journey on the main link at 1440 px (transcript, fact card, question, contradiction, what changed, finish, pack, Evidence Pass, Verify), her key moment on a 390-px phone (contradiction, Evidence Pass), and on the open link a failed key-moment try (`open-km-try1-05-FAILED-read-as-new-facts.png`), a try where Spark Open flagged the contradiction itself, and the full journey's correction step. The commits from `d87dd35` to `a859bf8` are the changes this report and a later read-through of the live demo led to; the fix for the open link's dead end is checked live in `live-a859bf8/open-km/` above.

## The film (`film/`)

`narrate-ana-v1.json` is the film's receipt: the founder's 14 takes from one recording (saved 4 November, 13:48 UTC), cleaned and laid over the `record-live-7` footage at their own speed (no speed-up), 2:45.5. `ApplyArc-Evidence-ana-v1.srt` is its subtitles; `plan-ana-v1.json` and `plan-ana-v1.timing.txt` the shot plan; `qa-ana-v1.log` the 14 film checks, all passing; `SHA256.txt` the film's SHA-256 (`0678d11ccbe100fffcd055c9dd0c416274cf4b4516c14cc1fb90d613e59a3e32`); `contact-ana-v1.jpg` a contact sheet. The take matcher's small local speech model misheard names on lines 1, 4, 6 and 7 ("Museu under" for Muse Wonder), so those four takes were assigned to their lines by their place in the recording (`--pick`); the founder watched the film and approved it.
