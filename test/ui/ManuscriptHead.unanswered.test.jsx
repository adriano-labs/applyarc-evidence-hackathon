// @vitest-environment jsdom
// A document with a requirement no sentence answers says so in its header.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ManuscriptHead } from '../../client/src/components/ManuscriptHead.jsx';

afterEach(cleanup);
const stats = (unanswered) => ({ words: 120, wordLimit: 300, overLimit: false, unanswered });

describe('the document header', () => {
  it('names each requirement the document does not answer yet', () => {
    render(<ManuscriptHead docId="answer" title="Project answer" revision={1} stats={stats([{ id: 'contribution', text: 'Your individual contribution, if you worked as part of a team' }, { id: 'problem', text: 'One problem you encountered' }])} approval={null} />);
    expect(screen.getByText('Not answered yet: Your individual contribution, if you worked as part of a team; One problem you encountered')).toBeTruthy();
  });

  it('says nothing extra when every requirement is answered', () => {
    const { container } = render(<ManuscriptHead docId="answer" title="Project answer" revision={1} stats={stats([])} approval={null} />);
    expect(container.textContent).not.toContain('Not answered yet');
  });
});
