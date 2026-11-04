// A workspace loaded from a prepared state: its marker's run in words, and whether the visitor
// has added their note yet. The key moment stays open until they have.
import { family } from './trail.js';

const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// "prepared from a real Muse Wonder run on 3 Nov"; on a host that runs another model (the open-weight
// edition), "prepared on the Muse Wonder link on 3 Nov", since it was not prepared on this one.
export const preparedBy = (prepared, host) => {
  const { name } = family(prepared.model);
  return host && family(host).name !== name ? `prepared on the ${name} link on ${day(prepared.ranAt)}` : `prepared from a real ${name} run on ${day(prepared.ranAt)}`;
};

// Who drafted the Evidence Pass sentences: the live model, or on another model's host the prepared
// run's model for the drafts and this host's for the correction and repair.
export const drafterOf = (mode, prepared) => {
  if (!mode || mode.id === 'fixture') return null;
  const { name } = prepared ? family(prepared.model) : {};
  return name && family(mode.model).name !== name ? `${name} before this visit; ${mode.label} for the correction and repair` : mode.label;
};

export const noteAdded = (ws) => (ws?.applicant?.sources ?? []).some((s) => s.at >= ws.prepared.loadedAt);

// A prepared workspace lives at the key moment until the note is in and both documents are approved again.
export const atKeyMoment = (ws, next) => Boolean(ws?.prepared) && !(next === 'export' && noteAdded(ws));
