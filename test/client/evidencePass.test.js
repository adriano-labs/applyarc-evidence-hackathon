// @vitest-environment jsdom
// Evidence Pass: one self-contained page the applicant can attach to an application.
// Every sentence opens the applicant's own words behind it. It works offline, loads
// nothing from anywhere, and shows only the quotes the sentences cite.
import { describe, expect, it } from 'vitest';
import { evidencePassHtml } from '../../client/src/lib/evidencePass.js';

const pack = {
  applicant: 'Marcus',
  application: { company: 'Harbourline', role: 'Marketing Assistant' },
  createdAt: '2026-10-29T18:00:00.000Z',
  documents: [
    {
      id: 'answer', title: 'Project answer', approvedAt: '2026-10-29T17:59:00.000Z',
      text: 'I ran the store’s Instagram.\n\nWe held a meet the makers Saturday.',
      sentences: [
        { text: 'I ran the store’s Instagram.', refs: [1], startsParagraph: true },
        { text: 'We held a meet the makers Saturday.', refs: [2], startsParagraph: true },
      ],
      references: [
        { n: 1, statement: 'Marcus ran the store Instagram.', quote: 'I ran the store’s Instagram', from: 'notes' },
        { n: 2, statement: 'The team held a makers event.', quote: 'we did a meet the makers Saturday', from: 'answer' },
      ],
    },
    {
      id: 'letter', title: 'Cover letter', approvedAt: '2026-10-29T17:59:30.000Z',
      text: 'Dear Harbourline team,\n\nI ran the store’s Instagram <img src=x onerror=alert(1)>.',
      sentences: [
        { text: 'Dear Harbourline team,', refs: [], startsParagraph: true },
        { text: 'I ran the store’s Instagram <img src=x onerror=alert(1)>.', refs: [1], startsParagraph: true },
      ],
      references: [{ n: 1, statement: 'Marcus ran the store Instagram.', quote: 'I ran the store’s Instagram', from: 'notes' }],
    },
  ],
};

const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

describe('evidencePassHtml', () => {
  it('is a complete page titled with the applicant, role and company', () => {
    const html = evidencePassHtml(pack);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(parse(html).title).toBe('Evidence Pass: Marcus, Marketing Assistant at Harbourline');
  });

  it('turns every cited sentence into a control that names its references, and leaves greetings plain', () => {
    const doc = parse(evidencePassHtml(pack));
    const cited = [...doc.querySelectorAll('button.sentence')];
    expect(cited.map((b) => b.getAttribute('data-refs'))).toEqual(['1', '2', '1']);
    expect(cited[0].textContent).toContain('I ran the store’s Instagram.');
    expect(doc.body.textContent).toContain('Dear Harbourline team,');
    expect([...doc.querySelectorAll('button.sentence')].some((b) => b.textContent.includes('Dear Harbourline team,'))).toBe(false);
  });

  it('shows the applicant’s own words for each reference, and where they came from', () => {
    const doc = parse(evidencePassHtml(pack));
    const ref1 = doc.querySelector('#answer-ref-1');
    expect(ref1.querySelector('q').textContent).toBe('I ran the store’s Instagram');
    expect(ref1.textContent).toContain('From Marcus’s notes');
    expect(doc.querySelector('#answer-ref-2').textContent).toContain('From Marcus’s answer');
  });

  it('says what it is, and what it is not', () => {
    const text = parse(evidencePassHtml(pack)).body.textContent;
    expect(text).toContain('Every sentence links to Marcus’s own words, which Marcus confirmed before anything was written.');
    expect(text).toContain('This is Marcus’s own evidence, shared by Marcus. It is not a reference check or an assessment of Marcus.');
  });

  it('escapes everything it prints and loads nothing from outside the page', () => {
    const html = evidencePassHtml(pack);
    const doc = parse(html);
    expect(doc.querySelector('img')).toBeNull();
    expect(doc.body.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(doc.querySelector('link, script[src], iframe')).toBeNull();
    expect(html).not.toMatch(/https?:\/\//);
  });
});
