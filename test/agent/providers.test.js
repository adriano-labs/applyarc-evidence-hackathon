import { describe, expect, it } from 'vitest';
import { providerFromEnv } from '../../server/agent/providers.js';

describe('providerFromEnv', () => {
  it('defaults to fixture mode, which needs nothing', () => {
    expect(providerFromEnv({})).toBeNull();
    expect(providerFromEnv({ PROVIDER: 'fixture' })).toBeNull();
  });

  it('builds Meta from a server-side key and never exposes it in the label', () => {
    const p = providerFromEnv({ PROVIDER: 'meta', META_API_KEY: 'secret-key' });
    expect(p).toMatchObject({ id: 'meta', isMeta: true, wire: 'responses', model: 'muse-spark-1.3', baseUrl: 'https://api.meta.ai/v1' });
    expect(p.headers()).toEqual({ authorization: 'Bearer secret-key' });
    expect(JSON.stringify({ ...p, headers: undefined })).not.toContain('secret-key');
    expect(() => providerFromEnv({ PROVIDER: 'meta' })).toThrow(/META_API_KEY/);
  });

  it('builds an OpenAI-compatible host for Meta open-weight models, priced explicitly', () => {
    const env = { PROVIDER: 'compatible', COMPAT_BASE_URL: 'https://inference.baseten.co/v1', COMPAT_API_KEY: 'bk', COMPAT_MODEL: 'meta-models/muse-spark-open-1026', COMPAT_LABEL: 'Meta Muse Spark Open via Baseten', COMPAT_PRICE_AS: 'muse-spark-1.3' };
    const p = providerFromEnv(env);
    expect(p).toMatchObject({ id: 'compatible', isMeta: true, wire: 'chat', model: 'meta-models/muse-spark-open-1026', priceModel: 'muse-spark-1.3', label: 'Meta Muse Spark Open via Baseten', host: 'inference.baseten.co' });
    expect(providerFromEnv({ ...env, COMPAT_HOST: 'modal' }).host).toBe('modal');
    expect(providerFromEnv({ PROVIDER: 'meta', META_API_KEY: 'test' }).host).toBe('api.meta.ai');
    expect(p.headers()).toEqual({ authorization: 'Bearer bk' });
    expect(() => providerFromEnv({ ...env, COMPAT_PRICE_AS: undefined })).toThrow(/COMPAT_PRICE_AS/);
  });

  it('refuses an unknown provider by name', () => {
    expect(() => providerFromEnv({ PROVIDER: 'other' })).toThrow(/fixture, meta or compatible/);
    // The development stand-in is gone: at runtime the app calls only Meta models.
    expect(() => providerFromEnv({ PROVIDER: 'foundry' })).toThrow(/fixture, meta or compatible/);
  });
});
