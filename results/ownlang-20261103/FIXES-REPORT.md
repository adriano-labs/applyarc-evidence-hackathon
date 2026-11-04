# Fix stage report (3 Nov 2026, 21:13 to 22:00 UTC)

HEAD **`51d2abf`** in `ownlang/app`, local only, working tree clean. Nothing pushed, deployed or sent. Servers on 3196 (Muse Wonder, $4 cap) and 3197 (fixture) stopped at 21:56 UTC after checking their PIDs and folder.

## Summary
- **Tests:** 198 files, 1,222 passed (at 60fc1ac: 190 / 1,196). `vite build` passes: JS 402.8 kB, 123.7 kB gzip (was 401.9 / 123.5). Every new commit also passes the full suite in a clean `git archive` copy.
- **Ellie unchanged:** `node scripts/journey.mjs` on 51d2abf is identical to base 58af71f after normalising timings (JSON and log).
- **Break checks:** 10 of 10 bite (undo, test fails, restore from copy, test passes, files identical).
- **Findings 1 to 7 fixed.** Voice keywords added and measured. Notes clip re-voiced with "Eu trabalho". One fresh live Ana run: Verify 7/7. Ana's prepared key moment regenerated: Verify 7/7 live. Browser pass green.
- **[withheld: a development-only service]'s drills:** reviewed line by line, fixed and landed as one `test:` commit. 14 of 14 pass.
- **Meta spend this stage:** $0.806, all settled. Tonight in all: $3.84 (build) + $0.015 (keyword test) + $0.806 = $4.66.

## Findings and commits
| # | Finding | Fix | Commit | Test, break check |
|---|---|---|---|---|
| 1 | Stale `starting` sent a hidden voice call into the next trail | `starting` now lives in `useAppState` and is cleared by Start again. Every other start clears it; the start handlers moved to `client/src/starts.js`. `useClip` sends nothing once its screen has gone. | 4941c29 | spoken-once "after Start again" (2), "whose screen has gone"; f1-stale-start, f1-gone-screen |
| 2 | Each look back re-sent the correction clip | One press: "Use Ana's spoken correction". It is the main button until her words are in, then "Add Ana's note" is. | 4941c29, ee05bfc | "sent once … look back and return"; f2-one-press |
| 3 | A double tap dropped the judge into the full workspace | "Read Ana's words", the sample cards and the key-moment start are disabled while a start is on its way. | 4941c29 | "reads Ana's words once", "starts Ellie's notes once"; f3-read-twice, f3-card-twice |
| 4 | Strings that claimed more than the record | Dated line now reads "…introduced in a Meta post dated 3 September 2026, and Muse Wonder in a Meta post dated 12 October 2026". Both dates re-read today on Meta's pages. Timing: "Meta's models take about 2 minutes; allow a few more to read and confirm." Open-weight copy: "her written note is used instead". The cap hints name Ana's written note: app.js ×2, useWorkspace, TopBar, and the flows.js live-only refusal. A failed voice call now ends with one full stop. | ea53046 | updated string tests, "one full stop"; f4-one-full-stop |
| 5 | Prepared key moment had no deterministic fallback | On a prepared workspace, "Type the correction instead" opens SampleStart ("Correct this fact", sent with its meaning and actor). It is offered before the note and after a reading that flagged nothing. Ellie's screens are unchanged. | 1793826 | "corrects the fact directly when typed"; f5-typed-fallback |
| 6 | Written-note link hidden during upload | Shown while the clip is being transcribed. Choosing it stops a clip that has not been sent yet. | 4941c29 | "choosing it stops the clip"; f6-written-while-loading |
| 7 | Simplicity | One set of actor labels (`evidencePass`, `GlossFields` use `lib/actor.js`). `SpokenStart` uses `pronouns()`, and its unused `onExit` is gone. App.jsx went from 463 to 444 lines. | 1dad738, ea53046, 4941c29 | existing pass and gloss tests |

Found on the way:
- **What Meta did** said "No model calls yet" beside Ana's transcribed words until the next step. It now refreshes when any voice call ends (51d2abf; test and voice-call-in-trail break check). Live at 390 px, the row showed 19 ms after her words.

Other commits:
- keywords: bd1944d;
- re-voiced clip: bfc813a;
- drills: 65ae64d;
- prepared state: 6cc8cc3.

