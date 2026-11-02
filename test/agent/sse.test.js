import { describe, expect, it } from 'vitest';
import { readEvents, SseError } from '../../server/agent/sse.js';

const encoder = new TextEncoder();

// A ReadableStream that delivers exactly the given chunks, like a network body.
function body(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(typeof c === 'string' ? encoder.encode(c) : c);
      controller.close();
    },
  });
}

async function collect(stream) {
  const out = [];
  for await (const e of readEvents(stream)) out.push(e);
  return out;
}

describe('readEvents', () => {
  it('parses named events whose data is JSON', async () => {
    const events = await collect(body([
      'event: response.created\ndata: {"type":"response.created","sequence_number":0}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hi"}\n\n',
    ]));
    expect(events).toEqual([
      { event: 'response.created', data: { type: 'response.created', sequence_number: 0 } },
      { event: 'response.output_text.delta', data: { type: 'response.output_text.delta', delta: 'Hi' } },
    ]);
  });

  it('reassembles events split across chunks, including a split multi-byte character', async () => {
    const bytes = encoder.encode('data: {"delta":"café"}\n\n');
    const cut = bytes.indexOf(0xc3) + 1;
    const events = await collect(body(['ev', 'ent: x\n', bytes.slice(0, cut), bytes.slice(cut)]));
    expect(events).toEqual([{ event: 'x', data: { delta: 'café' } }]);
  });

  it('accepts CRLF line endings and joins multi-line data with a newline', async () => {
    const events = await collect(body(['data: {"a":\r\ndata: 1}\r\n\r\n']));
    expect(events).toEqual([{ event: null, data: { a: 1 } }]);
  });

  it('ignores comments and blocks with no data', async () => {
    const events = await collect(body([': keep-alive\n\nevent: ping\n\ndata: {"ok":true}\n\n']));
    expect(events).toEqual([{ event: null, data: { ok: true } }]);
  });

  it('reports [DONE] as the end of the stream', async () => {
    const events = await collect(body(['data: {"n":1}\n\ndata: [DONE]\n\n']));
    expect(events).toEqual([{ event: null, data: { n: 1 } }, { event: null, done: true }]);
  });

  it('drops an unfinished event at the end, as the SSE standard says', async () => {
    const events = await collect(body(['data: {"n":1}\n\ndata: {"n":2}']));
    expect(events).toEqual([{ event: null, data: { n: 1 } }]);
  });

  it('throws a malformed error for data that is not JSON', async () => {
    const error = await collect(body(['data: {"n":\n\n'])).catch((e) => e);
    expect(error).toBeInstanceOf(SseError);
    expect(error.code).toBe('malformed');
  });
});
