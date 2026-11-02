import { primaryAction } from './flow.js';
import { getForms } from './api.js';

export function buildCommands({
  view,
  workspace,
  currentTab,
  setTab,
  actions,
  setPicking,
  setForms,
  receipts,
  mode,
  budget,
  handleReset,
  sample,
}) {
  const commands = [];
  commands.push({ id: 'notes', label: 'Open your notes', hint: '1', run: () => setTab && setTab('notes') });
  commands.push({ id: 'answer', label: 'Open the project answer', hint: '2', run: () => setTab && setTab('answer') });
  commands.push({ id: 'letter', label: 'Open the cover letter', hint: '3', run: () => setTab && setTab('letter') });
  const prim = primaryAction(view, workspace, currentTab, sample);
  if (prim && prim.id) {
    commands.push({
      id: 'primary',
      label: prim.label,
      run: () => {
        if (prim.id === 'next-application') {
          if (setPicking) setPicking(true);
          getForms()
            .then((res) => {
              if (setForms) {
                if (res && Array.isArray(res.forms)) {
                  setForms(res.forms);
                } else if (Array.isArray(res)) {
                  setForms(res);
                } else {
                  setForms(res?.forms || []);
                }
              }
            })
            .catch(() => {
              if (setForms) setForms([]);
            });
          return;
        }
        if (actions && actions.primary) {
          actions.primary(prim);
        }
      },
    });
  }
  const exportDisabled = !view?.exportBlockers || view.exportBlockers.length !== 0;
  commands.push({
    id: 'preview',
    label: 'Preview the export',
    run: () => {
      if (actions && actions.primary) {
        actions.primary({ id: 'export', label: 'Preview the export' });
      }
    },
    disabled: exportDisabled,
  });
  commands.push({
    id: 'trace',
    label: 'Download the trace (JSON)',
    run: () => {
      if (actions && actions.downloadTrace) {
        actions.downloadTrace(receipts, mode, budget);
      }
    },
  });
  commands.push({ id: 'reset', label: 'Start again', run: handleReset });
  return commands;
}
