import { QuestionCard } from './QuestionCard.jsx';
import { SourceCorrectionCard } from './SourceCorrectionCard.jsx';
import { FactsReview } from './FactsReview.jsx';
import { factRequirements, pronouns, sourceKinds } from '../flow.js';
import { spokenIds, workspaceLanguage } from '../lib/language.js';
import { clipHint } from './useClip.js';

// One button to run a saved step again after an interruption (reading saved words, checking the form).
export function ResumeButton({ id, label, onPrimary }) {
  return <div className="guided-actions"><button type="button" className="btn primary" onClick={() => onPrimary?.({ id })}>{label}</button></div>;
}

// sample: in the walk-through, so a fact in her language speaks of her as the headline does.
export function FactsPanel({ workspace, view, busy, sample, onDecideFact, onHoverFact, onConfirmFacts }) {
  const facts = workspace?.applicant?.facts || [];
  const proposedFacts = facts.filter((f) => f.status === 'proposed');
  if (proposedFacts.length === 0) {
    return null;
  }
  const factReqs = factRequirements(workspace);
  const factsWithReqs = proposedFacts.map((f) => ({
    ...f,
    requirementIds: factReqs[f.id] || [],
  }));
  const total = facts.filter((f) => f.sourceId === proposedFacts[0].sourceId).length;
  const coverage = view?.coverage || [];
  const requirementNames = {};
  for (let c = 0; c < coverage.length; c++) {
    requirementNames[coverage[c].id] = coverage[c].text;
  }
  return (
    <FactsReview
      key="facts"
      facts={factsWithReqs}
      total={total}
      sources={sourceKinds(workspace)}
      spoken={spokenIds(workspace)}
      requirementNames={requirementNames}
      busy={busy}
      onDecide={onDecideFact}
      onHover={onHoverFact}
      onConfirmRest={onConfirmFacts}
      company={workspace?.application?.form?.company}
      who={sample?.name ? { name: sample.name, possessive: pronouns(sample.possessive).possessive } : undefined}
    />
  );
}

export function QuestionPanel({ workspace, view, sample, busy, onAnswer, onSkip, onResolveSourceConflict, voice }) {
  const questions = workspace?.application?.questions || [];
  const coverage = view?.coverage || [];
  for (let i = 0; i < questions.length; i++) {
    if (questions[i].status === 'open') {
      const q = questions[i];
      const offer = view?.sourceCorrections?.find((item) => item.questionId === q.id);
      if (offer && onResolveSourceConflict) return <SourceCorrectionCard
        key={`${q.id}:${offer.sourceId}:${offer.factId}`} offer={offer} question={q} busy={busy}
        onResolve={onResolveSourceConflict} onAnswer={(text) => onAnswer?.(q.id, text)}
        onSkip={() => onSkip?.(q.id)} voice={voice}
        spoken={Boolean((workspace?.applicant?.sources ?? []).find((src) => src.id === offer.sourceId)?.spoken)} />;
      let requirementText = '';
      for (let c = 0; c < coverage.length; c++) {
        if (coverage[c].id === q.requirementId) {
          requirementText = coverage[c].text;
          break;
        }
      }
      return (
        <QuestionCard
          key="question"
          question={q}
          requirementText={requirementText}
          sample={sample?.answers?.[workspace?.application?.form?.id] ?? sample?.answerFor?.[q.requirementId] ?? sample?.answer}
          sampleName={sample?.name}
          busy={Boolean(busy)}
          onAnswer={(text) => onAnswer && onAnswer(q.id, text)}
          onSkip={() => onSkip && onSkip(q.id)}
          voice={voice}
          language={workspaceLanguage(workspace)}
          hint={sample?.clips ? clipHint(sample) : workspaceLanguage(workspace)}
          clip={sample?.clips?.answer}
          clipFrom={sample?.id}
        />
      );
    }
  }
  return null;
}
