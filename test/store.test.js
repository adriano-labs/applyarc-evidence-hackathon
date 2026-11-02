import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStore } from '../server/store/jsonFile.js';

const seed = () => ({ revision: 0, items: [] });
const store = () => createStore({ file: join(mkdtempSync(join(tmpdir(), 'store-')), 'ws.json'), seed });

describe('json store', () => {
  it('writes a change and bumps the revision', async () => {
    const s = store();
    const { ws } = await s.update(0, (w) => { w.items.push('a'); });
    expect(ws.revision).toBe(1);
    expect(s.read()).toMatchObject({ revision: 1, items: ['a'] });
  });

  it('refuses a write against a stale revision and changes nothing', async () => {
    const s = store();
    await s.update(0, (w) => { w.items.push('a'); });
    await expect(s.update(0, (w) => { w.items.push('b'); })).rejects.toMatchObject({ code: 'stale', details: { revision: 1 } });
    expect(s.read().items).toEqual(['a']);
  });

  it('writes nothing when the change throws', async () => {
    const s = store();
    await expect(s.update(0, () => { throw new Error('model failed'); })).rejects.toThrow('model failed');
    expect(s.read().revision).toBe(0);
  });

  it('serialises concurrent writers so the second sees the first as stale', async () => {
    const s = store();
    const slow = s.update(0, async (w) => { await new Promise((r) => setTimeout(r, 20)); w.items.push('slow'); });
    const fast = s.update(0, (w) => { w.items.push('fast'); });
    await slow;
    await expect(fast).rejects.toMatchObject({ code: 'stale' });
    expect(s.read().items).toEqual(['slow']);
  });

  it('keeps the file whole: valid JSON after every write', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'store-')), 'ws.json');
    const s = createStore({ file, seed });
    await s.update(0, (w) => { w.items.push('x'); });
    expect(JSON.parse(readFileSync(file, 'utf8')).items).toEqual(['x']);
  });
});
