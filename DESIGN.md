---
name: ApplyArc Evidence
description: Application answers you can stand behind, set as a referenced paper.
colors:
  paper: "#f4f6f9"
  sheet: "#ffffff"
  rule: "#dde2ea"
  rule-strong: "#c3cad5"
  ink: "#121a26"
  pencil: "#475467"
  muted: "#5a6474"
  faint: "#8a93a3"
  oxford: "#0e2a47"
  oxford-2: "#173a5e"
  oxford-3: "#24507d"
  on-oxford: "#eaf0f7"
  on-oxford-muted: "#a8b8cd"
  highlight: "#ffe36e"
  highlight-soft: "#fff4b8"
  needs: "#b8125a"
  needs-soft: "#ffe3ef"
  confirmed: "#17703f"
  confirmed-soft: "#e2f3e9"
  danger: "#b42318"
  danger-soft: "#fdecea"
  focus: "#2563b0"
typography:
  display:
    fontFamily: "'STIX Two Text', 'Iowan Old Style', Georgia, serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "'STIX Two Text', 'Iowan Old Style', Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.5
  question:
    fontFamily: "'STIX Two Text', 'Iowan Old Style', Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.45
  manuscript:
    fontFamily: "'STIX Two Text', 'Iowan Old Style', Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.7
  document-small:
    fontFamily: "'STIX Two Text', 'Iowan Old Style', Georgia, serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  quote:
    fontFamily: "'STIX Two Text', 'Iowan Old Style', Georgia, serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
  citation:
    fontFamily: "'STIX Two Text', 'Iowan Old Style', Georgia, serif"
    fontSize: "0.68em"
    fontWeight: 600
    lineHeight: 0
  brand:
    fontFamily: "'STIX Two Text', 'Iowan Old Style', Georgia, serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum'"
  control:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.2
  meta:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.06em"
  data:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  mark: "2px"
  tag: "3px"
  stamp: "4px"
  control: "6px"
  sheet: "10px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
  measure: "66ch"
  rail-left: "300px"
  rail-right: "380px"
components:
  topbar:
    backgroundColor: "{colors.oxford}"
    textColor: "{colors.on-oxford}"
    padding: "8px 24px"
    height: "52px"
  button-primary:
    backgroundColor: "{colors.oxford}"
    textColor: "{colors.on-oxford}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.oxford-2}"
    textColor: "{colors.on-oxford}"
  button-primary-big:
    backgroundColor: "{colors.oxford}"
    textColor: "{colors.on-oxford}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  button-small:
    rounded: "{rounded.control}"
    padding: "5px 10px"
  button-pressed:
    backgroundColor: "{colors.oxford}"
    textColor: "{colors.on-oxford}"
  button-link:
    textColor: "{colors.oxford-3}"
    typography: "{typography.control}"
    padding: "8px 0"
  topbar-button:
    textColor: "{colors.on-oxford}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "4px 10px"
  topbar-button-hover:
    backgroundColor: "{colors.oxford-2}"
  mode-badge:
    textColor: "{colors.on-oxford}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  mode-badge-meta:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.oxford}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  brand-mark:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.oxford}"
    rounded: "{rounded.tag}"
    padding: "3px 5px 2px"
  tab:
    textColor: "{colors.muted}"
    typography: "{typography.control}"
    padding: "8px 12px"
  tab-selected:
    textColor: "{colors.ink}"
  manuscript-sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.pencil}"
    typography: "{typography.manuscript}"
    rounded: "{rounded.sheet}"
    padding: "48px 48px 32px"
  rail-panel:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "24px"
  citation:
    textColor: "{colors.oxford-3}"
    typography: "{typography.citation}"
    rounded: "{rounded.tag}"
  citation-active:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.ink}"
  quote-mark:
    backgroundColor: "{colors.highlight-soft}"
    rounded: "{rounded.mark}"
    padding: "0 2px"
  quote-mark-active:
    backgroundColor: "{colors.highlight}"
  reference-active:
    backgroundColor: "{colors.highlight-soft}"
    rounded: "{rounded.control}"
    padding: "12px"
  diff-deleted:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.mark}"
    padding: "0 2px"
  diff-inserted:
    backgroundColor: "{colors.confirmed-soft}"
    textColor: "{colors.confirmed}"
    rounded: "{rounded.mark}"
    padding: "0 2px"
  chip-approved:
    backgroundColor: "{colors.confirmed-soft}"
    textColor: "{colors.confirmed}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-stale:
    backgroundColor: "{colors.needs-soft}"
    textColor: "{colors.needs}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-proposed:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.oxford-3}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  chip-needs:
    backgroundColor: "{colors.needs-soft}"
    textColor: "{colors.needs}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  mark-corrected:
    backgroundColor: "{colors.confirmed-soft}"
    textColor: "{colors.confirmed}"
    rounded: "{rounded.tag}"
    padding: "1px 5px"
  mark-pending:
    backgroundColor: "{colors.needs-soft}"
    textColor: "{colors.needs}"
    rounded: "{rounded.tag}"
    padding: "1px 5px"
  requirement-tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.oxford-3}"
    rounded: "{rounded.pill}"
    padding: "1px 7px"
  stamp-not-submitted:
    textColor: "{colors.danger}"
    rounded: "{rounded.stamp}"
    padding: "4px 10px"
  text-field:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
