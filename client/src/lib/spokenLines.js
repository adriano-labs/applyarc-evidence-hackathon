// Lines that say a document came from words in another language, built only from the workspace and
// the receipts the client holds. An English workspace gets none of them.
import { languageName, languagesOf } from './language.js';
import { family } from './trail.js';

const citedFacts = (ws, doc) => {
  const byId = new Map((ws?.applicant?.facts ?? []).map((f) => [f.id, f]));
  return (doc?.segments ?? []).flatMap((s) => s.factIds ?? []).map((id) => byId.get(id)).filter(Boolean);
};

// "Drafted with Muse Wonder from words spoken in Portuguese; Ana confirmed each English meaning."
export function draftedFromLine(ws, doc, receipts = []) {
  const langs = languagesOf(citedFacts(ws, doc));
  if (!langs.length) return null;
  const said = (ws?.applicant?.sources ?? []).some((s) => s.kind === 'notes' && s.spoken) ? 'spoken' : 'written';
  const draft = (Array.isArray(receipts) ? receipts : []).findLast((r) => r?.flow === 'draft' && r.model);
  const by = draft?.provider === 'fixture' ? 'Written by the hand-written fixture' : draft ? `Drafted with ${family(draft.model, draft.isMeta).name}` : 'Drafted';
  return `${by} from words ${said} in ${langs.map(languageName).join(' and ')}; ${ws?.applicant?.name ?? 'you'} confirmed each English meaning.`;
}
