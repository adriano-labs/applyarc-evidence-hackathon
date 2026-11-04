# Own language build: report (3 Nov 2026, 19:57 to 20:55 UTC)

Saved by Claude local from the Opus agent's final message; the agent could not write files outside its working tree. HEAD **`60fc1ac`** in `ownlang/app`, local only. Nothing pushed, deployed or sent; servers on 3196/3197/3198 stopped at 20:51 UTC.

## Summary
- Tests: **190 files, 1,196 passed** (base 183/1,134); `vite build` passes; 8 break checks bite.
- Ellie: fixture journey byte-identical to the base after normalising timings; her UI tests unchanged and passing.
- Ana in the browser: end to end on fixture (desktop and phone) and live on Muse Wonder (109 s to the Evidence Pass, no console errors). Ana's prepared key moment (M12) works live on a phone in 22 s.
- Wonder runs 1–3: 21/21, 23/23 and 21/21 quotes verbatim; dignity question in Portuguese each time; conflict caught; 2 sentences reopened; Verify 7/7; 144 s / 129 s / 122 s; $0.44 / $0.40 / $0.39. Run 1's review left out one true sentence; run 3 heard "Leeds" as "Lides", and it reached both documents.
- Ellie live key moment: finished, 2 reopened, Verify 7/7, 31 s, $0.12. Ana prepared key moment through the API: 24 s, $0.06.
- Spark Open on Modal: warm-up 200 in 1.2 s; one journey to NOT SUBMITTED, 13 facts with Portuguese quotes, question in Portuguese, 1 reopened, Verify 7/7, 47 s, $0.13. No verify_quote tool calls on that host (code still checks every quote).
- Not run (red-team cut): the separate translation-check Wonder call and the six-case Portuguese claim check.
- Meta spend tonight: $3.84 in all.

## Commits since base 58af71f
c816288, 12aab7f, bb16fee, ed22889, e0e0658 (server language work); 46d30a4 (F2 fix via git am -3); 405d6a2 (mark spoken words; draft stages); 3089361 (welcome leads with Ana); e5f245b (Portuguese with English meaning); 962848b (form titles; where the English came from); 55751fd (meanings in her own person, numbers in digits); 4ab86f9 (start at a sample's key moment, spoken correction); 8caa224 (Ana's prepared key moment from a live run); 7222c8d (welcome component); ba9447e (measured timing on Ana's card); 60fc1ac (docs: where the hint and timing were measured). WIP 1e96a95 tagged `wip-stop-1951`, reviewed and recommitted in parts. From e0e0658 to HEAD: 78 files, +2,178/−234 (incl. a 754-line saved state and ~390 lines of tests). App.jsx 471→463 lines; NotesView 159→131. Bundle JS 401.9 kB (123.5 kB gzip) vs 380.6 kB (117.0 kB).

## UX-SPEC items
M1 welcome opens with the council's exact line (linked), Ana first with "Try it with Ana's voice note", honest notes per mode, ONS line (880,000), "Demo spend"; Ellie's and Marcus's strings unchanged. M2 spoken start: clip → Muse Voice Transcribe on open, editable transcript ("fix any word it misheard"), Read Ana's words / written note fallback, failure notice. M3 walk-through for a spoken sample. M4 bilingual fact card, CitePeek, references, look-back (Portuguese first, "In English (working translation)", source, who did it). M5 Portuguese question with English, spoken answer, conflict and correction cards with meaning. M6 corrections carry meaning and actor. M7 key moment by voice with a typed fallback. M8 form titles everywhere ("Supporting evidence"). M9 drafting line, Evidence Pass intro/meaning/actor/footer; English passes byte-identical. M10 phone CSS; refusal callout on Portuguese documents. M11 the dated-models line (3 Sep 2026, 12 Oct 2026) and the hint in voice rows. M12 Ana's prepared key moment (sample id; Ellie default; unknown id refused). Clips padded 0.6 s; hint on for her clips. Prompt fix 55751fd: meanings first person, digits kept; English prompts and schemas byte-identical to the base.

## Clip measurements (5 paired calls per padded clip)
Notes 159 words: hint on 7.3% WER vs off 8.4%; "Chamo-me Ana" right 0/5 on, 0/5 off. Answer 51 words: 3.5% vs 6.3%; opening right 5/5 vs 4/5. Correction 17 words: 3.5% vs 3.5%; "Correção" 5/5 vs 2/5. The hint helped on 2 of 3 clips, tied on the third; noisy per call.

## Failures and causes
- "Chamo-me Ana" never transcribed (12/12), model; garbled first words in the transcript box, in no fact.
- "Leeds" → "Lides" (run 3), model; reached both documents because the automated run did not fix the transcript (S1 asks her to fix misheard words).
- Doubled words pass the quote check (verbatim unless fixed on S1), model.
- Run 1 review left out a true sentence ("quer" misread), model; shown under "Why was wording left out?".
- Third-person meanings and a lost "18" before 55751fd, app (prompt); fixed.
- First browser try stopped at the answer step: the test driver (hover moved the text), not the app.

## Must not claim
No users, testers, pilots or employers; Ana fictional, synthetic voice (Azure, made before the demo); the council is a public advert, not a partner. English is a working translation she confirms; never "translation", "accurate" or "certified"; no fluent speaker or model check has reviewed the meanings; no Portuguese claim-check result exists. Transcription tested only on clean synthetic speech from one voice. The hint is better on average across 5 pairs, not always. "About 2 minutes" is model time in automated runs. Never say it helps someone who can't speak English do this job. The hosted links don't have this build yet.

## Left
Review, push, deploy; README copy for the own-language path; try Voice Transcribe `keywords` for "Leeds" and the care home's name; a fluent reader for the meanings and the two skipped checks; UX-SPEC N1–N6; Ana's card on the hosted open-weight link; the spec's Ellie card wording if allowed.

## Files
Tools in ownlang/tools/ (start-host.sh with KEEP_DATA and a spark host, ana-live.mjs, ellie-key-moment.mjs, ui-ana.mjs, clip-check.mjs, pad-clips.mjs, warm-check.mjs, make-ana-prepared.mjs, summarise-runs.mjs, ui-wer.mjs, break-checks.sh). Evidence in ownlang/evidence/ (live/runs, live/clip-check-1.*, spark/, ui/fixture-1440, ui/fixture-390, ui/live-1440, ui/live-km-390, ellie/, break/, final-vitest.log, final-build.log).