---

# Design System: ApplyArc Evidence

## Overview

**Creative North Star: "The Referenced Paper"**

An application is set the way a well-referenced paper is set. Every drafted sentence carries a numbered citation to a fact the applicant confirmed in their own words. The references sit beside the manuscript, and the quoted words are marked with a highlighter. When a fact changes, a corrigendum lists exactly the sentences that cite it, and nothing is silently rewritten. The workspace is a desk: a cool paper ground, white sheets for documents, and an Oxford-blue shell that frames the work without competing with it.

Density is that of a working document, not a dashboard. Three columns hold the form being answered, the manuscript at a fixed reading measure, and the evidence rail. Hierarchy comes from the two type voices and from scale, not from colour blocks or decoration. Colour is semantic and sparse: yellow is evidence, pink is "needs you", green is confirmed, red is struck. The confirmed anti-references are the chat-bubble AI writer and the card dashboard with a purple glow.

States leave a trace. Superseded wording is struck through rather than deleted, the export is stamped NOT SUBMITTED, and the run mode (fixture or Meta) is always labelled in the shell.

**Key Characteristics:**
- Cool paper ground with white sheets and an Oxford-blue top bar.
- STIX Two Text for everything that is a document; system UI sans for controls and metadata.
- Inline superscript citations after each claim, each linked live to a numbered reference.
- Highlighter yellow only on words the applicant wrote that a fact quotes.
- A corrigendum queue that strikes old wording and inserts new wording, with the applicant deciding each change.
- Ink for the applicant's own words, pencil for drafted words, with a pen mark as the second signal.

## Colors

A near-neutral cool paper palette carried by one deep Oxford blue, with four semantic highlighter colours that each mean exactly one thing.

