// Who the Evidence Pass credits with the drafts: the live model, or on the open-weight host the
// prepared run's model for the drafts and the open model for the correction and repair.
import { describe, expect, it } from 'vitest';
import { drafterOf } from '../../client/src/lib/prepared.js';

const wonder = { id: 'meta', model: 'muse-wonder-1.0', label: 'Muse Wonder (muse-wonder-1.0)' };
const open = { id: 'compatible', model: 'meta-models/Muse-Spark-Open-816B-A42B', label: 'Meta open-weight model (Muse Spark Open)' };
const prepared = { model: 'muse-wonder-1.0', ranAt: '2026-11-03T22:05:00Z' };

describe('drafterOf', () => {
  it('names the live model alone when it also prepared the drafts, or nothing was prepared', () => {
    expect(drafterOf(wonder, prepared)).toBe(wonder.label);
    expect(drafterOf(open, undefined)).toBe(open.label);
  });

  it('on another model’s host, credits the prepared model for the drafts', () => {
    expect(drafterOf(open, prepared)).toBe('Muse Wonder before this visit; Meta open-weight model (Muse Spark Open) for the correction and repair');
  });

  it('says nothing for the hand-written fixture', () => {
    expect(drafterOf({ id: 'fixture' }, prepared)).toBeNull();
    expect(drafterOf(null, prepared)).toBeNull();
  });
});
