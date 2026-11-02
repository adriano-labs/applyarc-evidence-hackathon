// Read a streamed HTTP body as Server-Sent Events, the way the Responses API
// streams: `event:` names, `data:` JSON, a final `[DONE]`.
export class SseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SseError';
    this.code = code;
  }
}

function parseBlock(block) {
  let event = null;
  const data = [];
  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon);
    const value = line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  if (!data.length) return null;
  const text = data.join('\n');
  if (text === '[DONE]') return { event: null, done: true };
  try {
    return { event, data: JSON.parse(text) };
  } catch (error) {
    throw new SseError('malformed', `The stream sent data that is not JSON: ${error.message}`);
  }
}

// Text left when the stream ends without a blank line is an unfinished event
// and is dropped, as the SSE standard says.
export async function* readEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      for (let end = buffer.indexOf('\n\n'); end !== -1; end = buffer.indexOf('\n\n')) {
        const event = parseBlock(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        if (event) yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
