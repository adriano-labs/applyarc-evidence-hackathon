import { randomUUID } from "node:crypto";

function invalid(msg) {
  const e = new Error(msg);
  e.code = "invalid";
  return e;
}

function requireTrimmedString(name, value, min, max, singleLine = false) {
  if (typeof value !== "string") throw invalid(`Enter ${name.toLowerCase()} as text.`);
  const t = value.trim();
  if (t.length < min) throw invalid(`Enter ${name.toLowerCase()} first.`);
  if (t.length > max) throw invalid(`Keep ${name.toLowerCase()} under ${max.toLocaleString('en-GB')} characters.`);
  if (singleLine && /[\u0000-\u001f\u007f-\u009f]/u.test(t)) throw invalid(`${name} must be one line`);
  return t;
}

function validateRequirements(requirements) {
  if (!Array.isArray(requirements) || requirements.length < 1 || requirements.length > 12) {
    throw invalid("List between 1 and 12 points the question asks for, one per line.");
  }
  const seen = new Set();
  const out = [];
  for (let i = 0; i < requirements.length; i++) {
    const r = requirements[i];
    if (!r || typeof r !== "object" || typeof r.text !== "string") throw invalid("Write each point the question asks for as text.");
    const t = r.text.trim();
    if (t.length < 1 || t.length > 500) throw invalid("Each point needs between 1 and 500 characters.");
    const key = t.toLowerCase();
    if (seen.has(key)) throw invalid("Two points are the same. Keep each point once.");
    seen.add(key);
    let personal = false;
    if (r.personal !== undefined) {
      if (typeof r.personal !== "boolean") throw invalid("Choose whether the point asks for your own contribution.");
      personal = r.personal;
    }
    out.push({ id: `own-answer-${i + 1}`, text: t, personal });
  }
  return out;
}

function resolveWordLimit(wl) {
  if (wl === undefined || wl === null || wl === "") {
    return { wordLimit: 300, limitSource: "guide", limitNote: "ApplyArc guideline; general project answer length." };
  }
  if (typeof wl !== "number" || !Number.isInteger(wl) || wl < 1 || wl > 2000) throw invalid("Enter a whole-number word limit from 1 to 2,000, or leave it blank for our guide.");
  return { wordLimit: wl, limitSource: "applicant", limitNote: "Employer word limit entered by the applicant; not independently checked." };
}

function optionalLetter() {
  return {
    id: "letter",
    title: "Cover letter",
    fieldId: null,
    required: false,
    question: "Optional cover letter prepared for the applicant; the employer requirement has not been checked.",
    wordLimit: 400,
    limitSource: "guide",
    limitNote: "ApplyArc guideline; not an employer requirement.",
    requirements: [
      { id: "own-motivation", text: "Why this role and this company, in your own words", personal: false },
      { id: "own-evidence", text: "Experience relevant to the role", personal: false },
    ],
  };
}

export function prepareOwnApplication(input, options = {}) {
  if (!options || options.liveModel !== true) throw invalid("Your own example needs the live model.");
  if (!input || typeof input !== "object") throw invalid("Paste your fictional example first.");
  if (input.synthetic !== true) throw invalid("Confirm that your notes are synthetic, with no personal or customer data.");
  if (input.requirementsConfirmed !== true) throw invalid("Confirm the points the question asks for.");
  const applicant = requireTrimmedString("First name", input.applicant, 1, 80, true);
  const company = requireTrimmedString("Company", input.company, 1, 100, true);
  const role = requireTrimmedString("Role", input.role, 1, 160, true);
  const notes = requireTrimmedString("Notes", input.notes, 1, 20000);
  const question = requireTrimmedString("Question", input.question, 1, 8000);
  const requirements = validateRequirements(input.requirements);
  const answer = { id: "answer", title: "Project answer", fieldId: null, question, requirements, ...resolveWordLimit(input.wordLimit) };
  const form = {
    id: `own-${randomUUID()}`, company, role, location: null, url: null,
    snapshot: {
      source: "applicant-pasted",
      fetchedAt: null,
      recordedAt: options.now ?? new Date().toISOString(),
      note: "Pasted and confirmed by the applicant; the employer page has not been checked.",
    },
    portalStatus: "unknown",
    portalTasks: ["Check the complete employer form for required fields, uploads and final submission."],
    documents: [answer, optionalLetter()],
  };

  return { applicant, notes, form };
}
