// Who did what a fact in another language says, from the actor tag the applicant confirmed with
// it: "Ana did this" where a line names her, "You did this" in her own view. English facts carry
// no tag; their wording says who did it.
const DID = { self: (who) => `${who} did this`, team: () => 'The team did this', other: () => 'Someone else did this' };

export const actorLabel = (actor, name) => DID[actor]?.(name || 'You') ?? null;

// A fact's source line with who did it added, for a fact in another language only.
export const withActor = (label, fact, name) => [label, fact?.language ? actorLabel(fact.actor, name) : null].filter(Boolean).join(' · ');
