// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { FormPanel } from '../../client/src/components/FormPanel.jsx';

afterEach(cleanup);
it('shows pasted provenance, optional letter and limits as a guide', () => {
  render(<FormPanel company="Harbour Labs" formDoc={{ title: 'Cover letter', question: 'Optional letter', wordLimit: 400, limitSource: 'guide', required: false }} snapshot={{ source: 'applicant-pasted', fetchedAt: null }} />);
  expect(screen.getByText(/Pasted and confirmed by you/)).toBeTruthy();
  expect(screen.getByText(/optional.*not been checked/i)).toBeTruthy();
  expect(screen.queryByRole('link', { name: /snapshot/ })).toBeNull();
});
