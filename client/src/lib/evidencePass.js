// Evidence Pass: one self-contained page the applicant can attach to an application.
// Every cited sentence opens the applicant's own words behind it. Nothing is loaded
// from anywhere, and every piece of text is escaped.
import { actorLabel } from './actor.js';
import { languageName, languagesOf } from './language.js';

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sourceOf = (from, spoken) => (from === 'answer' || from === 'correction' ? from : spoken ? 'voice note' : 'notes');

const sentence = (s, applicant) => (s.refs?.length
  ? `<button type="button" class="sentence" data-refs="${s.refs.join(' ')}">${escape(s.text)}</button>`
  : escape(s.text)) + (s.own ? ` <span class="own">written by ${escape(applicant)}</span>` : '');

// Sentences join their paragraph; a sentence that starts one opens a new <p>.
function paragraphs(sentences, applicant) {
  const out = [];
  for (const s of sentences) {
    if (s.startsParagraph || !out.length) out.push([]);
    out.at(-1).push(sentence(s, applicant));
  }
  return out.map((p) => `<p>${p.join(' ')}</p>`).join('\n');
}

// Her words in another language come first, then the English meaning she confirmed and who did it.
function words(r, applicant) {
  if (!r.language) return `<q>${escape(r.quote)}</q> <span class="from">From ${escape(applicant)}’s ${sourceOf(r.from)}</span>`;
  const who = actorLabel(r.actor, applicant);
  return `<q lang="${escape(r.language)}">${escape(r.quote)}</q> <span class="meaning">In English (working translation): ${escape(r.statement)}</span> <span class="from">From ${escape(applicant)}’s ${sourceOf(r.from, r.spoken)}${who ? ` · ${escape(who)}` : ''}</span>`;
}

// The languages the cited words were in, named in English ("Portuguese"); none for English.
const spokenIn = (documents) => languagesOf(documents.flatMap((d) => d.references ?? [])).map(languageName).join(' and ');
const said = (documents) => (documents.some((d) => d.references?.some((r) => r.spoken)) ? 'spoke' : 'wrote');

const references = (doc, applicant) => (doc.references?.length
  ? `<ol class="refs">${doc.references.map((r) => `<li id="${escape(doc.id)}-ref-${escape(r.n)}" class="ref">${words(r, applicant)}</li>`).join('')}</ol>`
  : '');

const document = (doc, applicant) => `<section class="doc"><h2>${escape(doc.title)}</h2>\n${paragraphs(doc.sentences ?? [], applicant)}\n${references(doc, applicant)}</section>`;

// What drafted the sentences (or that the fixture's are hand-written), and which are the applicant's own wording.
function footer(documents, applicant, drafter) {
  const a = escape(applicant);
  const spoken = escape(spokenIn(documents));
  const from = spoken ? `from words ${a} ${said(documents)} in ${spoken}; ${a} confirmed each English meaning` : `from ${a}’s confirmed words`;
  const made = drafter
    ? `These sentences were drafted with AI (${escape(drafter)}) ${from}`
    : `These sentences are hand-written demo text, not AI output${spoken ? `, ${from}` : ''}`;
  const own = documents.some((d) => d.sentences?.some((s) => s.own))
    ? ` Sentences marked “written by ${a}” are ${a}’s own wording; the app did not check them against ${a}’s facts.`
    : '';
  return `<footer><p>${made}, and ${a} approved this exact version.${own}</p>
<p>This is ${a}’s own evidence, shared by ${a}. It is not a reference check or an assessment of ${a}.</p></footer>`;
}

const STYLE = `
:root { color-scheme: light; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #f4f6f9; color: #121a26; line-height: 1.55; }
main { max-width: 760px; margin: 0 auto; padding: 32px 24px; background: #ffffff; }
h1 { font-size: 1.6rem; margin: 0 0 8px; color: #0e2a47; }
h2 { font-size: 1.2rem; margin: 32px 0 12px; color: #0e2a47; border-bottom: 1px solid #dde2ea; padding-bottom: 4px; }
p { margin: 12px 0; }
.intro, .from, footer { color: #5a6474; }
.sentence { font: inherit; color: inherit; background: none; border: 0; padding: 0; text-align: left; cursor: pointer; text-decoration: underline dotted #0e2a47; text-underline-offset: 3px; }
.sentence.on, .ref.on { background: #ffe36e; }
.refs { margin: 16px 0 0; padding-left: 24px; }
.ref { margin: 6px 0; padding: 2px 4px; }
.from { font-size: 0.9em; }
.own { font-size: 0.8em; color: #5a6474; border: 1px solid #dde2ea; border-radius: 4px; padding: 0 4px; white-space: nowrap; }
footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #dde2ea; }
@media print { body { background: #ffffff; } .sentence { text-decoration: none; } }
.stamp { display: inline-block; margin: 4px 0; padding: 2px 8px; border: 2px solid #b42318; border-radius: 4px; color: #b42318; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.12em; transform: rotate(-2deg); }
.demo { margin: 4px 0; font-size: 0.9em; }`;

const SCRIPT = `
document.querySelectorAll('button.sentence').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.on').forEach(function (e) { e.classList.remove('on'); });
    b.classList.add('on');
    var refs = b.getAttribute('data-refs').split(' ');
    var first = null;
    refs.forEach(function (n) {
      document.querySelectorAll('.ref[id$="-ref-' + n + '"]').forEach(function (e) { e.classList.add('on'); first = first || e; });
    });
    if (first && first.scrollIntoView) first.scrollIntoView({ block: 'nearest' });
  });
});`;

// Only a pass with words in another language says so, and styles the meaning line.
const SPOKEN_STYLE = `
.meaning { display: block; color: #121a26; font-size: 0.95em; }`;
const spokenIntro = (documents, a) => (spokenIn(documents)
  ? ` ${a} ${said(documents)} in ${escape(spokenIn(documents))}; each English meaning is a working translation ${a} confirmed, not a certified one.` : '');

export function evidencePassHtml(pack, { drafter = null } = {}) {
  const applicant = pack.applicant ?? '';
  const documents = pack.documents ?? [];
  const title = `Evidence Pass: ${applicant}, ${pack.application?.role ?? ''} at ${pack.application?.company ?? ''}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>${STYLE}${spokenIn(documents) ? SPOKEN_STYLE : ''}</style>
</head>
<body>
<main>
<header><h1>${escape(title)}</h1>
${pack.status ? `<p class="stamp">${escape(pack.status)}</p>\n` : ''}${pack.demo ? `<p class="demo">${escape(pack.demo)}</p>\n` : ''}<p class="intro">Every cited sentence links to ${escape(applicant)}’s own words, which ${escape(applicant)} confirmed.${spokenIntro(documents, escape(applicant))}</p></header>
${documents.map((d) => document(d, applicant)).join('\n')}
${footer(documents, applicant, drafter)}
</main>
<script>${SCRIPT}</script>
</body>
</html>`;
}
