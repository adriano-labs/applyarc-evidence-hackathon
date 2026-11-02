// Spoken notes reach Meta Voice Transcribe as a mono 16-bit PCM WAV at 16 kHz,
// the format its file API accepts (read 29 Oct 2026). The browser records in its
// own format, so the client resamples and encodes the samples itself.
import { describe, expect, it } from 'vitest';
import { encodeWav } from '../../client/src/lib/wav.js';

const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const tag = (bytes, at) => String.fromCharCode(...bytes.subarray(at, at + 4));

describe('encodeWav', () => {
  it('writes the header Meta expects for mono 16-bit PCM', () => {
    const bytes = encodeWav(new Float32Array(16000), 16000);
    const v = view(bytes);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBe(44 + 32000);
    expect([tag(bytes, 0), tag(bytes, 8), tag(bytes, 12), tag(bytes, 36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(v.getUint32(4, true)).toBe(36 + 32000);
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(28, true)).toBe(32000); // bytes per second
    expect(v.getUint16(32, true)).toBe(2);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(32000);
  });

  it('turns samples into 16-bit values, clipping anything louder than full scale', () => {
    const v = view(encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1, 1.5, -1.5]), 16000));
    const at = (i) => v.getInt16(44 + i * 2, true);
    expect([at(0), at(1), at(2), at(3), at(4), at(5), at(6)]).toEqual([0, 16384, -16384, 32767, -32768, 32767, -32768]);
  });
});