### Primary
- **Oxford Blue** (#0e2a47): the shell. The top bar, the primary button fill, the pressed choice, and the ink of the brand mark. It frames the workspace; it never decorates content.
- **Oxford Blue, Hover** (#173a5e): hover fill for primary buttons and top-bar buttons.
- **Reference Blue** (#24507d): citation numerals, reference numbers, links, the selected tab underline, the requirement citation list, the word meter fill and the receipts title. Wherever a number points at evidence, it is this blue.

### Secondary
- **Highlighter Yellow** (#ffe36e): the active citation's background, confirmed quotes in the notes, the active quote in the rail, text selection, the brand mark ground and the Meta mode badge.
- **Highlighter Wash** (#fff4b8): quotes at rest (in the rail and in fact cards), proposed quotes in the notes, and the active reference row.

### Tertiary
- **Needs-You Pink** (#b8125a) on **Pink Wash** (#ffe3ef): only what waits on the applicant. An asked requirement, a conflict, a stale approval, an over-limit count, the "change proposed" mark, the wavy underline under a pending sentence, and retry notices.
- **Confirmed Green** (#17703f) on **Green Wash** (#e2f3e9): covered requirements, the approved chip, the "corrected" mark, decided queue chips and inserted wording.
- **Struck Red** (#b42318) on **Red Wash** (#fdecea): deleted wording in the corrigendum, the NOT SUBMITTED stamp, failed receipts and error notices.
- **Focus Blue** (#2563b0): focus rings and focused field borders, nothing else.

### Neutral
- **Cool Paper** (#f4f6f9): the page ground, the hovered sentence, secondary-button hover, quiet chips, and the fact line in the corrigendum.
- **Sheet White** (#ffffff): manuscript, notes, rail panels, dialogs and fields.
- **Hairline** (#dde2ea): dividers: the tab baseline, the manuscript head and foot rules, requirement rows, the word-meter track.
- **Firm Rule** (#c3cad5): control borders and field borders, the scrollbar thumb, and the receipt timeline rule.
- **Ink** (#121a26): the applicant's own words and all primary UI text.
- **Pencil** (#475467): drafted sentences and quoted text in the rail.
- **Graphite** (#5a6474): metadata, counts, hints and small section labels.
- **Faint Graphite** (#8a93a3): icons for unmet states, struck rejected facts and request ids. It is 3.1:1 on white, so it carries no text that must be read.
- **On-Oxford** (#eaf0f7) and **On-Oxford Muted** (#a8b8cd): text on the top bar, primary and secondary.

### Named Rules
**The Highlighter Means Evidence Rule.** Yellow marks only the applicant's own words that a fact quotes, the citation being inspected, and the selection. It never marks status, emphasis or brand decoration beyond the [1] mark.

**The Pink Means You Rule.** Pink appears only where the next move belongs to the applicant. If nothing waits on them, no pink is on screen.

**The Ink and Pencil Rule.** The applicant's words are ink and carry the pen mark; drafted words are pencil. Colour is never the only signal.

## Typography

**Display Font:** STIX Two Text (self-hosted at 400, 400 italic and 600, with Iowan Old Style and Georgia as fallbacks)
**Body Font:** system-ui (with -apple-system, Segoe UI, Roboto and Helvetica Neue)
**Label/Mono Font:** ui-monospace (SF Mono, Cascadia Mono, Menlo), only for tool calls and request ids

**Character:** STIX Two Text is a journal face: sturdy serifs and clear numerals that make the manuscript, the notes and the reference numbers read as a paper. The system sans stays out of its way for buttons, counts and metadata. All UI numerals are tabular.

### Hierarchy
- **Display** (600, 1.625rem, -0.015em): the manuscript title ("Project answer", "Cover letter") and the notes heading.
- **Headline** (600, 1.25rem): rail section titles ("References", "Corrigendum", "Is this right?", "One question") and the form panel title.
- **Question** (500, 1.25rem, 1.45): the one clarifying question, the largest text in the rail.
- **Manuscript** (400, 1.125rem, 1.7): drafted documents and the applicant's notes, held to 66ch with first-line hanging punctuation and `text-wrap: pretty`.
- **Document small** (400, 0.9375rem, 1.6): the corrigendum fact line and diffs, the form question, the export preview and answer fields.
- **Quote** (400, 0.8125rem, 1.55): verbatim quotes under each reference and fact, inside curly quotes.
- **Citation** (600, 0.68em superscript): reference numerals after the last word of a claim, comma-separated with no space.
- **Body / Control / Meta** (system sans, 0.9375rem body, 0.8125rem 500 for controls and tabs, 0.8125rem 400 for metadata): the working UI.
- **Label** (600, 0.75rem, 0.06em tracking, uppercase): small section headings such as "What the form asks for", "Still to do in the portal" and "Not cited yet", the document name in a corrigendum item, the receipts title, and the inline "corrected" and "change proposed" marks.

### Named Rules
**The Two Voices Rule.** Anything the applicant would print sets in STIX Two Text: documents, notes, quotes, reference numbers, rail titles. Anything they operate sets in the system sans. Never swap them.

**The Measure Rule.** Manuscript and notes prose sits at 66ch, on every width that allows it.

**The Label Is a Heading Rule.** A small uppercase label is a heading in its own right. It never sits above another heading or above the text it introduces.

## Layout

The shell is a 52px Oxford top bar over the workspace, capped at 1680px and centred. On a laptop (768–1439px) the workspace has two columns: the document column (fluid, minimum 0) and the evidence rail (`--rail-right`: clamp(280px, 26vw, 380px)); the brief sits as a one-line strip above the tabs. From 1440px the brief becomes its own 280px column on the left (`--brief`). Gaps and outer padding are 24px. The brief and the rail are sticky 24px below the top of the viewport and scroll on their own, so the manuscript scrolls while the question and the references stay put.

Spacing runs on a 4px base (4, 8, 12, 16, 24, 32, 48). Groups are tight (4–8px inside a reference, 12px between rail items) and separations are generous (24px between rail panels and inside panels).

The document column stacks the step guide, the brief strip (laptop), the tab row, the sheet and the next-step bar, which stays at the foot of the column. The sheet pads `--sheet-pad` (clamp(24px, 3vw, 48px)) at the sides and top and 32px at the foot.

Responsive behaviour:
- Below 1024px, workspace padding and gaps drop to 16px. On screens 820px tall or less, the top padding drops to 16px.
- Below 768px (phone), everything is one column (brief, document, evidence) with 16px padding. A 44px bottom bar (`--phone-bar-h`) switches between Writing and Evidence, the next-step bar sits just above it, the top bar wraps and drops the employer crumb, rails become static, and the tabs use short names.

## Elevation & Depth

Depth is two soft, offset shadows tinted with Oxford blue, plus tonal layering of white sheets on the cool paper ground. There are no hard shadows and no glows. A surface carries a border or a shadow, not both.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 1px rgb(14 42 71 / 0.04), 0 10px 30px -14px rgb(14 42 71 / 0.22)`): paper that holds a document. The manuscript, the notes, the export dialog and the command menu.
- **Lift** (`box-shadow: 0 1px 2px rgb(14 42 71 / 0.06), 0 6px 18px -6px rgb(14 42 71 / 0.18)`): working panels in the rail (facts review, the question, the corrigendum) and the status line and notices.

### Named Rules
**The Paper and Panel Rule.** Documents lie on the desk as sheets; tools sit on lifted panels. Two shadows, no third.

## Shapes

Corners are gently rounded and small. Sheets and panels round at 10px, controls and fields at 6px, the stamp at 4px, tags and inline marks at 3px, and highlighter marks at 2px so they read as ink on paper rather than as chips. Pills (999px) are only for small status chips, the mode badge and requirement tags. Dividers are 1px hairlines. Highlighter marks and hovered sentences use `box-decoration-break: clone` so a mark that wraps keeps its rounded ends on each line.

## Components

### Buttons
- **Shape:** gently rounded (6px), 1px border, system sans at 13px, weight 500.
- **Primary:** Oxford fill with On-Oxford text, 8px by 14px; `big` (12px by 20px, 15px text) for the next-step verb under the sheet. Labels name the next action: "Read my notes", "Write both documents", "Approve version 2", "Apply 2 changes", "Download the pack (.md)".
- **Secondary:** white with a Firm Rule border and ink text; hover turns Cool Paper.
- **Small:** 5px by 10px, used inside rail items.
- **Link:** Reference Blue, underlined with a 0.18em offset, no padding on the sides ("Correct this fact", "Use Ellie's sample notes").
- **Pressed** (`aria-pressed="true"`): Oxford fill, used for the chosen option in a corrigendum item.
- **Disabled:** 45% opacity, no hover change.
- **Focus:** a 2px Focus Blue outline offset by 2px on every control.

### Top bar
- Oxford ground, 52px minimum height. Brand: the `[1]` mark (STIX 600 on Highlighter Yellow, Oxford text, 3px radius) followed by "ApplyArc Evidence" in STIX 600.
- The crumb shows the employer in On-Oxford 500 and the role in On-Oxford Muted, separated by a middle dot.
- **Mode badge:** a pill with a 1px Reference Blue border. Fixture is dashed ("Fixture: hand-written outputs, not a model"), and Meta is filled Highlighter Yellow with Oxford text. The spend reads "$0.00 of $2.00" in tabular figures beside it.
- Top-bar buttons (the command key and "Start again") are transparent with a 1px Reference Blue border and an Oxford Hover fill. "Start again" arms on the first press and clears on the second.

### Tabs

- Two lines per tab. The name is 15px sans 500, Graphite at rest; the selected tab is ink over a 2px Oxford underline that sits on the tab row's hairline. Under it, the state in 13px Graphite: "Start here", "Reading…", "11 to check" (pink) or "14 facts confirmed" for the notes; "Not written yet", "Version 1 · 206 of 300 words", a 14px check and "Approved · version 2" in Confirmed Green, or "Changed: review version 2", "Change proposed" and "312 of 300 words: over" in pink for the documents.
- On phones the names shorten to Notes, Answer and Letter (13px 600, states 12px) and the three tabs share the width.
- The keys 1, 2 and 3 still switch tabs. They are announced (`aria-keyshortcuts` and a "Press 2" tooltip) but no digit is drawn.

### Manuscript and sentences (signature)

- A white sheet with the Sheet shadow. Its head, rows 4px apart over a hairline with 16px below:
  - the Display title, with the approval chip on the right;
  - a meta line ("Version 2 · 217 of 300 words · ") ending in the receipt stamp, a Reference Blue link that opens the receipts: "Drafted by muse-spark-1.3 · What Meta did ›" on Meta, "Drafted by <model> (stand-in, not Meta) · What the model did ›" for a stand-in, "Hand-written fixture, not a model · What the model did ›" on fixtures. The model name comes from the newest draft receipt;
  - the evidence line, after a 14px Confirmed Green check, counted from the document: "13 claims, each citing a fact you confirmed · 1 sentence in your own words · 2 greeting or sign-off lines";
  - until a citation is first used, the hint "Point at a number to see the words it came from; click it to keep it lit. Click a sentence to edit it." in Graphite;
  - the italic corrigendum notice, when there is one.
- The foot appears only for the over-limit warning in pink. Approving lives in the next-step bar, so there is one Approve.
- Drafted sentences are pencil; the applicant's sentences are ink followed by a 12px pen icon labelled "Your words". A hovered or focused sentence, and every sentence citing the shown fact, takes a Cool Paper background. Clicking a sentence opens it in place as a field with Save and Cancel (Esc cancels, Cmd or Ctrl and Enter saves).
- **Inline marks:** "corrected" (green on Green Wash) after a sentence a corrigendum changed, and "change proposed" (pink on Pink Wash) after a sentence awaiting a decision, which also takes a 1px wavy pink underline. Both are 12px uppercase sans with a 3px radius.

### Citation (signature)

- Superscript numerals in STIX 600 at 0.68em, Reference Blue, after the last word of the claim. The last word and its numerals never wrap apart. Several numerals are comma-separated.
- Each numeral is a button. Hover or focus previews: it turns Highlighter Yellow with ink text, lifts the matching reference in the rail (Highlighter Wash row, its quote turning full yellow) and scrolls that reference into view. A click pins the fact: it stays lit after the pointer leaves, and every sentence citing it takes Cool Paper. A second click or Esc unpins. The brief's checklist lists the same numbers in brackets, such as "[1, 2, 13]".

### References
- A numbered list under a Headline "References". Each entry: the number in STIX 600 in a 28px right-aligned column; the fact statement in 13px sans 500; the verbatim quote in STIX 13px Pencil inside curly quotes, marked with Highlighter Wash; the source ("From your notes", "From your answer", "From your correction") in 12px Graphite; and a "Correct this fact" link.
- Confirmed facts no document cites yet sit under a "Not cited yet" label without a number. Rejected facts stay in a closed "Rejected (n)" disclosure, struck through.
- Correcting a fact opens a field in place ("The fact, in your words") with "Save the correction", and explains that every sentence citing it will be proposed for review.

### Facts review

- A lifted rail panel headed "Is this right?", with a count ("Fact 3 of 14"). One fact at a time: first "Yes, confirm" (small primary) and "Not right" (small), then the statement, its quote with a Highlighter Wash mark, its source and the requirements it covers as pill tags (Reference Blue on Cool Paper), and the key hint "Enter: yes · Backspace: not right" in 12px Graphite. The card has a 1px Reference Blue outline and no fill. While a fact is current, its quote is lit full yellow in the notes.
- After the first decision, "Confirm the remaining N" (small) confirms the rest in one step. A "Next" list shows the remaining statements in 13px Graphite. The foot says what comes next: the app checks the facts against what the employer asks for.

### One question
- A lifted rail panel headed "One question". The question itself is the largest rail text (STIX 500, 20px), followed by why it is asked in Graphite, an answer field in STIX, a help line, and three actions: "Use Ellie's sample answer" (link), "Skip: leave it out" (secondary) and "Answer" (primary, disabled until there is text).

### Correction review (signature)

- Before approving, the next-step bar invites the sample correction: "Try Ellie's correction" as the primary, with Approve beside it. It opens that reference's correction already filled in, says that only the sentences citing it will be rewritten, and puts Save in reach.
- During a repair, "What changed" and "Undo this correction" share a wrapping header. The corrected fact leads into actual unique-document, affected-sentence and untouched-sentence counts. Unknown untouched counts stay absent. The detailed summary remains a polite screen-reader announcement without repeating the visible counts. Pending work says "affected", not "to review". A pink "1 needs you" pill appears only when something needs the applicant.
- From 768px, repair gets a 46/54 document/review split. The brief stays a compact strip and its expanded question scrolls within 40dvh. The shell fits the viewport with independent document and review scrolling; Apply stays visible at the review foot. Phones retain natural scrolling and the existing Writing/Evidence switch. Normal drafting and guided mode keep their existing layout.
- **Fact line:** on Cool Paper at 6px radius, the reference number in Reference Blue, then the old statement struck (Struck Red, 1.5px line-through, Red Wash) and the new statement inserted (Confirmed Green, 1.5px underline, Green Wash).
- **Change items:** each has a label ("Project answer · cites [10]") and its state in a pill: Proposed (Reference Blue on Cool Paper), Needs you or Needs review (pink), Taking the rewrite, Keeping it or Your wording (green), Waiting (Graphite). Whole sentences use STIX 15px with "Was" and "Now" labels and word-level strike/underline. At 420px of review width they sit side by side; below that they stack. A sentence the applicant edited remains an explicit conflict. The choices stay in one radio group: "Take the rewrite", "Keep as is" (or "Keep mine") and "Write my own"; the chosen one takes the Oxford fill with a check. Controls have at least 40px height; document-navigation links use the shared button style.
- Keys: j and k (or the arrows) move between items with a 2px Focus Blue outline while the queue has focus; there is no yellow in the queue. y takes the rewrite, n keeps the sentence. "Apply n changes" stays disabled until every item that needs the applicant is decided ("Decide 1 more first.").

### Status line and notices
- While a model step runs, a thin Oxford-blue stroke moves across a quiet rule above the actual current stage. No percentage, estimated finish time or invented activity. The latest three real events are available without repeating the current stage; the next review action stays clear.
- Timing and character counts use a native disclosure, outside the single polite status announcement. The clock updates once per second only when open and visible; motion pauses when hidden and becomes static with reduced motion. No new animation dependency.
- A document that passes the evidence check can appear while the other is still running. It is explicitly an unsaved, read-only preview, with no edit/approve controls. Saved text is separate. Completion or failure removes temporary previews; a failure remains visible with recovery controls.
- Notices: info on Cool Paper with a hairline border, errors in Struck Red on Red Wash, each with "Dismiss" and, when possible, "Try again".

### What Meta did (receipts)
- Header activity stays compact. The manuscript identifies the model family, while its accessible name, hover title and existing receipt retain the exact model that drafted it. Fixture and non-Meta output remain explicitly labelled. No model provenance is inferred from visual styling.
- At the foot of the rail, under a hairline. The label reads "What Meta did" in Meta mode and "What the model did" otherwise, over one summary line: model, runs, steps, tool calls, time and cost. Opened from the top bar or the stamp, the trail takes the rail with "Back to your evidence" at its head, unless a facts review, question, correction or repair queue waits on the applicant: then it opens under that panel.
- Opened, it is a trail of numbered runs ("Read your notes", "Checked the form", "Wrote both documents", "Proposed changes after your correction"), each with its summed model time and cost, a check once no step in it failed, and "Did not finish" when it ended in a failure. Each row is one plain sentence tagged by who did it: the model family ("Wonder", "Spark"), "Fixture", "Checked by code" for the app's own quote, word-count and form checks, "The app" for the loop's recorded decisions, and "You" for decisions read from saved state (facts confirmed, questions answered, changes applied, versions approved). Every technical fact (model, host, tokens, timing, cost, tool calls, request ids, any error in red) sits in a closed "Details" disclosure. The foot says who proposes, what the app checks by code and what the applicant decides, then the italic footnote "A word-for-word match proves the quote, not the claim." and "Download the trace (JSON) to verify this run".

### Export pack

- A dialog over a 45% Oxford backdrop: a white sheet, 760px maximum (full screen on phones), rising 8px and fading in over 240ms. Its head, rows 16px apart:
  - "Your application pack" in STIX 600 and the close button;
  - the **NOT SUBMITTED** stamp (13px sans 700, 0.12em tracking, Struck Red text inside a 2px Struck Red border, 4px radius, turned -2°, its own width);
  - the employer and role;
  - the notice in 15px ink at 66ch;
  - a Graphite contents line: "In this pack: Project answer, version 2 · Cover letter, version 2 · 12 portal tasks".
- Each document has a head row with its sans meta heading ("Project answer · version 2 · 217 of 300 words") and a "Copy the project answer" button, which reads "Copied" for two seconds. Then come its paragraphs in STIX at 66ch, and "References": each number, its statement, and the applicant's own words in curly quotes with a Highlighter Wash mark.
- "Still to do in the portal" is a numbered list, in two columns from 768px.
- A sticky footer keeps "Download the pack (.md)" and "Close" in view. Esc closes the dialog, and focus returns to the button that opened it.

### Inputs / Fields
- White, 1px Firm Rule border, 6px radius, 12px padding. Fields for the applicant's words set in STIX; correction fields set in sans. Focus turns the border Focus Blue. The caret is Reference Blue.

### Form panel

- Now the brief. On a laptop it is a one-line strip above the tabs ("Graphcore · project answer, up to 300 words · 5 of 5 covered") with "Show the question". Opened, it holds the form title, the question in STIX 15px and the "What the form asks for" checklist. Its 16px icons are a green check when covered, a pink question when asked, a grey minus when skipped and an empty circle when missing, each with its state and its citation numbers grouped as "[1, 2, 13]". A line says the portal tasks are listed in the export pack, and the dated source of the form snapshot closes it. From 1440px the brief is its own 280px column.

### Step guide and next-step bar
- Under the top bar: six steps in one row (Notes, Facts, Question, Drafts, Approve, Export). The current one is marked with `aria-current` and shows what waits on the applicant ("11 to check", "1 to answer", "1 of 2 approved") in a pink or Graphite chip; finished steps take a green check. On phones the row reads "Step 1 of 6 · Notes".
- The next-step bar holds the foot of the document column. On the left is a "Now:" line (what to do) and a "Then:" line (what happens next) in 13px. On the right are "Show me" when the step lives in the rail, an optional secondary action, and the primary as the big button. While a model step runs, the status line takes the left side.

### Example page
- A document not written yet shows its title and "Not written yet · up to 300 words" (or "about 400 words (a guide; the form sets no limit)"), plus one line on what it will become. Below that sits an "Example" block on Cool Paper: a Pencil sentence with a Reference Blue superscript 1, then its reference, with the number, Ellie's verbatim quote under a Highlighter Wash mark and "From your notes". Then the current step ("You are on step 1 of 6. Writing starts at step 4.") and a button back to it.

## Do's and Don'ts

### Do:
- **Do** cite every drafted claim with superscript numerals that link to a numbered reference quoting the applicant verbatim.
- **Do** keep Highlighter Yellow (#ffe36e) and its wash (#fff4b8) for quoted evidence and the citation being inspected.
- **Do** strike old wording and insert new wording (Struck Red and Confirmed Green with 1.5px lines) instead of replacing text silently.
- **Do** label the run mode in the top bar at all times: dashed for fixture, yellow only for Meta.
- **Do** set documents in STIX Two Text at 66ch and controls in the system sans with tabular figures.
- **Do** mark the applicant's own sentences in ink with the pen icon, so colour is never the only signal.
- **Do** stamp the export NOT SUBMITTED in Struck Red.
- **Do** give every control the 2px Focus Blue ring and a keyboard path (1, 2 and 3 for tabs, Enter and Backspace for facts, j, k, y and n for the corrigendum, Cmd or Ctrl and K for commands).

### Don't:
- **Don't** build a chat-bubble AI writer or a card dashboard with a purple glow.
- **Don't** use yellow for status or decoration, or pink for anything that does not wait on the applicant.
- **Don't** nest a bordered box inside a lifted panel; items inside a panel are rows divided by hairlines.
- **Don't** set a label above a heading or above the question or text it introduces.
- **Don't** draw a coloured rule or inset stripe wider than 1px down the left of a block or a list item.
- **Don't** set text that must be read in Faint Graphite (#8a93a3); it is 3.1:1 on white.
- **Don't** add a third shadow, a hard offset shadow or a glow.
- **Don't** present fixture output as Meta output, in copy or in colour.
