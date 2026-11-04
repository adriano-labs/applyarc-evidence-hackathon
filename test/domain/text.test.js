import { describe, expect, it } from 'vitest';
import { isVerbatim, normalise, numbers, wordCount } from '../../server/domain/text.js';
import { saysSelf } from '../../server/domain/attribution.js';

describe('text rules', () => {
  it('treats typographic quotes and runs of spaces as their plain forms', () => {
    expect(normalise('Ellie’s  “runner”\n works')).toBe('Ellie\'s "runner" works');
  });

  it('accepts only an exact quote of the source', () => {
    const source = 'We used Kubernetes Jobs with a scheduler extender instead of Slurm.';
    expect(isVerbatim('Kubernetes Jobs with a scheduler extender', source)).toBe(true);
    expect(isVerbatim('Kubernetes jobs with a scheduler extender', source)).toBe(false);
    expect(isVerbatim('I used Kubernetes Jobs', source)).toBe(false);
    expect(isVerbatim('We', source)).toBe(false);
  });

  it('counts words the way a form limit does', () => {
    expect(wordCount('  one two\nthree  ')).toBe(3);
    expect(wordCount('')).toBe(0);
  });

  it('finds first-person wording but not team wording', () => {
    expect(saysSelf('I traced the crash to /dev/shm')).toBe(true);
    expect(saysSelf('My part was the Helm chart')).toBe(true);
    expect(saysSelf('We fixed it in three days')).toBe(false);
    expect(saysSelf('In the end it worked')).toBe(false);
    expect(saysSelf('We tuned the disk I/O on each node')).toBe(false);
  });

  it('does not count "my team" as the applicant', () => {
    expect(saysSelf('My team built the dashboard')).toBe(false);
    expect(saysSelf('My teammate Sam wrote the Helm change')).toBe(false);
  });

  // From Aisha's notes in the 3 November next-application run, word for word.
  const aisha = 'I owned the rollout tooling: Helm charts and a small Python CLI that wrapped helm and kubectl so the other developers did not need to learn them. Argo CD did the syncing. Prometheus and Grafana were already there.\n\n'
    + 'Decision I made: canary releases with automatic rollback on error rate, instead of blue/green. Blue/green would have doubled the database connections during a switch and the database was already near its connection limit.\n\n'
    + 'Problem: the first canary rollouts rolled back a lot even when nothing was wrong.';

  it('counts words before a colon that say "I" did something', () => {
    expect(saysSelf('I owned the rollout tooling: Helm charts and a small Python CLI that wrapped helm and kubectl so the other developers did not need to learn them.', aisha)).toBe(true);
    expect(saysSelf('Decision I made: canary releases with automatic rollback on error rate, instead of blue/green.', aisha)).toBe(true);
  });

  it('still reads a plain heading as a heading', () => {
    expect(saysSelf('Team: we shipped the canary rollouts')).toBe(false);
    expect(saysSelf('Role: platform')).toBe(false);
    expect(saysSelf('Problem: the first canary rollouts rolled back a lot even when nothing was wrong.', aisha)).toBe(false);
  });

  it('reads numbers in digits and in words the same way', () => {
    expect(numbers('It went from 300 to 2,100 followers in eight months.')).toEqual(['300', '2100', '8']);
    expect(numbers('I cut costs by forty per cent, a dozen times.')).toEqual(['40%', '12']);
    expect(numbers('k3s on one of six old workstations')).toEqual(['6']);
  });
});
