# Language probe: can the current engine serve a Portuguese or Polish care worker? (3 Nov 2026, 19:03–19:50 UTC)

**Short answer: not unchanged.** Speech-to-text and the evidence plumbing hold up in both languages. But three English-only rules in code quietly damage the English output: numbers, "I" detection, and the language of the questions. Both languages are **FIX**.

Setup (confirmed): app copy `clean-5948113`, Muse Wonder 1.0, local port 3195, its own DATA_DIR `probe-lang/data/wonder-20261103T190536Z`, $3 cap. Two fictional notes, 47.5 s (European Portuguese, Azure `pt-PT-RaquelNeural`) and 47.9 s (Polish, `pl-PL-AgnieszkaNeural`), as 16 kHz mono WAV. 48 kHz was not used because `voice.js` accepts only 16 or 24 kHz. Each run used the own-form path (`startOwnApplication`) with five English person-specification points. Point 5 is personal ("Why you want this senior care assistant role, in your own words"). Both journeys ran through to export.

## Results

### European Portuguese (Ana)

| Check | Result |
|---|---|
| WER, app `/api/voice` (no hint) | **0.8%** (1/132) counting the date as spoken; 5.5% raw (the voice said "2024" and the transcript wrote "dois mil e vinte e quatro") |
| WER, direct call with `languageBias: ["Portuguese"]` | 6.1% (8/132): worse in this one sample |
| Facts from notes | 8 admitted (11 proposed, 3 refused as "Duplicate of an existing fact"); 2 more from the answer, so 10 confirmed |
| Quotes word for word | 13/13 proposed quotes verbatim; all kept in Portuguese |
| Fact statement language | Notes facts in **Portuguese**; answer facts in **English**: mixed |
| Actor errors | 0 wrong labels. 1 contribution lost: "fui eu que escrevi o plano novo" (I wrote the new plan) refused as a duplicate. The drafts still kept it right: "We reviewed care plans as a team every month, and I wrote a new care plan" |
| Question language | **English**: "After three years working at Rosewood House, why do you want this senior care assistant role now?" |
| Citations right | 17/17 claim sentences cite the matching fact. **0 of 3 numbers survive** (3 years, 22 residents, March 2024) |
| Review outcome | Draft review refused 8 sentences (stages "Revising 5…", "Revising 3…"); revisions passed. 1 sentence dropped by the code number check |
| Personal point covered | **No**, even after a first-person answer ("No question needed: 1 requirement will be left out of the drafts") |
| Conflict detected | **Yes**: "Did you work night shifts for two years or for three years?" (English). Offer on the right fact (f3); only the 2 citing sentences reopened; approvals cleared |
| Repair | 0/2 usable rewrites: both refused by code, "It states a number that none of its cited facts states." Export still says "I worked night shifts." |
| Export | NOT SUBMITTED, 108/250 and 108/400 words |
| Cost | $0.496 journey + $0.0024 voice (+ $0.0024 direct hint call outside the app ledger) |

### Polish (Magda)

