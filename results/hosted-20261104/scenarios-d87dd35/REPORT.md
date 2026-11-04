# Live judge scenarios on d87dd35 (3 Nov 2026, ~22:35–23:00 UTC; saved by Claude local from the Opus agent's final message)
No app code changed; nothing deployed.

| # | Scenario | Result |
|---|---|---|
| 1 | Main 1440: Ana's full journey, voice note → Verify | PASS, Verify 7/7, 2 min 12 s, 0 console errors |
| 2 | Main 390 phone: Ana's key moment → Evidence Pass → Verify | PASS, 47 s, Apply on screen without scrolling, no sideways scroll |
| 3 | Main 1440: Ellie's key moment after Ana in the same visit; then Start again | PASS: 0 Voice rows in Ellie's trail; 0 receipts after Start again |
| 4a | Open 1440: Ana's full journey to the correction | PASS this time: night-shift fact [18] extracted, "Correct this fact" offered, Verify 7/7 |
| 4b | Open 1440: Ana's key moment → Evidence Pass | **FAIL 3 of 5**: Spark Open read the correction note as new facts ("Is this right? Fact 1 of 2: 'os turnos da noite foram dois anos, não três'") → "Nothing was corrected" with approve buttons only; no typed route, because `GuidedChange.jsx` gives `onTyped` only when voice is live |
| 5 | Open 390: welcome and Ana's key moment | PASS, no sideways scroll |
| 6 | Main: own example typed in English, to the first fact check | PASS, 7 facts |
| 7 | Text checks on 141 states | No "{", "undefined" or "NaN"; NOT SUBMITTED on the pack dialog and the .md, **missing on the Evidence Pass** |

Benign: net::ERR_ABORTED on the audio preload and finished streams (every call returned 200).

## Fixes, ranked
1. **BLOCKER:** the open link's key-moment dead end. When nothing was corrected and the sample has a remembered correction, offer the typed "Correct this fact" route on every edition, not only when voice is live; make the step clearer when the note comes back as new facts.
2. Should fix: the Evidence Pass has no NOT SUBMITTED and no fictional or synthetic-voice label (all 6 downloads); the trace JSON has no NOT SUBMITTED either (may be intended).
3. Should fix: the fictional-applicant label disappears after the first screens (on the open path it never shows after the card; key-moment starts never show "fictional"; the pack .md and the Pass carry neither). A small persistent tag in the guided header and in the exports.
4. Should fix: transcript stutters are quoted word for word ("Eu Eu trabalho…", "No No fim do turno…", "da da medicação"): the honest design, but judges read it as poor quality.
5. Nit: the corrected fact keeps "Correction:" ("[19] Correction: the night shifts were two years…").
6. Nit: the open link still says "Try it with Ana's voice note" with no voice (the note explains it).
7. Nit: open key-moment copy "Meta reads it" against the full path's "Spark Open proposes": pick one.
8. Nit: own example's first fact in the third person ("Applicant is a final-year maths student.").
9. Nit: ERR_ABORTED log noise.

Cost: main about $0.62 (demo spend $12.57 → $13.19 of $78); open about $0.21 of Modal.
Evidence: scenarios-live/shots/ (185 PNGs, NN-step-viewport.png per scenario), logs/, downloads/ (packs, Evidence Pass HTML, traces), judge.mjs (`SCEN=<name> node judge.mjs`).
