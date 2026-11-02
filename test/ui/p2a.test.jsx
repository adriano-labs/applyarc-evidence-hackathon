// @vitest-environment jsdom
// Review round P2a: behaviour found in the browser run.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportDialog } from '../../client/src/components/ExportDialog.jsx';
import { FactsReview } from '../../client/src/components/FactsReview.jsx';
import { Rail } from '../../client/src/components/Rail.jsx';
import { References } from '../../client/src/components/References.jsx';

afterEach(cleanup);

const fact = (id, status, sourceId = 's1') => ({ id, statement: `Fact ${id}.`, quote: `quote ${id}`, sourceId, status, history: [] });

describe('P2a', () => {
  it('Rail counts what is left out of everything that source proposed', () => {
    const workspace = {
      applicant: { sources: [{ id: 's1', kind: 'notes', text: 'x', read: true }], facts: [fact('f1', 'confirmed'), fact('f2', 'rejected'), fact('f3', 'proposed'), fact('f4', 'proposed')] },
      application: { form: { documents: [] }, questions: [], coverage: {}, repair: null, documents: { answer: null, letter: null } },
    };
    const view = { coverage: [], citations: {}, approvals: {}, stats: {}, next: 'facts' };
    render(<Rail workspace={workspace} view={view} busy={null} receipts={[]} mode={{ label: 'Fixture' }} sample={null} activeFactId={null} onDecideFact={vi.fn()} onAnswer={vi.fn()} onSkip={vi.fn()} onCorrectFact={vi.fn()} onHoverFact={vi.fn()} onDecideChange={vi.fn()} onApplyChanges={vi.fn()} onDownloadTrace={vi.fn()} />);
    expect(screen.getByText('Fact 3 of 4')).toBeTruthy();
  });

  it('FactsReview keeps keyboard focus after a decision so the next Enter works', () => {
    const onDecide = vi.fn();
    const facts = [fact('f1', 'proposed'), fact('f2', 'proposed')].map((f) => ({ ...f, requirementIds: [] }));
    const { container, rerender } = render(<FactsReview facts={facts} total={2} sources={{ s1: 'notes' }} requirementNames={{}} onDecide={onDecide} busy={false} />);
    const section = container.querySelector('.facts-review');
    section.focus();
    fireEvent.keyDown(section, { key: 'Enter' });
    rerender(<FactsReview facts={facts.slice(1)} total={2} sources={{ s1: 'notes' }} requirementNames={{}} onDecide={onDecide} busy={false} />);
    expect(document.activeElement).toBe(container.querySelector('.facts-review'));
  });

  it('References explains its empty state', () => {
    render(<References facts={[]} citations={{}} sources={{}} activeFactId={null} locked={false} onCorrect={vi.fn()} onHover={vi.fn()} />);
    expect(screen.getByText('Facts you confirm appear here, numbered as your documents cite them.')).toBeTruthy();
  });

  it('ExportDialog puts its close button in the header', () => {
    const pack = { status: 'NOT SUBMITTED', notice: 'n', createdAt: '2026-10-27T10:00:00Z', application: { company: 'C', role: 'R', url: 'u', snapshotFetchedAt: '2026-10-26T00:00:00Z' }, documents: [], portalTasks: [] };
    render(<ExportDialog pack={pack} onClose={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Close' }).closest('header')).toBeTruthy();
  });
});
