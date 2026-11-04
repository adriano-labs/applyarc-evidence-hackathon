// Fixture mode: hand-written outputs for the sample applicant, and plain
// deterministic fallbacks for anything else. Labelled on screen; never
// presented as model output.
import { normalise } from '../domain/text.js';

// A fact in another language also carries who did it.
const pick = ({ statement, quote, requirementIds, actor }) => ({ statement, quote, requirementIds, ...(actor ? { actor } : {}) });
const asked = (q) => (q?.english ? { english: q.english } : {});

// Fixture keys to workspace fact ids, matching current or earlier wording.
function idsByKey(allFacts, facts, includeHistory = false) {
  const byQuote = new Map();
  for (const f of facts) for (const q of [f.quote, ...(includeHistory ? (f.history ?? []).map((h) => h.quote) : [])]) byQuote.set(normalise(q), f.id);
  return new Map(allFacts.map((x) => [x.key, byQuote.get(normalise(x.quote))]).filter(([, id]) => id));
}

function sentences(text) {
  return normalise(text).split(/(?<=[.!?])\s+/).filter((s) => s.split(' ').length >= 4);
}

function receipt(step, emit) {
  emit({ type: 'receipt', receipt: { step, provider: 'fixture', model: 'fixture', costUsd: 0, toolCalls: [] } });
}

export function createFixtureAgent({ data, sampleNotes, forms } = {}) {
  const sample = normalise(sampleNotes);
  const allFacts = [...(data.facts ?? []), ...(data.answerFacts ?? [])];
  const extraForms = forms ?? {};

  return {
    provider: { id: 'fixture', label: 'Fixture', model: 'hand-written', isMeta: false },

    async extract({ form, source, emit = () => {} }) {
      const text = normalise(source.text);
      const extra = form?.id ? extraForms[form.id] : null;
      // A sample with its own form and notes (Ana's) has its own hand-written facts.
      const own = extra?.notes && text === normalise(extra.notes) ? extra.facts : extra && text === normalise(extra.answer) ? extra.answerFacts : null;
      if (own) {
        receipt('extract', emit);
        return { facts: own.map(pick) };
      }
      let facts;
      if (text === sample) facts = (data.facts ?? []).map(pick);
      else if (text === normalise(data.answer)) facts = (data.answerFacts ?? []).map(pick);
      else facts = sentences(source.text).map((s) => ({ statement: s, quote: s, requirementIds: [] }));
      receipt('extract', emit);
      return { facts };
    },

    async clarify({ form, askable, facts = [], notes, emit = () => {} }) {
      const extra = form?.id ? extraForms[form.id] : null;
      if (extra) {
        const extraAllFacts = [...allFacts, ...(extra.facts ?? []), ...(extra.answerFacts ?? [])];
        const ids = idsByKey(extraAllFacts, facts);
        const coverage = (extra.coverage ?? [])
          .map((c) => {
            const factIds = (c.keys ?? []).map((k) => ids.get(k)).filter(Boolean);
            if (!factIds.length) return null;
            return { requirementId: c.requirementId, factIds };
          })
          .filter(Boolean);
        const questions = askable.map((r) => ({
          requirementId: r.id,
          question: extra.questions?.[r.id]?.question ?? data.questions?.[r.id]?.question ?? `The form asks: “${r.text}”. What would you say?`,
          ...asked(extra.questions?.[r.id]),
          why: extra.questions?.[r.id]?.why ?? data.questions?.[r.id]?.why ?? 'None of your confirmed facts covers this yet.',
        }));
        receipt('clarify', emit);
        return { coverage, questions };
      }
      const questions = askable.map((r) => ({
        requirementId: r.id,
        question: data.questions?.[r.id]?.question ?? `The form asks: “${r.text}”. What would you say?`,
        why: data.questions?.[r.id]?.why ?? 'None of your confirmed facts covers this yet.',
      }));
      receipt('clarify', emit);
      return { coverage: [], questions };
    },

    async draft({ form, docId, facts, emit = () => {} }) {
      const extra = form?.id ? extraForms[form.id] : null;
      if (extra) {
        const extraAllFacts = [...allFacts, ...(extra.facts ?? []), ...(extra.answerFacts ?? [])];
        const ids = idsByKey(extraAllFacts, facts);
        let segments = (extra.drafts?.[docId] ?? [])
          .filter((s) => (s.cite ?? []).every((k) => ids.has(k)))
          .map((s) => ({ kind: s.kind, text: s.text, factIds: (s.cite ?? []).map((k) => ids.get(k)), startsParagraph: Boolean(s.startsParagraph) }));
        if (!segments.some((s) => s.kind === 'claim')) {
          segments = facts.map((f) => ({ kind: 'claim', text: f.quote, factIds: [f.id], startsParagraph: false }));
        }
        receipt(`draft-${docId}`, emit);
        return { segments };
      }
      const ids = idsByKey(allFacts, facts);
      let segments = (data.drafts?.[docId] ?? [])
        .filter((s) => s.cite.every((k) => ids.has(k)))
        .map((s) => ({ kind: s.kind, text: s.text, factIds: s.cite.map((k) => ids.get(k)), startsParagraph: Boolean(s.startsParagraph) }));
      if (!segments.some((s) => s.kind === 'claim')) {
        segments = facts.map((f) => ({ kind: 'claim', text: f.quote, factIds: [f.id], startsParagraph: false }));
      }
      receipt(`draft-${docId}`, emit);
      return { segments };
    },

    // The corrected fact's quote is the correction's own words (in English its statement too).
    async repair({ form, fact, items, emit = () => {} }) {
      const extra = form?.id ? extraForms[form.id] : null;
      const story = extra?.correction ? extra : data;
      if (!story.correction || normalise(fact?.quote) !== normalise(story.correction.text)) {
        receipt('repair', emit);
        return { rewrites: [] };
      }
      const known = story === data ? allFacts : [...(extra.facts ?? []), ...(extra.answerFacts ?? [])];
      const key = [...idsByKey(known, [fact], true)].find(([, id]) => id === fact.id)?.[0];
      const written = (story.repairs ?? {})[key] ?? {};
      const rewrites = items
        .filter((i) => written[i.docId])
        .map((i) => ({ segmentId: i.segmentId, text: written[i.docId], factIds: i.factIds }));
      receipt('repair', emit);
      return { rewrites };
    },
  };
}
