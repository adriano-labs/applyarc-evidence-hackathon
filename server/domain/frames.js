// Only these server-composed, nonfactual sentences may omit evidence citations.
// A greeting prefix is not permission to append an unchecked achievement.
export function frameOptions({ company = 'the employer', role = '', applicant = 'the applicant', location = '' } = {}) {
  const openings = [`Dear ${company} hiring team,`, `Dear ${company} team,`, 'To whom it may concern,'];
  if (role) {
    openings.push(`I am applying for the ${role} role.`, `I am applying for the ${role} role at ${company}.`);
    if (location) openings.push(`I am applying for the ${role} role in ${location.split(',')[0].trim()}.`);
  }
  return { openings, closings: [
    'Thank you for considering my application.', 'Thank you for your time and consideration.',
    'I look forward to hearing from you.', `Yours sincerely, ${applicant}`, `Kind regards, ${applicant}`,
  ] };
}