## Voice keywords and the new clip
- `server/agent/voice.js` sends `keywords` in the same JSON part as `languageBias`. Meta's docs (read today) list the field and say keywords "do not guarantee an exact spelling".
- A bundled clip sends `?sample=ana`; the server looks up that sample's `voiceKeywords` (`["Ana", "Leeds", "Chamo-me Ana"]`). An own recording sends none, and an unknown sample gets a 422.
- The keywords are stored on the receipt, returned in the reply and shown in Details as "keywords: …".
- **Re-voiced notes clip:** the same Azure voice (pt-PT-RaquelNeural), default pace and 48 kHz source (`tools/tts-ana-notes.py`, a copy of `ana/tools/tts_ana.py` limited to this clip; Entra token, nothing printed), then ffmpeg to 16 kHz and a 0.6 s pad. Result: 58.91 s, sha256 `ba636530…`. The text with "Eu trabalho" is updated in `fixtures/ana-notes-pt.txt`, the written-note fallback and `ana-fixture-pt.json` (notes and quote).

**Clip measurements** (5 paired calls per clip through the app's `/api/voice`, Portuguese hint on in both, new notes clip, 21:36 to 21:39 UTC, $0.041):

| Clip | Word error, with keywords | Without | Opening | Other |
|---|---|---|---|---|
| Notes (160 words) | 5.3% (3.1 to 8.1) | 6.3% (4.4 to 10.0) | her name heard 4/5 ("Chamome Ana." ×4, "Chammiene." ×1) vs 0/5 ("Szemum jene", "Szemmjen", "Xem", "Szemmiene", dropped); exact "Chamo-me Ana" 0/5 both | "Leeds" 5/5 vs 5/5; "Eu trabalho" 10/10, "trabalha" 0/10; a doubled "Eu" 1/5 vs 3/5 |
| Answer (51 words) | 3.5% | 3.9% | "Para mim" 5/5 vs 3/5 | her name never inserted |
| Correction (17 words) | 1.2% | 1.2% | "Correção" 5/5 vs 5/5 | her name never inserted |

## Live Muse Wonder run of Ana's whole journey (21:40:43 to 21:42:53 UTC)
- **Transcripts.** Notes: 3.75% word error (control without keywords 5.0%), opening "Chamome Ana. Eu trabalho…" (control "Szemumiene"), "Leeds" right, no "Lides". Answer: 0% (control 2.0%). Correction: 5.9%, because the last word was doubled ("dias. dias."); the control was 0%.
- **Facts and quotes:** 12 facts from the notes and 7 from the answer, none refused; 22 of 22 quotes verbatim.
- **Question:** dignity, asked in Portuguese.
- **Correction:** the conflict was raised in Portuguese, and only the 2 citing sentences reopened (answer-19, letter-11); 2 rewrites were proposed and taken.
- **Result:** NOT SUBMITTED at 214 of 500 and 186 of 350 words; Verify 7/7.
- **Cost:** 10 model steps, 28 tool calls, 129 s wall time, $0.401.

## Ana's prepared key moment (6cc8cc3)
- Regenerated from that run with `tools/make-ana-prepared.mjs` (its date now comes from the run): 19 facts confirmed, both documents approved, no correction yet.
- **Stored transcript:** it opens "Chamome Ana. Eu trabalho há três anos num lar em Leeds" (was "Szemumiene. trabalha há três anos"). There is no "Lides" and no garbled opening, and her own person is kept.
- **Errors left in confirmed quotes:** 4 of the transcript's 6 errors sit inside confirmed quotes: f2 "faço medication round" (missing "a"), f3 "No fim do do turno", f5 "uso grua" (missing "a") and f6 "trabalhamosamos sempre em dupla". These are model errors that the automated run did not fix on the first screen.
- **Verify this run:**
  - 7/7 on the run itself;
  - 7/7 on a live key moment from this state through the API (21:43 UTC): conflict in Portuguese, the same 2 sentences reopened, 27.7 s, $0.066;
  - 7/7 in the browser after the typed correction.

## Browser pass (headless Chrome, playwright-core)
- **Finding 1, live, 1440×900:**
  - Ana's voice note was sent once, then Start again ×2.
  - Ellie's "Start at the key moment" opened with no Ana screen and no second call, and Ellie finished.
  - Ellie's trail has 10 rows and no Voice row; 1 voice call in the whole visit.
  - The first attempt stopped at Apply because the driver's 30 s click wait was shorter than the live repair. I fixed the driver, not the app; both attempts were charged.
- **Findings 2 and 5, live, 1440×900:**
  - Ana's key moment opened with no voice call; one press brought her words back in 3 s.
  - Back, then Return to correction: no new call (1 in all).
  - "Type the correction instead", then Correct this fact, then What changed, apply, both approved, NOT SUBMITTED, Verify 7 of 7.
- **Finding 3, fixture:** a double-click on "Read Ana's words" and on "Try it with Ellie's notes" sent one start each and stayed in the walk-through.
- **Fixture screens at 1440×900 and 390×844:**
  - welcome to Evidence Pass, 9 screenshots each, no console errors, no sideways scroll;
  - the primary button's bottom edge at 629 and 634 px;
  - on the phone, Apply visible without scrolling at Ana's key moment.
- **Live welcome at 390 px:** the card's new timing line shows, and the voice note lists in Meta activity at once.

## [withheld: a development-only service]'s failure drills (65ae64d)
- **The one failure:** the non-WAV drill was a test artefact, as the coordinator said. It now uses the real `createVoice` with Meta's endpoint stubbed and never reached, and gets a clean 422 with no receipt.
- **Tests that did not assert what their names said, now fixed:**
  - bad-input: tested startSample only, though named for startPrepared too;
  - double-submit: accepted any non-500 and had a vacuous `>= 0`. It now asserts one 200, one 409 stale and nothing doubled;
  - reload: compared two empty fact lists. It now compares the whole saved workspace after facts are confirmed;
  - parallel-visitors: was named for Ana but ran Ellie's journey. It now runs Ana's fixture journey, and cross-talk is checked per saved file;
  - voice-failure-ui: was named for Ana's spoken start but rendered the microphone button and matched "Try again" inside Meta's own message. It now drives both screens.
- **Changed scope:** cap-fallback was a weaker copy of an allowance test, so it now runs Ana's written note on the fixture with Meta unreachable.
- **Dropped:** one duplicate, the voice network-failure case, which is already in voice.test.js.
- **Rule check:** no test looks at how it is run.

## Spend (Meta, this stage, $0.806)
| What | Spend |
|---|---|
| Keyword check, 30 voice calls | $0.041 |
| Ana's live journey | $0.401 |
| Prepared key moment via the API | $0.066 |
| Browser finding 1, two tries | $0.136 + $0.110 |
| Browser look-back | $0.048 |
| Live welcome | $0.003 |

## Left, and what must not be claimed
- **Prepared-state quotes:** 4 transcript errors sit in confirmed quotes (listed above). This needs a decision: keep them as Meta heard them, or re-run (about $0.40, and say why that run was used).
- **Outside my write area:** `ana/notes-pt.txt`, `ana/meaning-en.md` and `ana/voices.json` still have the old "Trabalho" text and clip. The app's copies are updated, and `ownlang/revoice/voices.json` records the new clip.
- **Look back after hearing the correction:** the heard words are not kept, so one more press is needed. Nothing is re-sent automatically.
- **Known behaviour, unchanged:**
  - Voice Transcribe doubles words, and doubled words pass the quote check.
  - The keywords give "Chamome Ana", never the exact "Chamo-me".
  - The measurements come from one synthetic voice over 5 pairs.
  - "About 2 minutes" is model wait time in automated runs.
- **Still to do:** the hosted links do not have this build; README own-language copy; the skipped translation check and Portuguese claim check (both from the build stage).
- **Evidence:** `ownlang/evidence/fix/`, which holds:
  - `final-vitest.log`, `final-build.log`, `break-checks.log`, `commit-*.log`, `journey-51d2abf.*`;
  - `kw-check.json`, `live/run-1`, `live/ana-km-1`, `ui/`.
- **Tools:** in `ownlang/tools/`:
  - new: `kw-check.mjs`, `ui-fix.mjs`, `fix-break-checks.py`, `commit-check.sh`, `tts-ana-notes.py`;
  - updated: `ana-live.mjs`, `make-ana-prepared.mjs`, `ellie-key-moment.mjs`, `start-host.sh` (`SPEND_CAP_USD` from the environment).
