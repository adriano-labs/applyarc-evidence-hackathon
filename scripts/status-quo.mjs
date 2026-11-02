// The status quo: what most job seekers do today. They paste their notes and what
// they did into a chatbot and ask for both documents in one message: no questions,
// no evidence checks. Same Meta model and effort as the app's drafting step, one
// call per case. The prompt is fixed before any run (scripts/workflow-comparison/STATUS-QUO.md).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLedger } from '../server/agent/budget.js';
import { providerFromEnv } from '../server/agent/providers.js';
import { createTransport } from '../server/agent/transport.js';
import { fromRoot } from '../server/paths.js';

export function statusQuoPrompt({ input, clarificationAnswer }) {
  return [
    `I'm applying for the ${input.role} role at ${input.company}. Here are my notes about a project:`,
    '',
    input.notes,
    '',
    `What I did myself: ${clarificationAnswer}`,
    '',
    `Please write my answer to this application question, in no more than ${input.wordLimit} words:`,
    input.question,
    '',
    'Then write a cover letter for the role.',
  ].join('\n');
}

const outputText = (response) => (response.output ?? [])
  .filter((o) => o.type === 'message').flatMap((o) => o.content ?? [])
  .filter((p) => p.type === 'output_text').map((p) => p.text).join('');

async function main(env = process.env) {
  if (!env.WORKFLOW_CORPUS || !env.STATUS_QUO_OUT) throw new Error('Set WORKFLOW_CORPUS and STATUS_QUO_OUT.');
  const corpus = JSON.parse(readFileSync(fromRoot('fixtures', env.WORKFLOW_CORPUS), 'utf8'));
  const provider = providerFromEnv(env);
  const ledger = createLedger({ file: env.WORKFLOW_LEDGER_FILE, capUsd: Number(env.WORKFLOW_CAP_USD) });
  const transport = createTransport({ provider, ledger });
  const runs = [];
  for (const c of corpus.cases) {
    const prompt = statusQuoPrompt(c);
    try {
      const r = await transport.respond(
        { input: [{ role: 'user', content: prompt }], reasoning: { effort: 'medium' }, max_output_tokens: 8000, store: false },
        { callId: `status-quo-${c.id}-${Date.now()}` },
      );
      runs.push({ caseId: c.id, status: 'completed', prompt, text: outputText(r.response), usage: r.usage, costUsd: r.costUsd, requestId: r.requestId });
    } catch (error) {
      runs.push({ caseId: c.id, status: 'failed', prompt, failure: error.code ?? 'error' });
    }
    console.log(`${c.id}: ${runs.at(-1).status}`);
  }
  mkdirSync(env.STATUS_QUO_OUT, { recursive: true });
  writeFileSync(join(env.STATUS_QUO_OUT, 'report.json'), JSON.stringify({
    method: 'status-quo', provider: provider.id, model: provider.model, effort: 'medium', corpus: env.WORKFLOW_CORPUS, finishedAt: new Date().toISOString(), runs,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch((error) => { console.error(error); process.exit(1); });
