# Product

<!-- impeccable:product-schema 1 -->

## Platform

Web. Desktop-first judge journey, with responsive layout, keyboard operation, visible focus and reduced-motion behavior as design requirements.

## Stack

React 19 and Vite; Hono on Node 24; pnpm; ESM JavaScript; Vitest. Standalone source and storage, separate from ApplyArc production.

## Users and purpose

Applicants completing a project answer and cover letter from rough personal notes. The product helps them describe their own contribution, inspect the evidence behind generated writing, and repair both documents when a fact changes. Current demo use is synthetic only.

The intended benefit is less repeated explanation and safer review of changes. Human effort savings and general writing superiority are not established. The latest same-Wonder prepared-state comparison found five ties and one assistant win; see [results](results/wonder-20261102/comparison.md).

## Flow

1. Add notes, review extracted facts and confirm or reject them.
2. Answer missing form details; the agent drafts two documents from confirmed evidence.
3. Read the writing, inspect citations and edit your own passages.
4. Add a correction once. Resolve any conflict with **Use this correction** or the explicit fact decision. Review the affected passages in both documents; choose what happens to conflicting manual edits.
5. Approve exact current versions and export **NOT SUBMITTED**, with remaining employer-portal tasks.

New ordinary evidence clears current approvals. Unread evidence or proposed facts block approval/export; reviewing them never automatically restores approval. Direct fact corrections retain selective invalidation. The model’s semantic checks can miss a conflict, so the applicant remains responsible for reviewing facts and writing.

## Meta and controls

The hosted candidate targets Muse Wonder 1.0 through Meta’s Responses API. Spark 1.3, compatible-host Spark Open and optional Voice Transcribe are separately supported. Handwritten fixture output is labelled. Each real model step records model, effort, tools, usage, estimated cost and timing.

The app owns facts, document revisions, manual edits and approvals. Keys stay on the server. Application spend reservations are estimates and require provider allowance headroom. Cookie-based visitor separation is not private sign-in.

## Scope and design principles

- Applicant-side writing and correction; no employer screening, candidate ranking, autofill or automatic submission.
- Show finished writing and the exact proposed change; reveal evidence beside it.
- Keep manual work, ask for meaningful decisions and show honest progress.
- Prefer a clear, readable workspace to extra dashboards or decorative model features.
- Do not claim human demand, testimonials, time savings or hiring outcomes without evidence.

Public release and final video are pending. [README](README.md) records the exact tested and hosted revisions; [PROVENANCE](PROVENANCE.md) records event attribution.
