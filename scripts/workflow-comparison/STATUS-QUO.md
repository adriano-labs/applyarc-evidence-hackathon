# Status-quo arm: what a typical chatbot request produces

Fixed on 29 Oct 2026, before any run.

**Question:** when a job seeker does what most do today, and pastes their notes and what they did into a chatbot asking for an answer and a cover letter, how many claims appear that the person never made?

**Arm:** `scripts/status-quo.mjs`.
* One message per case, built by `statusQuoPrompt`. That function is pinned by `test/status-quo.test.js` and contains:
  * the role and company;
  * the notes;
  * "What I did myself:" followed by the case's clarification answer, exactly as the other arms receive it;
  * the question and word limit;
  * a request for a cover letter.
* There are no questions, no checks and no retries beyond the transport's own.
* The model and effort match the app's drafting step: Muse Spark 1.3 through Meta's API, medium reasoning effort.

**Cases:** held-out set 2, `fixtures/workflow-comparison-holdout-2.json`, 16 cases, frozen at aea7c7f.

**Comparison:** the first drafts of three arms, graded together and blind, with each arm's documents labelled at random:
* this arm;
* the paired baseline;
* the app.

The baseline and app drafts come from their set-2 run on Meta.

**Measures, per arm and case:**
* **Invented claims:** statements, numbers, roles, outcomes, skills or employer facts that nothing the arm was told supports. What the arm was told means the notes, the clarification answer and any follow-up answer that arm received. The clarification's own inflated claim is what the person said, so it is not counted as invented.
* **Repeated a contradicted claim:** whether the draft repeats a clarification claim that the notes themselves contradict, in the cases where the corpus marks that possible.

**Limits:**
* 16 cases, one run each, one AI grader.
* The prompt is one plausible way people ask, not a measured average of real users.
* Human time and real hiring outcomes are not measured.
