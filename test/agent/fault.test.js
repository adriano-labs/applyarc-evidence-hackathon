import { describe, expect, it } from 'vitest';
import { faultyFetch } from '../../server/agent/fault.js';

const real = (calls) => async (url) => { calls.push(url); return new Response('ok', { status: 200 }); };

describe('demo fault switch', () => {
  it('answers the first call with one labelled 429, then passes everything through', async () => {
    const calls = [];
    const fetch = faultyFetch(real(calls), '429-once');
    const first = await fetch('https://model.test/v1/responses', {});
    expect(first.status).toBe(429);
    expect(first.headers.get('retry-after')).toBe('2');
    expect(first.headers.get('x-demo-fault')).toBe('429-once');
    expect((await fetch('https://model.test/v1/responses', {})).status).toBe(200);
    expect(calls).toEqual(['https://model.test/v1/responses']);
  });

  it('does nothing without a known fault name', async () => {
    const calls = [];
    const fetch = faultyFetch(real(calls), undefined);
    expect((await fetch('u', {})).status).toBe(200);
    expect(() => faultyFetch(real(calls), 'explode')).toThrow(/Unknown DEMO_FAULT/);
  });
});