| Check | Result |
|---|---|
| WER, app `/api/voice` (no hint) | **4.7%** (5/106) counting the date as spoken; 8.7% raw |
| WER, direct call with `languageBias: ["Polish"]` | 7.5% (8/106): worse in this one sample |
| Facts from notes | 8 admitted (12 proposed, 4 refused as duplicates); 1 from the answer (1 more refused as a duplicate), so 9 confirmed |
| Quotes word for word | 14/14 proposed quotes verbatim; all kept in Polish, **including the transcription errors** |
| Fact statement language | Notes facts in **Polish**; answer fact in English and third person ("Applicant likes giving older people peace and dignity.") |
| Actor errors | 0 wrong labels. 4 own contributions lost as duplicates ("to ja napisałam nowy plan", "zapisuję każdą dawkę", calming with music, wanting to teach new colleagues). The drafts still say "We reviewed… and I wrote a new care plan" because the whole sentence was quoted |
| Question language | **English**, and it repeats the transcription error: "After three years at **Rohu Wood House**, …why do you want a senior care assistant role now?" |
| Citations right | 15/15 claim sentences cite the matching fact. **0 of 3 numbers survive.** Wrong place names reach the letter: "I have worked in a care home in **Litz**, at **Rohu Wood House**." |
| Review outcome | Draft review refused 8 sentences ("Revising 3…", "Revising 5…"); revisions passed; none dropped |
| Personal point covered | **No**, same as Portuguese |
| Conflict detected | **Yes**: "How long did you work night shifts in total: two years or three years?" (English). Right fact (f3); only the 2 citing sentences reopened; approvals cleared |
| Repair | 0/2 usable rewrites: the review refused with "The document omits the corrected duration of two years for night shifts." (the number rule stops the rewrite from saying it) |
| Export | NOT SUBMITTED, 84/250 and 157/400 words |
| Cost | $0.507 journey + $0.0024 voice (+ $0.0024 direct hint call) |

**Total Meta spend: about $1.01** (app ledger $1.008 of $3, plus about $0.005 for the two direct calls).

## The exact failures

1. **Numbers are deleted from the English (worst).** `numbers()` in `server/domain/text.js` reads English number words only. "três anos", "vinte e dois", "dwudziestu dwóch" and "dwa tysiące dwudziestego czwartego" contain no number it can see. So any English sentence that says "three years" or "22" counts as adding a number:
   - The Portuguese letter sentence "On my floor there are twenty-two residents." was dropped by code ("It states a number that none of its cited facts states.").
   - The revisions learned to remove numbers, so the exports contain "There are residents on my floor.", "Residents live on my floor.", "I worked night shifts." and "I did Safeguarding training." (no date).
   - The correction can't be repaired. Portuguese "two years" is refused by the same rule. In Polish the review wants "two years" written but the rule stops it, so neither run can finish the repair. The applicant has to write the sentence by hand.
2. **Questions are asked in English.** `clarifyPrompt` and the conflict question in `extractPrompt` say nothing about language. The app's own fallback question in `flows.js` `check()` is hard-coded English (`The form asks for "…": what would you write?`).
3. **The personal point never counts as covered.** `coverage()` in `server/domain/facts.js` (line 99) needs `saysSelf()` from `server/domain/attribution.js`, and that function knows only English words (`i`, `i'm`, `we`, `our` …). Portuguese and Polish usually drop the pronoun ("gosto", "quero", "lubię", "chcę"), so a word list will not fix this. `letterQuality.js` uses the same function.
4. **"I did Y" facts are lost to the duplicate rule.** The model quoted the whole "we X, but I Y" sentence for both facts. `problemWith()` in `facts.js` refuses a second fact with the same quote, so the self fact disappears. The English drafts survived only because the shared quote holds both halves. A fact card or Evidence Pass would show only the team fact.
5. **Statements come out in mixed languages.** Facts from notes come back in Portuguese/Polish; facts from answers come back in English, once in the third person. Nothing in `extractPrompt` fixes the language.
6. **Transcription.**
   - Portuguese is near perfect: one doubled word ("em equipa equipa").
   - Polish mangles the English names: "Leeds" became "Litz" and "Rosewood House" became "Rohu Wood House". It also doubled a phrase ("pracowałam na pracowałam na").
   - Doubled words pass `verify_quote` because they are in the transcript, so they would appear word for word on the Evidence Pass unless she edits the transcript first.
   - The `languageBias` hint made both worse in one sample each: more doubled words ("acalmá-la acalmá-la", "zawsze zawsze"), and in Portuguese "Leeds" became "Lides" and "Rosewood House" became "Rosa dause". One sample proves little; the result is noisy.
   - The reply has no detected-language field (keys: `sessionId`, `transcript`, `audioDurationMs`, `turns`).
   - The docs also offer `keywords` for names and places; not tested.

