# Fable code review of ownlang/app 58af71f → 60fc1ac (3 Nov 2026, ~21:20 UK; read-only)
Verdict: GO for the judges' links once fixes 1–3 are in. Re-run the 13 new test files and one browser pass (Ana → Start again → Ellie's key moment) after the fix.
1. Stale `starting` → a hidden Muse Voice Transcribe call and a false Voice row in Ellie's/Ana's key-moment trail (App.jsx:40, 250–265, 294; useAppState.js handleReset; useClip.js:10–19). Should fix.
2. Look-back re-sends the correction clip (SpokenNote auto, remount via App.jsx:281–285; GuidedChange.jsx:123–124). Should fix.
3. Double tap on "Read Ana's words" drops into the full workspace (SpokenStart.jsx:36; App.jsx:252). Should fix.
4. Strings: ReceiptsDrawer.jsx:263 date wording; build.js:518 timing wording; "her transcript is pasted as text" on the open edition (SampleCards.jsx:316, SpokenStart.jsx:59); cap hints name only Ellie (app.js:22, useWorkspace.js:13); double full stop (SpokenStart.jsx:47).
5. Prepared key moment: no deterministic fallback if no conflict is raised (GuidedChange.jsx:121–127). Plausible.
6. Nit: no exit while the clip uploads (SpokenStart.jsx:74–80).
7. Security/privacy: no finding (language validated; 6 MB voice, 100 KB text, 20,000-char transcript caps; sampleId via Object.hasOwn; prompts keep applicant text in tags; Evidence Pass escapes every field).
8. Ellie's behaviour unchanged by tracing; deliberate shared welcome changes (headline, three lines, Ana first, Ellie's key-moment button first).
9. Cost: leaks only in 1 and 2; hosted caps VISITOR_CAP_USD=3 vs ~$0.45 per Ana journey.
10. Simplicity: App.jsx 463 lines; three copies of actor labels; duplicate heard lines; SpokenStart her/she hard-coded; unused onExit; mixed-language fallback question (flows.js:119–124).
Checked by the reviewer: verifyRun 7/7 on the prepared state under HEAD; the council quote and the ONS line live; serveStatic answers Range (iOS audio).
