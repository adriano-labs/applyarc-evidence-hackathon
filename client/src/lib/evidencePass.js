// Evidence Pass: one self-contained page the applicant can attach to an application.
// Every cited sentence opens the applicant's own words behind it. Nothing is loaded
// from anywhere, and every piece of text is escaped.
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sourceOf = (from) => (from === 'answer' || from === 'correction' ? from : 'notes');

const sentence = (s) => (s.refs?.length
  ? `<button type="button" class="sentence" data-refs="${s.refs.join(' ')}">${escape(s.text)}</button>`
  : escape(s.text));

// Sentences join their paragraph; a sentence that starts one opens a new <p>.
function paragraphs(sentences) {
  const out = [];
  for (const s of sentences) {
    if (s.startsParagraph || !out.length) out.push([]);
    out.at(-1).push(sentence(s));
  }
  return out.map((p) => `<p>${p.join(' ')}</p>`).join('\n');
}

const references = (doc, applicant) => (doc.references?.length
  ? `<ol class="refs">${doc.references.map((r) => `<li id="${escape(doc.id)}-ref-${escape(r.n)}" class="ref"><q>${escape(r.quote)}</q> <span class="from">From ${escape(applicant)}’s ${sourceOf(r.from)}</span></li>`).join('')}</ol>`
  : '');

const document = (doc, applicant) => `<section class="doc"><h2>${escape(doc.title)}</h2>\n${paragraphs(doc.sentences ?? [])}\n${references(doc, applicant)}</section>`;

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
footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #dde2ea; }
@media print { body { background: #ffffff; } .sentence { text-decoration: none; } }`;

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

export function evidencePassHtml(pack) {
  const applicant = pack.applicant ?? '';
  const title = `Evidence Pass: ${applicant}, ${pack.application?.role ?? ''} at ${pack.application?.company ?? ''}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<header><h1>${escape(title)}</h1>
<p class="intro">Every sentence links to ${escape(applicant)}’s own words, which ${escape(applicant)} confirmed before anything was written.</p></header>
${(pack.documents ?? []).map((d) => document(d, applicant)).join('\n')}
<footer><p>This is ${escape(applicant)}’s own evidence, shared by ${escape(applicant)}. It is not a reference check or an assessment of ${escape(applicant)}.</p></footer>
</main>
<script>${SCRIPT}</script>
</body>
</html>`;
}
