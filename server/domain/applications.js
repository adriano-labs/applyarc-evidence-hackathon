import { createApplication } from './workspace.js';
import { refuse } from './errors.js';

export function startNextApplication(ws, form, now = new Date().toISOString()) {
  if (!ws.application.exports || ws.application.exports.length === 0) {
    refuse('not-ready', 'Export this application first.');
  }
  if (form.id === ws.application.form.id) {
    refuse('invalid', 'That form is already the current application.');
  }
  if (!ws.archive) ws.archive = [];
  ws.archive.push({ ...ws.application, archivedAt: now });
  ws.application = createApplication(form);
  return { application: ws.application };
}
