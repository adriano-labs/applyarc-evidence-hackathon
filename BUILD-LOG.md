# Build log

Commit times (UTC) and subjects from the private development repository, oldest first: 279 commits from `925f815` to `b367407`. The history itself stays private; the organisers may ask to see it. Subjects that name a development-only third-party service are withheld and marked; nothing else is edited.

| Day (UTC) | Commits |
|---|---:|
| 2026-10-26 | 19 |
| 2026-10-27 | 67 |
| 2026-10-28 | 3 |
| 2026-10-29 | 39 |
| 2026-10-30 | 18 |
| 2026-10-31 | 1 |
| 2026-11-02 | 31 |
| 2026-11-03 | 62 |
| 2026-11-04 | 39 |

| Time (UTC) | Commit | Subject |
|---|---|---|
| 2026-10-26 21:20 | `925f815` | chore: start the ApplyArc Evidence event repository |
| 2026-10-26 22:38 | `430bad4` | docs: add the product record and the workspace design direction |
| 2026-10-26 22:48 | `f7aafe0` | feat: add the domain core with its invariant tests |
| 2026-10-26 22:56 | `1c7fefd` | feat: add the API, flows, fixture agent, store and the spend ledger |
| 2026-10-26 22:58 | `44e0e30` | feat: add the timed journey script and run it as a test |
| 2026-10-26 23:07 | `e9e2f0a` | feat: add the tool loop, model agent, prompts and a transport that retries only when safe |
| 2026-10-26 23:13 | `b3248bb` | (subject withheld: names a development-only service) |
| 2026-10-26 23:22 | `5960dcb` | feat: add the client API, workspace hook, design tokens and the diff and format helpers |
| 2026-10-26 23:26 | `b415e72` | feat: price the Llama 4 stand-in and let a provider wait longer for its first token |
| 2026-10-26 23:40 | `938ee1d` | feat: add the manuscript, change queue, form panel, facts review, question card and references |
| 2026-10-26 23:43 | `2d134c0` | feat: add the top bar, status line, receipts drawer, export preview, command menu, notes view and flow helpers |
| 2026-10-26 23:45 | `4af7f02` | feat: link confirmed facts to requirements before asking any question |
| 2026-10-26 23:45 | `1a3b036` | feat: tighten the extract, check and draft prompts for coverage and document shape |
| 2026-10-26 23:47 | `64b9afa` | fix: give the draft step the exact role title and paragraph rules |
| 2026-10-26 23:50 | `773cc82` | feat: refuse frame sentences that misname the role or state numbers |
| 2026-10-26 23:52 | `72ed0b8` | docs: describe the modes, the mechanism and what holds it up in production |
| 2026-10-26 23:52 | `4152f4e` | docs: record the coding tools and the development stand-ins in the provenance |
| 2026-10-26 23:54 | `a3d2b59` | feat: let the model fix a draft the evidence check refused, and fix three review findings in the rail |
| 2026-10-26 23:57 | `6115555` | chore: add a dated snapshot of a second Graphcore form for the continuity milestone |
| 2026-10-27 00:04 | `c4ff037` | feat: assemble the app, read fixtures from one place, and polish the rail, diff and badges |
| 2026-10-27 00:07 | `291716f` | feat: add an OpenAI-compatible provider for Meta open-weight models |
| 2026-10-27 00:10 | `91ca577` | fix: count facts left against all proposed, keep keyboard focus, mark corrected and pending sentences |
| 2026-10-27 00:12 | `400d976` | feat: name each model step's progress stage in the flows, for every model |
| 2026-10-27 00:19 | `292adc7` | feat: click-to-edit sentences, citations that never wrap alone, pending marks and one button stylesheet |
| 2026-10-27 00:21 | `7139b6b` | feat: start a second application that reuses the applicant's confirmed facts |
| 2026-10-27 00:22 | `07e8d2f` | feat: add a labelled demo fault switch that injects one 429 |
| 2026-10-27 00:22 | `18430e1` | feat: remember which sentences the last repair changed |
| 2026-10-27 00:23 | `715d166` | fix: drop the accent border on the question card |
| 2026-10-27 00:26 | `e0c8fd0` | feat: start the next application from the browser, with facts carried over |
| 2026-10-27 00:30 | `b0ebc1c` | feat: a phone bar that shows one section at a time, and lasting corrected marks |
| 2026-10-27 00:31 | `79954bf` | docs: describe the next application, draft self-correction and the demo fault switch |
| 2026-10-27 00:33 | `8ec9b8a` | refactor: split the app's state, keyboard and commands out of App.jsx |
| 2026-10-27 00:35 | `50faea5` | docs: add DESIGN.md and the design tokens file, documented from the built system |
| 2026-10-27 00:44 | `46282e3` | fix: readable change previews, one clear choice per change, dialogs on screen, tight citations and the review's pattern fixes |
| 2026-10-27 00:52 | `82514b0` | feat: jump from a change to its sentence, receipts in the top bar for Meta, keyboard tabs and a compact phone header |
| 2026-10-27 01:02 | `3e9628d` | feat: keep the old approval struck through when a document changes, and sweep the highlighter across the cited quote |
| 2026-10-27 01:04 | `947dadd` | fix: retry once at once after a first-event stall while the deadline allows, and give a stale approval chip its own row |
| 2026-10-27 01:39 | `4bc5f60` | feat: refuse a claim that states a number or an "I" its cited facts do not support |
| 2026-10-27 05:42 | `300c6cb` | fix: do not read "I/O" as the pronoun "I" in claims or quotes |
| 2026-10-27 05:45 | `962e2fa` | feat: ask a personal requirement the model left out, marked as asked by the app, and say how many requirements a draft will leave out |
| 2026-10-27 05:45 | `cba369a` | feat: add the first-call smoke check, send reasoning summaries back, report a key with no billing plainly, and test the tool loop |
| 2026-10-27 05:45 | `7a22968` | fix: recover from a failed first load, open the receipts from the top bar, approve the document on screen from the main button, and offer Try again only when it can help |
| 2026-10-27 07:50 | `93adc79` | feat: undo a correction before it is applied, show the reopened sentences honestly while the rewrite is awaited, offer the sample correction, and keep fixture rewrites to the sample correction only |
| 2026-10-27 07:50 | `39047f1` | feat: receipts record first event and first output apart, count attempts that may have run, label an injected 429 as the demo's, and start at zero after Start again |
| 2026-10-27 07:50 | `856dec4` | docs: say what ran where, how hosting keeps users apart, and use a fixture spend in the design example |
| 2026-10-27 07:56 | `5cce1ba` | chore: license the project under MIT |
| 2026-10-27 08:03 | `092fb2b` | docs: keep the provenance to this repository's own event work |
| 2026-10-27 08:19 | `209e1e7` | fix: clear the Start again notice when it lapses or resets, keep Enter working after a click, ignore a second press while saving, and space the export pack |
| 2026-10-27 09:02 | `edef43e` | feat: let every run count against one shared spend file and cap, including the smoke check |
| 2026-10-27 09:13 | `dc6ddb7` | fix: offer each model step only the tools it needs, and ask for the answer on the last turn |
| 2026-10-27 09:17 | `ae9f1a5` | feat: turn the employer's form into a one-line brief on laptops and a column on wide screens, so the work gets the first screen |
| 2026-10-27 09:25 | `cc64b18` | feat: open with what the product does and start Ellie's sample in one click |
| 2026-10-27 09:35 | `4cdd8e5` | feat: show where the applicant is in six steps and what to do now and next, in a bar that never moves the work |
| 2026-10-27 09:47 | `1e4c6f6` | feat: check facts one at a time with the quote lit in the notes, and confirm the remaining facts in one step |
| 2026-10-27 09:55 | `c7eca9a` | chore: remove leftover working notes and the duplicated approve logic |
| 2026-10-27 10:08 | `22ad7c3` | fix: name the employer the facts review is given, falling back to "the employer", and cut the component to 84 lines |
| 2026-10-27 10:11 | `969769a` | feat: give each hosted-demo visitor a private workspace through a cookie, so judges need no sign-in |
| 2026-10-27 10:19 | `c428d6f` | feat: invite the sample correction before approving, and show each reopened sentence as Was and Now lines under a plain summary |
| 2026-10-27 10:24 | `e621379` | feat: show each document's state under its tab, and an example of a cited sentence before anything is written |
| 2026-10-27 10:29 | `35ecb6a` | feat: make the export dialog read like the finished pack: contents line, references with the applicant's words, numbered portal tasks, a footer in view and focus back to its opener |
| 2026-10-27 10:36 | `ff7e097` | feat: give each document a compact head that says what the evidence check guarantees and who drafted it, let a citation be pinned, and keep one Approve |
| 2026-10-27 10:36 | `47468c2` | fix: keep the export footer flush with the dialog's bottom and the NOT SUBMITTED stamp its own width |
| 2026-10-27 10:40 | `ee0aa45` | docs: describe the redesign in DESIGN.md and design.json: layout bands, two-line tabs, the document head and pinned citations, one-fact review, the readable corrigendum, the export pack, the step guide and the example page |
| 2026-10-27 10:53 | `74b1f31` | feat: give each hosted visitor a live allowance, chosen once per workspace, and run Ellie's sample on the labelled fixture after it is used |
| 2026-10-27 11:02 | `c9bd5a8` | feat: fall back to the labelled fixture when the hosted demo's own budget is nearly spent, and limit new visitors per network per day |
| 2026-10-27 11:16 | `450a780` | chore: add the container the hosted demo runs in: Node 24, a frozen pnpm install, the built client and server only, as the node user |
| 2026-10-27 11:24 | `fe7971f` | fix: keep one visitor cookie when the journey runs against the hosted demo |
| 2026-10-27 11:32 | `5ea2c7e` | fix: show visitors the demo's spend totals only, never the list of everyone's calls |
| 2026-10-27 11:39 | `18b7684` | docs: link the live demo, and describe the hosted visitor workspaces, spend caps and container |
| 2026-10-27 11:51 | `edb8164` | feat: open a tapped citation's evidence in a sheet on phones, and prefill only the sample's own fact when a correction is opened |
| 2026-10-27 11:51 | `5a3fbb0` | fix: show the short tab states on phones so each tab stays on one line |
| 2026-10-27 12:19 | `5ec6934` | fix: use plain words across the app: What changed, Your evidence, statements, and the employer's site |
| 2026-10-27 12:25 | `6e80631` | feat: add the guided walk-through's frame: five steps, a plain headline, one main button and a way out to the workspace |
| 2026-10-27 12:55 | `95df017` | feat: open Ellie's sample as a guided walk-through, with the notes, facts and question steps, and the workspace one click away |
| 2026-10-27 12:56 | `4618a77` | fix: credit Meta in the walk-through only when Meta ran, and draw the progress bar on its own track |
| 2026-10-27 12:59 | `b15cc04` | feat: add a second sample applicant, Marcus, moving from retail into marketing, with a labelled sample form; Ellie runs everywhere, Marcus on the live model |
| 2026-10-27 13:07 | `f1c1bd0` | feat: finish the guided walk-through: her cited answer with evidence in place, a fact change where only the sentences that used it are rewritten, both approvals and a finish line |
| 2026-10-27 13:20 | `790b9af` | feat: offer both sample applicants on the start screen, with Marcus's own pronouns in the walk-through and his sample only on the live model |
| 2026-10-27 13:53 | `d184639` | feat: let the walk-through go back to any finished step, and finish on a step-by-step list of what was done |
| 2026-10-27 14:14 | `cde7287` | fix: tell the draft model what an "I" sentence must cite, and how to fix each kind of refused sentence |
| 2026-10-27 14:32 | `9b2bfbf` | feat: keep the walk-through across a reload of the tab, and add a way back to it from the full workspace |
| 2026-10-27 14:36 | `bb8c14b` | fix: say what each tool call did in plain words on the status line while a model step runs |
| 2026-10-27 14:42 | `9e08474` | feat: open a fresh workspace on a focused welcome, and keep What Meta did and the command menu in the welcome and the walk-through |
| 2026-10-27 14:47 | `0144ea2` | fix: keep the walk-through on step 3 while the app checks the form or reads her answer, and say it is checking rather than that something is missing |
| 2026-10-27 14:54 | `3bf1c0a` | fix: hold the walk-through's main button while a step runs |
| 2026-10-27 20:02 | `aa645a9` | fix: check who did what, numbers written as words and inflated roles in every drafted sentence, and keep what passes after a refused fix |
| 2026-10-28 12:25 | `86c54d3` | Strengthen evidence checks and improve application review and progress |
| 2026-10-28 13:37 | `9825996` | Clarify conflicting evidence and verify Modal development route |
| 2026-10-28 14:21 | `9d6d675` | Repair rejected wording against current evidence and keep review decisions stable |
| 2026-10-29 10:32 | `42b3d99` | fix: keep what the applicant did when a correction moves a role to someone else |
| 2026-10-29 10:50 | `3c774c9` | fix: keep the employer detail in a reason for wanting the job when reading the notes |
| 2026-10-29 10:55 | `c97c3e2` | feat: let each arm of the fair comparison ask one question after the packet, answered with the case's own predeclared correction |
| 2026-10-29 11:21 | `154413e` | fix: save a v4 comparison run under the v4 label |
| 2026-10-29 11:24 | `3d34101` | test: reword a comment about the first comparison trial run |
| 2026-10-29 11:32 | `33a2e4f` | fix: tell the evidence check that a quote is the applicant's own correction |
| 2026-10-29 11:49 | `7c19088` | fix: offer the applicant's own corrected words when a repair keeps dropping their part |
| 2026-10-29 11:49 | `d2b0946` | fix: name the right applicant on the sample answer and give Marcus an answer to the question he is asked |
| 2026-10-29 12:33 | `3bf97a7` | chore: remove the non-Meta development stand-in |
| 2026-10-29 12:37 | `cd8003e` | feat: let the fair comparison run a held-out corpus under its own label |
| 2026-10-29 12:48 | `28f8e84` | docs: say where the app runs on Meta's open weights, with the measured runs |
| 2026-10-29 12:53 | `13d255b` | fix: write the reason for a refused improvement to the applicant |
| 2026-10-29 12:58 | `98cf144` | test: add a held-out comparison corpus, written blind and frozen before any run |
| 2026-10-29 14:00 | `81ec666` | fix: let the applicant's own reason answer the motivation requirement |
| 2026-10-29 14:00 | `e20cf07` | fix: ask before confirming work the notes give to the team |
| 2026-10-29 15:55 | `67c191d` | fix: show the applicant's own part in the letter and state a shared point once |
| 2026-10-29 15:55 | `f04bcf6` | docs: add .env.example for a local run |
| 2026-10-29 16:31 | `aea7c7f` | test: add a second held-out corpus of 16 cases, written blind and frozen before any run |
| 2026-10-29 17:31 | `d11b5d0` | feat: turn spoken notes into text with Meta Voice Transcribe |
| 2026-10-29 17:39 | `63b60c9` | fix: list a first spoken note in What Meta did |
| 2026-10-29 17:39 | `5d3f9ba` | feat: speak an answer or your own notes instead of typing |
| 2026-10-29 17:48 | `dddb79a` | test: fix the status-quo arm before running it |
| 2026-10-29 17:51 | `48593b5` | feat: Evidence Pass, one page where every sentence opens the applicant's own words |
| 2026-10-29 18:12 | `e3c6734` | test: freeze held-out set 3 and declare its acceptance before any run |
| 2026-10-29 19:38 | `b27eefd` | test: declare the final acceptance and the paired correction set before any run |
| 2026-10-29 19:44 | `aad0d7f` | fix: never present a malformed draft as ready |
| 2026-10-29 19:46 | `ee4ea6a` | test: declare comparison protocol v5 and clarify set 3B before any run |
| 2026-10-29 19:47 | `25aaf76` | test: count every paired case and approve the applicant's own wording explicitly |
| 2026-10-29 19:52 | `04c497b` | fix: end a model stream or a transcription that goes silent |
| 2026-10-29 21:02 | `fc5e424` | fix: repair with the whole document in view and keep the applicant's part once |
| 2026-10-29 21:02 | `6caf455` | test: route the app arm's fixed answer to its contribution question (protocol v5) |
| 2026-10-29 21:05 | `a101325` | test: place and check the applicant's unrelated hand edit in both arms (set 3B) |
| 2026-10-29 21:20 | `c7389a7` | fix: answer every requirement the confirmed facts cover, and say when one is still missing |
| 2026-10-29 21:20 | `24f96a5` | fix: make no model call while a question waits for the applicant |
| 2026-10-29 21:27 | `d4c9cc3` | test: freeze set 3B, written blind and declared before any run |
| 2026-10-29 22:21 | `75d7a4c` | fix: keep the applicant's own sentence without the citation a correction overturned |
| 2026-10-29 22:38 | `bd2dbfc` | fix: open a sentence's evidence beside it in the walk-through, and drop dead controls |
| 2026-10-29 22:42 | `784206a` | fix: keep the pack reachable after closing, and tidy phone and type details |
| 2026-10-29 22:52 | `3ac2b3c` | fix: keep keyboard focus where the work is, and say what a failed step kept |
| 2026-10-30 05:03 | `3059a40` | fix: refuse joins that imply what no fact says, and skip an unreadable rewording |
| 2026-10-30 07:19 | `f1d55e7` | test: declare the set 4 acceptance and protocol before any case is opened or run |
| 2026-10-30 07:40 | `ff5cb44` | fix: keep every action a correction gives the applicant, and never say the same thing twice |
| 2026-10-30 07:40 | `647dc98` | test: say before any run how set 4 reports incomplete runs, keeping the original rule |
| 2026-10-30 10:47 | `6fd5f1c` | Recover saved work after refresh and interrupted streams |
| 2026-10-30 10:53 | `1c44daa` | Review contribution retention across the whole corrected document |
| 2026-10-30 10:53 | `53dc9ab` | Freeze independent set 4 before the candidate comparison |
| 2026-10-30 11:17 | `a5e7e73` | fix: keep repair controls consistent during saved-state recovery |
| 2026-10-30 12:22 | `72b3895` | fix: after a conflict answer, let the applicant correct, keep or remove the earlier fact before drafting |
| 2026-10-30 12:33 | `3438e3b` | feat: let the applicant correct, keep or remove the earlier fact an answered conflict was about |
| 2026-10-30 12:46 | `3d68bc6` | fix: refuse a "them" sentence that turns one person from the notes into a group |
| 2026-10-30 12:55 | `e0e5386` | fix: make the waiting conflict decision visible at every screen width |
| 2026-10-30 13:06 | `9926211` | docs: rewrite the README around authorship and every blind result, losses included |
| 2026-10-30 17:47 | `1765f33` | fix: keep a draft when dropping one sentence fails the next, and narrow the "them" guard |
| 2026-10-30 17:53 | `f16bb7e` | fix: ask about every earlier fact a conflict answer touches, and hold approval and export until decided |
| 2026-10-30 17:55 | `2c5b458` | docs: correct the README's guided steps, timing basis and conflict and guard descriptions |
| 2026-10-30 17:59 | `74b5120` | feat: show the earlier-fact decision as its own step, in the workspace and the guided walk-through |
| 2026-10-30 18:18 | `8bccfee` | fix: let corrections run while a decision waits, and tighten the "them" guard and removed evidence |
| 2026-10-31 04:17 | `5a4a486` | docs: add the release facts and one hosted rehearsal trace |
| 2026-11-02 11:29 | `b4e4ba3` | docs: clarify evaluation metrics and add recorded Meta trace |
| 2026-11-02 11:38 | `ec0629d` | docs: remove unverified private inference claim |
| 2026-11-02 13:45 | `61f2a07` | Make correction review a primary workspace |
| 2026-11-02 14:27 | `b482d7b` | Add priced Wonder runtime and validated Meta effort override |
| 2026-11-02 14:46 | `693d530` | Keep reservation charged when provider usage is missing or invalid |
| 2026-11-02 14:47 | `0bba722` | Allow applicants to add notes without replacing drafts |
| 2026-11-02 15:31 | `0b8bcc6` | Focus ordinary fact corrections in the editor |
| 2026-11-02 15:26 | `31cd1b2` | docs: distinguish Wonder candidate from historical Spark results |
| 2026-11-02 15:57 | `1cc310c` | docs: record complete hosted Wonder journey and cost limits |
| 2026-11-02 15:56 | `29f2b3d` | Prefill conflict corrections from the specific answered question |
| 2026-11-02 16:25 | `db885e0` | Preserve correction drafts until save is confirmed |
| 2026-11-02 16:27 | `64c3539` | Verify committed correction recovery never repeats the write |
| 2026-11-02 16:29 | `a2e3c1b` | Require available personal evidence in letter quality check |
| 2026-11-02 16:37 | `0277e8f` | Keep passive evidence highlights from moving the page |
| 2026-11-02 16:39 | `76529ac` | Await confirmed correction save in polish regression |
| 2026-11-02 16:52 | `e10b829` | Retain valid letter when optional quality retry fails |
| 2026-11-02 16:57 | `0d3d7ce` | Keep checked letter unless optional rewrite resolves all gaps |
| 2026-11-02 17:34 | `31ffe8d` | docs: record the current hosted Wonder journey |
| 2026-11-02 18:55 | `3547156` | Check repaired documents in context and reuse explicit corrections |
| 2026-11-02 19:30 | `a404886` | Require fresh approval after adding application evidence |
| 2026-11-02 19:46 | `378128d` | Document current Wonder release and complete comparison honestly |
| 2026-11-02 21:10 | `7b71fbf` | Make finishing the application primary and clarify personal edits |
| 2026-11-02 21:22 | `67fd2d3` | Distinguish personal contribution from conflicting ownership |
| 2026-11-02 21:55 | `1c81e04` | Clarify completion flow and preserve useful evidence in writing review |
| 2026-11-02 22:11 | `556aab4` | Clarify authorship and model time in the completed application |
| 2026-11-02 22:30 | `211d322` | Keep corrected source gaps separate during evidence review |
| 2026-11-02 22:44 | `20f5412` | Test selective concise letters with grounded ownership |
| 2026-11-02 22:53 | `0e79bf7` | Revert "Test selective concise letters with grounded ownership" |
| 2026-11-02 23:25 | `3cc0577` | Explain the live allowance fallback without changing spending controls |
| 2026-11-02 23:25 | `782561a` | Record writing losses and the completed hosted correction journey |
| 2026-11-02 23:54 | `d9fb336` | Record current hosted Wonder journey and preserve comparison limits |
| 2026-11-03 00:03 | `28970e0` | Record reviewed film and distinguish public snapshot history |
| 2026-11-03 00:29 | `1525c35` | Show complete repair passages with explicit wording labels |
| 2026-11-03 09:02 | `8207fdb` | fix: give repair items inner padding and keep them clear of the sticky Apply bar |
| 2026-11-03 13:14 | `a914679` | feat: show Meta's work as an evidence trail |
| 2026-11-03 13:18 | `2095e52` | fix: say only cited sentences open the applicant's words |
| 2026-11-03 13:47 | `2c4aff0` | fix: keep the live demo usable for every judge |
| 2026-11-03 14:15 | `4f83a85` | fix: keep waiting tasks in view and make the trail say only what happened |
| 2026-11-03 14:45 | `7cfea8c` | fix: hold up on applicants' own notes |
| 2026-11-03 14:46 | `78fb478` | feat: tell visitors what to watch for on the welcome screen |
| 2026-11-03 14:46 | `ad04f74` | feat: keep a shared open-weight endpoint warm between visitors |
| 2026-11-03 16:03 | `94a92a9` | feat: lead judges to the key moment and show what the agents did |
| 2026-11-03 16:33 | `707377f` | feat: let judges start at the key moment |
| 2026-11-03 16:41 | `0f00333` | docs: publish the judge path, measured results and build log |
| 2026-11-03 16:43 | `e91abda` | docs: say what store: false actually means |
| 2026-11-03 17:15 | `061ddee` | feat: verify a run without calling a model |
| 2026-11-03 17:21 | `634d68a` | docs: map the build to Meta's verifiable-agent pattern |
| 2026-11-03 17:50 | `c27630a` | fix: say plainly what drafted the text and what the licence requires |
| 2026-11-03 17:59 | `a24b954` | docs: say plainly what runs where and what the licence asks |
| 2026-11-03 18:05 | `9fe0adb` | fix: find Ellie's correction whatever she called the patch, and say only what happened |
| 2026-11-03 18:05 | `5948113` | docs: fix the judge path the QA walked |
| 2026-11-03 18:09 | `c630373` | docs: name the live build and the measured key-moment times |
| 2026-11-03 18:24 | `5377e52` | docs: name each Meta model, its id and where it runs |
| 2026-11-03 18:24 | `67b5c08` | docs: show the own-key start as one block |
| 2026-11-03 18:46 | `c2502d4` | fix: count a first-person heading as the applicant speaking |
| 2026-11-03 19:32 | `eb09893` | feat: check numbers and own work per language |
| 2026-11-03 19:32 | `75ee207` | feat: ask, draft, review and repair in the applicant's language |
| 2026-11-03 19:32 | `3c5c6b0` | feat: add Ana's sample: Portuguese voice notes on a public care advert |
| 2026-11-03 19:34 | `030acd1` | fix: give back who did it when a correction in another language is undone |
| 2026-11-03 19:43 | `53ad2df` | feat: ask for a point the form wants stated directly |
| 2026-11-03 19:33 | `9db771b` | fix: offer the fact a correction overturns, not the part it repeats |
| 2026-11-03 20:24 | `8f17dd1` | feat: mark spoken words and say what each draft stage checks |
| 2026-11-03 20:26 | `f23f016` | feat: lead the welcome with Ana and open on her voice note |
| 2026-11-03 20:27 | `d5fdbb4` | feat: show and correct her Portuguese with its English meaning |
| 2026-11-03 20:27 | `bcd6c1d` | feat: use the form's titles and say where the English came from |
| 2026-11-03 20:35 | `bcfb184` | fix: write her English meanings in her own person, numbers in digits |
| 2026-11-03 20:35 | `683f869` | feat: start at a sample's own key moment, with her spoken correction |
| 2026-11-03 20:40 | `7bb5137` | feat: add Ana's prepared key moment from a live Muse Wonder run |
| 2026-11-03 20:41 | `31545a6` | refactor: give the welcome its own component |
| 2026-11-03 20:44 | `846ba45` | feat: say how long Ana's live run takes, from the measured runs |
| 2026-11-03 20:53 | `62003e7` | docs: say where Ana's hint and timing were measured |
| 2026-11-03 21:30 | `38414cf` | fix: send a voice clip once, and start a sample once |
| 2026-11-03 21:30 | `2a80c69` | fix: say only what the record shows, and name Ana where her written note runs |
| 2026-11-03 21:30 | `e3e23ec` | fix: give Ana's prepared key moment the typed correction |
| 2026-11-03 21:30 | `9e6e1e5` | refactor: keep one set of who-did-it labels |
| 2026-11-03 21:39 | `d665593` | feat: send a sample's names and places as Meta's keywords with its clips |
| 2026-11-03 21:39 | `d636926` | fix: re-voice Ana's notes with "Eu trabalho" so her quote stays first person |
| 2026-11-03 21:39 | `977b584` | test: add failure drills for voice, cap, double submit, reload, bad input and parallel visitors |
| 2026-11-03 21:44 | `6558335` | feat: re-save Ana's prepared key moment from a live run with the new clip |
| 2026-11-03 21:50 | `e458ba0` | fix: lead the key moment with Ana's spoken correction until her words are in |
| 2026-11-03 21:55 | `52231da` | fix: show a voice call in What Meta did as soon as it ends |
| 2026-11-03 22:11 | `d87dd35` | fix: save Ana's key moment from a run whose transcript she checked first |
| 2026-11-03 23:27 | `50c333d` | fix: offer the typed correction on every edition when her note changed nothing |
| 2026-11-03 23:28 | `470e33d` | feat: show the words Voice Transcribe repeated, removed only with one tap |
| 2026-11-03 23:30 | `e65524f` | fix: stamp the Evidence Pass NOT SUBMITTED and label the fictional applicant to the end |
| 2026-11-03 23:31 | `5771cab` | fix: speak of Ana on her fact cards in the walk-through |
| 2026-11-03 23:34 | `35a03fe` | fix: keep one main button after the repair, and name her application on the draft step |
| 2026-11-03 23:34 | `9271b89` | fix: drop the "Correction:" label from a corrected fact's English meaning |
| 2026-11-03 23:35 | `9d9f9d1` | feat: say on the finish that her words were spoken in Portuguese |
| 2026-11-03 23:37 | `029b077` | fix: say what the open-weight edition does at Ana's key moment |
| 2026-11-03 23:40 | `8b9ac22` | fix: let the question's actions wrap whole, and say Ana's key moment takes about a minute |
| 2026-11-03 23:41 | `5c558bc` | fix: say the council is not a partner at its citation, and tidy the Verify row and spend pill |
| 2026-11-03 23:42 | `a859bf8` | refactor: give the pack's head its own component, and reuse sourceKinds in the facts panel |
| 2026-11-04 00:36 | `5d9d232` | docs: add the own-language build's runs, receipts and polish checks |
| 2026-11-04 00:36 | `c4b82c7` | docs: add the a859bf8 release record, its live checks and the judge scenarios |
| 2026-11-04 00:36 | `5d38e44` | docs: lead the README with Ana's own-language path on a859bf8 |
| 2026-11-04 00:36 | `9c685a8` | docs: record a859bf8, the advert, Ana's synthetic voice and the own-language build in provenance |
| 2026-11-04 00:37 | `130e834` | docs: time the own-language build to a859bf8's author time, as the build log does |
| 2026-11-04 00:37 | `0a88402` | docs: regenerate the build log to the provenance commit |
| 2026-11-04 00:39 | `d25c361` | docs: cite the live browser runs on a859bf8 from the film's recorder |
| 2026-11-04 08:15 | `b8902ae` | fix: lead with the typed correction, catch two-word repeats wherever she edits spoken words, and credit the prepared drafts on the open link |
| 2026-11-04 08:24 | `81eb784` | fix: space the typed offer from the fact card, keep the phone bar to two rows, and stamp the trace NOT SUBMITTED |
| 2026-11-04 08:32 | `0399f93` | fix: give the form check the same 8000-token output budget as the reading step |
| 2026-11-04 08:52 | `717f18e` | docs: record the 0399f93 release, its live checks and the film footage recorded on it |
| 2026-11-04 08:55 | `dc5244c` | docs: show local paths in the result logs as ~/ and <tmp>/ |
| 2026-11-04 12:56 | `541283d` | fix: show Verify on the finish screen, name the rewrite in progress, and drop the spend counter from the bar |
| 2026-11-04 13:51 | `198a70f` | docs: record 541283d, the Spark Open runs and the final footage; add the business case and the agentic trace |
| 2026-11-04 14:14 | `679daea` | docs: add the narrated film, its YouTube link, subtitles and checks |
| 2026-11-04 14:14 | `01dc561` | docs: regenerate the build log up to the film commit |
| 2026-11-04 14:23 | `116847e` | docs: state one business model: councils and care employers pay, the applicant uses it free |
| 2026-11-04 14:23 | `c890ad9` | docs: regenerate the build log |
| 2026-11-04 14:32 | `b46a341` | docs: say what Verify shows on screen, and how a returning visitor starts fresh |
| 2026-11-04 14:32 | `476c418` | docs: regenerate the build log |
| 2026-11-04 15:14 | `38d5651` | Coverage: a requirement whose fact was corrected needs review and no longer counts as covered until linked again |
| 2026-11-04 15:14 | `21d75c1` | Bring in the published docs from 476c418 |
| 2026-11-04 15:15 | `b73e056` | Docs: quotes checked against the reviewed transcript, proposed buyers, Portuguese only, estimated costs, private-repo commit ids, and the coverage fix the film predates |
| 2026-11-04 15:17 | `353d729` | Docs: the film shows the earlier build's coverage after a correction; the live links mark it needs review |
| 2026-11-04 15:22 | `40bf7b5` | Docs: both live links now run 353d729 |
| 2026-11-04 15:22 | `9774b3c` | docs: regenerate the build log |
| 2026-11-04 15:26 | `0694341` | Docs: one sentence on the film and the Needs review state, the same in README and submission |
| 2026-11-04 15:26 | `dfda929` | docs: regenerate the build log |
| 2026-11-04 15:32 | `6fa948a` | Coverage: a model's form check cannot link a corrected fact back to the points it covered |
| 2026-11-04 15:37 | `4fed839` | Docs: both live links now run 6fa948a |
| 2026-11-04 15:37 | `48ee98c` | docs: regenerate the build log |
| 2026-11-04 15:43 | `038f56f` | Docs: quotes checked against the transcript you reviewed; current test count |
| 2026-11-04 15:43 | `9d08bf4` | docs: regenerate the build log |
| 2026-11-04 15:55 | `0cde37a` | Judge flow: a clear next step after the correction, the covered count with the point that needs review, a visible Start again confirm, and a still-working line |
| 2026-11-04 16:08 | `6f8c212` | Count the form's requirements apart from the optional cover-letter check |
| 2026-11-04 16:29 | `3ee23f2` | A corrected point stays Needs review: the model may not cover it with another fact until the applicant answers its question |
| 2026-11-04 16:38 | `34c1b5c` | Docs: both live links now run 3ee23f2 |
| 2026-11-04 16:38 | `6199ab6` | docs: regenerate the build log |
| 2026-11-04 18:28 | `b367407` | Docs: the film recorded on 3ee23f2 (https://youtu.be/K_4oT1R2GTc) |
