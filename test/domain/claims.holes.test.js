// The evidence check against the ways a draft can claim more than the applicant's
// words say (27 Oct challenge): who did it, what they did, how much, and what they won.
// Every "refuses" case passed the check at 3bf1c0a; every "keeps" case is true to the notes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { claimProblem } from '../../server/domain/claims.js';
import { fromRoot } from '../../server/paths.js';

const ELLIE = readFileSync(fromRoot('fixtures/ellie-notes.md'), 'utf8');
const MARCUS = readFileSync(fromRoot('fixtures/marcus-notes.md'), 'utf8');
const CORRECTION = 'My teammate Sam wrote the Helm change; I tested it on two of the lab nodes.';

// Quotes cited from a source; a quote with no source stands alone.
const from = (source, ...quotes) => quotes.map((quote) => ({ quote, source }));
const alone = (...quotes) => quotes.map((quote) => ({ quote, source: quote }));
const check = (claim, cited, ctx = {}) => claimProblem(claim, cited, { roleTitle: 'Graduate Engineer', applicantName: 'Ellie', ...ctx });

describe('who did it', () => {
  it('refuses "I" for what "my team" did', () => {
    expect(check('I built the dashboard.', alone('My team built the dashboard.'))).toBe('a claim says "I" where its facts say "we"');
  });

  it('refuses "I" backed only by an unrelated "I" line', () => {
    expect(check('I shipped the chip.', alone('we shipped the chip', 'I wrote the test plan'))).toBe('a claim says "I" where its facts say "we"');
    expect(check('I cut costs by 40%.', alone('we cut costs by 40%', 'I joined in 2024'))).toBe('a claim says "I" where its facts say "we"');
  });

  it('refuses "I" for what someone else did, even inside a line that also says "I"', () => {
    expect(check('I wrote the Helm change.', from(CORRECTION, CORRECTION))).toBe('a claim says "I" where its facts say someone else did it');
  });

  it('treats a line with no one in it as its paragraph\'s: the team\'s in Ellie\'s problem paragraph', () => {
    expect(check('I fixed the crashes by mounting a memory-backed emptyDir.', from(ELLIE, 'Fixed it by mounting a memory-backed emptyDir with a size limit per job.'))).toBe('a claim says "I" where its facts say "we"');
  });

  it('treats a sentence about the applicant as "I" even without the word', () => {
    expect(check('Single-handedly designed and shipped the whole platform.', alone('We shipped the platform.'))).toBeTruthy();
    expect(check('My dashboard cut costs for the department.', alone('We built a dashboard that cut costs for the department.'))).toBe('a claim says "I" where its facts say "we"');
    expect(check('The award went to me for the migration.', alone('We did the migration.'))).toBeTruthy();
    expect(check('Ellie built the scheduler herself.', alone('We built the scheduler.'))).toBe('a claim says "I" where its facts say "we"');
  });
});

describe('what they did', () => {
  it('refuses "led" where the notes say "helped"', () => {
    expect(check('I led the migration.', alone('I helped with the migration.'))).toBe('a claim says "led" where its facts do not');
    expect(check('I managed a team of twelve engineers.', alone('I joined the platform team of twelve engineers.'))).toBe('a claim says "managed" where its facts do not');
  });

  it('refuses an achievement the notes never mention, however many true words come with it', () => {
    expect(check('I won a national award for this work.', alone('I tested it on two lab nodes.'))).toBe('a claim says something its facts do not');
    expect(check('I won a national award for testing it on two lab nodes.', alone('I tested it on two lab nodes.'))).toBe('a claim says "won" where its facts do not');
  });
});

describe('how much', () => {
  it('checks numbers written as words like numbers in digits', () => {
    expect(check('I cut costs by forty per cent.', alone('I cut costs on the budget review.'))).toBe('a claim states a number its facts do not');
    expect(check('I joined a team of twelve engineers.', alone('I joined the platform team.'))).toBe('a claim states a number its facts do not');
  });

  it('matches the same number however it is written', () => {
    expect(check('I cut costs by forty per cent.', alone('I cut costs by 40%.'))).toBeNull();
    expect(check('The account grew from 300 to 2100 followers in eight months.', from(MARCUS, 'It went from 300 to 2,100 followers in eight months.'))).toBeNull();
  });
});

describe('true sentences it keeps', () => {
  it('keeps what the applicant says they did', () => {
    expect(check('I set up the store\'s Instagram in 2024 and ran it myself, posting three times a week.', from(MARCUS, 'I set up the store\'s Instagram in 2024 and ran it myself, posting three times a week.'))).toBeNull();
    expect(check('I tested the Helm change on two of the lab nodes.', from(CORRECTION, CORRECTION))).toBeNull();
  });

  it('keeps a line with no one in it as the applicant\'s when the notes are about them', () => {
    expect(check('I started on the tills in 2020 and have been assistant manager since March 2025.', from(MARCUS, 'Started on the tills in 2020, store supervisor from 2023, assistant manager since March 2025.'), { applicantName: 'Marcus' })).toBeNull();
  });

  it('keeps what the team did, said as the team', () => {
    expect(check('We built a self-service GPU job runner for the department\'s teaching cluster.', from(ELLIE, 'We built a self-service GPU job runner for the department\'s machine learning teaching cluster.'))).toBeNull();
    expect(check('My team and I built the dashboard.', alone('We built the dashboard.'))).toBeNull();
    expect(check('Our team of four changed the windows every month, and I planned the themes within the £200 monthly budget.', from(MARCUS, 'our team of four changed the windows every month.', 'I planned the themes and kept to the £200 monthly budget.'), { applicantName: 'Marcus' })).toBeNull();
  });

  it('keeps facts about things, which no one claims to have done', () => {
    expect(check('Around 150 people came, and footfall that month was up 12% on the year before.', from(MARCUS, 'Around 150 people came.', 'Footfall that month was up 12% on the year before, according to the head office report.'), { applicantName: 'Marcus' })).toBeNull();
  });
});
