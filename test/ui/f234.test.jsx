// @vitest-environment jsdom
// Finish review F2-F4: dialogs, manuscript details, banned patterns and contrast.
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandMenu } from '../../client/src/components/CommandMenu.jsx';
import { DocumentView } from '../../client/src/components/DocumentView.jsx';
import { ExportDialog } from '../../client/src/components/ExportDialog.jsx';
import { FormPanel } from '../../client/src/components/FormPanel.jsx';
import { QuestionCard } from '../../client/src/components/QuestionCard.jsx';
import { fromRoot } from '../../server/paths.js';

afterEach(cleanup);
const css = (...p) => readFileSync(fromRoot('client', 'src', ...p), 'utf8');
const pack = { status: 'NOT SUBMITTED', notice: 'n', createdAt: '2026-10-27T10:00:00Z', application: { company: 'C', role: 'R', url: 'u', snapshotFetchedAt: '2026-10-26T00:00:00Z' }, documents: [], portalTasks: [] };

describe('F2 dialogs', () => {
  it('gives each dialog its own backdrop class', () => {
    const { container } = render(<ExportDialog pack={pack} onClose={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} />);
    expect(container.querySelector('.export-backdrop')).toBeTruthy();
    cleanup();
    const menu = render(<CommandMenu commands={[]} onClose={vi.fn()} />);
    expect(menu.container.querySelector('.command-backdrop')).toBeTruthy();
    expect(css('components', 'ExportDialog.css') + css('components', 'CommandMenu.css')).not.toContain('.dialog-backdrop');
  });
  it('puts the NOT SUBMITTED stamp in the pack header, and selects commands without a stripe', () => {
    render(<ExportDialog pack={pack} onClose={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByText('NOT SUBMITTED').closest('header')).toBeTruthy();
    expect(css('components', 'CommandMenu.css')).not.toMatch(/inset\s+\d/);
  });
});

describe('F3 manuscript', () => {
  const doc = { id: 'answer', revision: 2, segments: [{ id: 'a1', kind: 'claim', text: 'Four of us built it.', factIds: ['f1'], startsParagraph: true, author: 'repair' }] };
  it('prints the last correction as a dated notice under the title', () => {
    render(<DocumentView title="Project answer" doc={doc} citations={{ f1: 1, f3: 10 }} approval="none" stats={{ words: 5, wordLimit: 300, overLimit: false }} limitSource="form" locked={false} activeFactId={null} changedSegmentIds={['a1']} pendingSegmentIds={[]} lastRepair={{ at: '2026-10-27T01:00:00Z', changed: 2, kept: 1, factNumber: 10 }} onCite={vi.fn()} onEdit={vi.fn()} onApprove={vi.fn()} />);
    expect(screen.getByText('Corrected on 27 Oct 2026: fact [10] changed; 2 sentences rewritten, 1 kept as you wrote it.')).toBeTruthy();
  });
  it('sets citations tight and keeps the next step in view', () => {
    expect(css('components', 'DocumentView.css')).toMatch(/\.cite\s*\{[^}]*padding:\s*0;/);
    expect(css('components', 'DocumentPane.css') + css('App.css')).toMatch(/\.next-step\s*\{[^}]*position:\s*sticky/);
    expect(css('App.css')).not.toMatch(/(^|[\s,}])\.btn\b/m);
  });
});

describe('F4 patterns and contrast', () => {
  it('puts the question first and its reason in sentence case beneath', () => {
    const { container } = render(<QuestionCard question={{ id: 'q', requirementId: 'r', text: 'What did you do?', why: 'Why.' }} requirementText="Your individual contribution" onAnswer={vi.fn()} onSkip={vi.fn()} busy={false} sample={null} />);
    const text = container.querySelector('.question-text');
    const forLine = container.querySelector('.question-for');
    expect(text.compareDocumentPosition(forLine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(css('components', 'QuestionCard.css')).not.toMatch(/\.question-for\s*\{[^}]*text-transform:\s*uppercase/);
  });
  it('quotes the form without a coloured rule, renders no empty heading, and keeps small text readable', () => {
    const { container } = render(<FormPanel company="C" role="R" formDoc={{ id: 'answer', title: 'Project answer', question: 'Q', wordLimit: 300, limitSource: 'form' }} coverage={[]} questions={[]} citations={{}} stats={{ words: 0, wordLimit: 300, overLimit: false }} portalTasks={[]} snapshot={{ fetchedAt: '2026-10-26T00:00:00Z', url: 'u' }} />);
    expect([...container.querySelectorAll('h2')].every((h) => h.textContent.trim().length > 0)).toBe(true);
    expect(css('components', 'FormPanel.css')).not.toMatch(/\.form-question\s*\{[^}]*border-left/);
    expect(css('components', 'ReceiptsDrawer.css')).not.toContain('--faint');
    expect(css('components', 'FactsReview.css')).not.toMatch(/\.fact-card\s*\{[^}]*border:\s*1px/);
  });
});
