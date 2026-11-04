// The applicant's language, named in English for the screen ("Portuguese"), and which of her
// sources and facts are in a language other than English. English has no language field.
const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en-GB'], { type: 'language' }) : null;

export function languageName(code) {
  try { return names?.of(String(code).split('-')[0]) ?? code; } catch { return code; }
}

// The languages of a set of facts (or pack references), English left out.
export const languagesOf = (items = []) => [...new Set(items.map((i) => i?.language).filter(Boolean))];

// The language of the applicant's latest own words in a workspace (undefined is English).
export const workspaceLanguage = (ws) => (ws?.applicant?.sources ?? []).filter((s) => s.kind !== 'correction').at(-1)?.language;

// The ids of the sources that came from a voice clip.
export const spokenIds = (ws) => new Set((ws?.applicant?.sources ?? []).filter((s) => s.spoken).map((s) => s.id));
