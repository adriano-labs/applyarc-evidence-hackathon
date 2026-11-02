import { describe, expect, it } from 'vitest';
import { progress } from '../../client/src/useWorkspace.js';

const initial = () => ({ name: 'draft', stage: 'Writing', tools: [], history: [], documentPreviews: {}, chars: 0 });
describe('streamed work progress', () => {
  it('retains only bounded real stage/tool history and excludes model deltas', () => {
    let busy = initial();
    for (let n = 0; n < 15; n++) busy = progress(busy, { type: 'stage', label: `Stage ${n}` });
    expect(busy.history).toHaveLength(8);
    expect(busy.history[0].label).toBe('Stage 7');
    const last = busy.history;
    busy = progress(busy, { type: 'model', event: 'delta', chars: 4000 });
    expect(busy.history).toBe(last);
    expect(busy.chars).toBe(4000);
    busy = progress(busy, { type: 'tool', name: 'count_words', note: '207 of 300' });
    expect(busy.history.at(-1).kind).toBe('tool');
    expect(busy.history.at(-1).label).toContain('207 of 300');
    expect(busy.history).toHaveLength(8);
  });

  it('keeps checked drafts in transient progress without changing saved data', () => {
    const busy = initial();
    const segments = [{ text: 'I tested the deployment.', kind: 'claim', factIds: ['f1'] }];
    const next = progress(busy, { type: 'document-ready', docId: 'answer', title: 'Project answer', segments });
    expect(next.documentPreviews.answer).toEqual({ docId: 'answer', title: 'Project answer', segments });
    expect(busy.documentPreviews).toEqual({});
    expect(next.documentPreviews.answer.segments).not.toBe(segments);
    expect(next).not.toHaveProperty('workspace');
  });

  it('ignores unknown or unbounded previews instead of rendering unchecked content', () => {
    const busy = initial();
    for (const event of [
      { type: 'document-ready', docId: 'other', segments: [{ text: 'x' }] },
      { type: 'document-ready', docId: 'answer', segments: [{ text: '<script>x</script>'.repeat(2000) }] },
      { type: 'document-ready', docId: 'answer', segments: [{ text: null }] },
    ]) expect(progress(busy, event)).toBe(busy);
  });
});