What worked unchanged: verbatim quotes in both scripts (Polish diacritics included), fact-id citations, the "we versus I" wording in the drafts, the second review, conflict detection on a Portuguese or Polish correction, the offer on the right fact, reopening only the citing sentences, clearing approvals, and the NOT SUBMITTED export.

## What Option A must change in code

1. `server/domain/text.js` `numbers()`: take the source language. Add Portuguese and Polish number words, including Polish case forms (dwa/dwie/dwóch, trzy/trzech, dwadzieścia/dwudziestu) and spoken years ("dois mil e vinte e quatro"). Pass the language through `facts.js` `problemWith()` and `claims.js` `statesNewNumber()`, which `agent/evidenceReview.js` line 69 calls before the model review. The other route is to let the applicant-confirmed English gloss (Option A item 2) carry the digits. **Option A item 2 says the number rule "stays on the quote"; as it stands, that rule removes every number from the English.** This is the biggest change and it was not in the plan.
2. `server/domain/facts.js` `coverage()`: count a personal requirement as covered when the fact comes from her answer to that requirement's question, or from an `actor: "self"` field the extract returns and she confirms. Don't extend the English word lists in `attribution.js`.
3. `server/agent/prompts.js`:
   - `extractPrompt`: quote verbatim in her language, statement or `english` gloss always in English, and one clause per fact so "fui eu que…" is quoted on its own.
   - `clarifyPrompt` and the conflict question: ask in her language.
   - Also `flows.js` `check()`: the app's fallback question.
   - `facts.js` `problemWith()`: refuse a duplicate only when both quote and statement match.
4. `server/agent/voice.js` `transcribe()`: add an optional `languageBias` and `keywords` (the care home's name, "Leeds"), set from the applicant's language choice; there is no detected language to read back. Measure before trusting it: the hint did not help here.
5. The review prompt in `agent/evidenceReview.js` and `agent/repairFlow.js`: tell the reviewer that quotes are in {language} and sentences in English (Option A item 3). The review coped without this, but its refusal reasons were not captured in this probe.

## Verdict

- **Portuguese: FIX.** Transcription is excellent and the evidence chain works. The English number rule, the English-only questions and the "I" check must change before a demo, because today the statement loses every number and the correction can't be repaired.
- **Polish: FIX, second choice.** The same changes, plus English names mangled in transcription and harder number grammar. It fails Kill 1 on the strict count (below) unless `keywords` fixes the names; retest that first. Keep Portuguese as the demo language if only one is built.

Kill 1, by machine only (sentences that match the ground truth exactly, counting the date as spoken):
- **Portuguese: 8 of 9 (89%)**, just under the 9-of-10 bar. The only miss is a doubled word ("em equipa equipa"); the meaning is intact.
- **Polish: 7 of 9 (78%): fails.** The two misses are the place names and a doubled phrase. The Polish words themselves were all right.
- Both returned 8 facts whose quotes verify word for word, so the six-fact half of Kill 1 passes.
- **NOT VERIFIED by a fluent speaker or a human voice.** Clean synthetic speech is easier than a real accent, a noisy room or real code-switching ("medication round", "care plan" were not tested).

## Not captured

The per-sentence reasons for the 8 draft-review refusals in each language. The driver kept the final payload of each streamed step, not the streamed stage events. The counts are in the stage records.

## Files

- `audio/*.txt` (ground truth), `audio/*.wav` and `*.receipt.json`
- `responses/voice-*.json`, `responses/asr-direct-*.json`, `responses/wer.json`
- `responses/journey-<lang>/NN-*.json` (every API response) and `responses/journey-<lang>.json` (summary and receipts)
- `tools/` (tts_probe.py, start-host.sh, voice.mjs, asr_direct.mjs, wer.py, journey.mjs)
- `logs/`
- The server (PID 73278) was checked and stopped; port 3195 is free.
