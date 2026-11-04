# Voice Transcribe keywords test (3 Nov 2026, ~21:05 UK; Claude local; $0.015 of Meta credit)

Clip: ownlang/app/client/public/samples/ana-pt-notes.wav (padded 0.6 s). Request JSON as voice.js sends it, with languageBias ["Portuguese"]; 3 calls each (raw lines in kw-results.jsonl).

| Variant | WER | Opening | "Leeds" right |
|---|---|---|---|
| hint only | 8.5%, 10.5%, 11.1% | "Szemumiene", "Chęmmienne", "szemmiene" | 2/3 |
| hint + keywords ["Ana","Leeds","Chamo-me Ana"] | 9.8%, 7.2%, 11.1% | "Chamome Ana." 3/3 | 3/3 |

Finding 2: "Trabalho" (I work) was heard as "Trabalha" (she works) in 5 of 6 calls, which makes her own quote third person.

For the fix stage:
1. Add `keywords` to the voice request for the bundled sample clips: the sample's name and place names (for Ana: ["Ana", "Leeds", "Chamo-me Ana"]). It goes in the same JSON part as `languageBias`. Own recordings get no keywords. Record `keywords` in the voice receipt and in Meta activity, as the hint is.
2. Re-voice the notes clip with "Eu trabalho há três anos …" (an explicit "Eu"), using ana/tools/tts_ana.py with the same voice and the 0.6 s pad. Update notes-pt.txt, meaning-en.md and the written-note fallback to match.
3. Re-measure 5 paired calls. Then regenerate Ana's prepared key-moment state from a fresh live Wonder run with the new clip and keywords, so its stored transcript has no garbled opening and no "Lides".
