# Protocol amendment for runs after c18 (declared 2026-10-30T12:22:52Z; set 3, 3B and 4 results unchanged)

From c18 on, the app asks the applicant to decide on the earlier fact an answered conflict was about: correct it, keep it, or remove it. Drafting waits until they do, and nothing is replaced silently. The v4/v5 harness answers a post-packet conflict question with the case's own predeclared correction and then applies that same correction to the anchor fact in its correction step. So after its answer, and only when the app reports an earlier fact waiting, the harness now records an explicit **keep**, and its next step corrects that fact as before. The measured flow is the same as v4/v5; the decision is now explicit and recorded (`proof.conflictSettled`).

**Open for Codex's review before any paid batch:** whether a new protocol should choose **correct** instead, along with the split-fact, source-span and punctuation anchor handling from the set 4 failure classification.
