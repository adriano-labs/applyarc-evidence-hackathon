# Event provenance

This is a standalone ApplyArc Evidence submission for the Meta Global AI Developer Hackathon. ApplyArc and earlier design/prototype work predated the event; that earlier work is not presented as event-built functionality. This repository records the new event implementation and has no private ApplyArc source or service dependency.

| Record | Evidence |
|---|---|
| Event build opened | 26 October 2026, 16:24 UTC / London, following the organisers’ post-kickoff announcement. |
| First repository commit | `925f815`, 26 October 2026, 21:20:04 UTC. Inspect with `git log --reverse`. |
| Implementation history | Starts with the event repository. The project record states the implementation was written fresh, without copying the earlier private prototype. This is a development record, not an independent provenance audit. |
| Development tools | Claude Code, OpenAI Codex and GitHub Copilot CLI, directed by ApplyArc’s founder. Model generation does not replace source review and tests. |
| Runtime models | Meta Muse Wonder 1.0 and Spark 1.3 through Meta’s API; Meta Muse Spark Open through a compatible endpoint. Fixture mode is handwritten and labelled. |
| Current filmed hosted run | Source `a404886`, 2 November: real Wonder clarification, two repairs with 17 passages untouched, targeted review/revision, renewed approvals and NOT SUBMITTED export. [Sanitized evidence](results/wonder-20261102/). |
| Current source and guard | `a404886` adds deterministic approval invalidation for newly added evidence. It passed 965 local tests and build and is deployed as `applyarc-evidence--approvalsa404886`; its real-Wonder hosted 19-command journey and direct unread-evidence guard checks passed. |
| Comparison boundary | The six-case comparison and historical v9 rehearsal evaluated `3547156`. The later guard and successful v10 recording do not rewrite those scores or establish improved semantic detection. |

All applicant stories and exported samples are synthetic. The Graphcore form is a public snapshot dated 26 October 2026; it is not a partnership or endorsement. Dependencies and fonts retain their respective licences. See the lockfile and [MIT licence](LICENSE) for this project.

The submission video must accurately distinguish the event implementation from earlier work. Public repository and final accessible video publication remain pending. No prize, organiser endorsement or independent audit is claimed.
