// A rewording answer that could not be read or was cut short is not fatal: the
// draft or repair goes on without it, keeping the review's verdicts, and says so.
const SKIPPED = new Map([['invalid-output', 'sent an answer that could not be read'], ['incomplete', 'was cut short']]);

export async function reviseOrSkip(agent, args, emit) {
  try {
    return await agent.revise({ ...args, emit });
  } catch (error) {
    if (!SKIPPED.has(error?.code)) throw error;
    emit({ type: 'stage', decision: true, label: `The rewording step ${SKIPPED.get(error.code)}; going on without it` });
    return { rewrites: [] };
  }
}
