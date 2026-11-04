// @vitest-environment jsdom
// V2-5b: two sample applicants to choose from, the copy speaks about each one,
// and a sample correction is found by its key phrase (live quotes vary).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidedRun } from '../../client/src/components/GuidedRun.jsx';
import { SampleCards } from '../../client/src/components/SampleCards.jsx';
import { primaryAction } from '../../client/src/flow.js';

afterEach(cleanup);

const samples = [
  { id: 'ellie', name: 'Ellie', possessive: 'her', field: 'Graduate engineer', liveOnly: false, form: { company: 'Graphcore', documents: [{ id: 'answer', title: 'Project answer', wordLimit: 300 }] } },
  { id: 'marcus', name: 'Marcus', possessive: 'his', field: 'Retail to marketing', liveOnly: true, form: { company: 'Harbourline', sample: true, documents: [{ id: 'answer', title: 'Why this role', wordLimit: 250 }] } },
];

describe('the sample cards', () => {
  it('offers both applicants, with what each will write', () => {
    const onStart = vi.fn();
    render(<SampleCards samples={samples} liveModel onStart={onStart} />);
    expect(screen.getByText('Ellie · Graduate engineer')).toBeTruthy();
    expect(screen.getByText('Graphcore’s “Project answer”, up to 300 words')).toBeTruthy();
    expect(screen.getByText('Marcus · Retail to marketing')).toBeTruthy();
    expect(screen.getByText('Harbourline’s “Why this role”, up to 250 words (a made-up employer)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try it with Marcus’s notes' }));
    expect(onStart).toHaveBeenCalledWith('marcus');
    fireEvent.click(screen.getByRole('button', { name: 'Try it with Ellie’s notes' }));
    expect(onStart).toHaveBeenCalledWith('ellie');
  });

  it('says plainly when a sample needs the live model', () => {
    render(<SampleCards samples={samples} liveModel={false} onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Try it with Marcus’s notes' }).disabled).toBe(true);
    expect(screen.getByText('Runs on the live model only')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try it with Ellie’s notes' }).disabled).toBe(false);
  });
});

describe('the walk-through speaks about each applicant', () => {
  it('uses his for Marcus', () => {
    render(<GuidedRun view={{ next: 'question' }} workspace={{ applicant: { sources: [], facts: [] }, application: {} }} story={null} sampleName="Marcus" possessive="his" isMeta onPrimary={vi.fn()} onStory={vi.fn()} onExit={vi.fn()}>body</GuidedRun>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('One thing his notes don’t say');
    expect(screen.getByText('The form asks what he did himself, so the app asks for the missing detail.')).toBeTruthy();
  });
});

describe('the sample correction', () => {
  it('is found by its key phrase when the live quote differs from the notes', () => {
    const ws = { applicant: { sources: [], facts: [{ id: 'f7', status: 'confirmed', quote: 'I wrote the Helm change that mounts a memory-backed emptyDir' }] }, application: { form: { documents: [{ id: 'answer', title: 'Project answer' }] }, documents: { answer: { revision: 1 } }, repair: null, lastRepair: null } };
    const sample = { name: 'Ellie', correction: { anchor: 'Helm change', text: 'Sam wrote it.' } };
    const view = { next: 'approve', approvals: { answer: 'none' }, stats: { answer: { overLimit: false } } };
    expect(primaryAction(view, ws, 'answer', sample)).toMatchObject({ id: 'approve:answer', docRevision: 1, secondary: { id: 'try-correction', factId: 'f7' } });
  });
});
