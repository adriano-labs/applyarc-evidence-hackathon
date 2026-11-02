import { QuestionCard } from './QuestionCard.jsx';
import { SourceCorrectionCard } from './SourceCorrectionCard.jsx';
import { FactsReview } from './FactsReview.jsx';
import { factRequirements } from '../flow.js';

export function FactsPanel({ workspace, view, busy, onDecideFact, onHoverFact, onConfirmFacts }) {
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
  const sources = workspace?.applicant?.sources || [];
  const sourceKinds = {};
  for (let i = 0; i < sources.length; i++) {
    if (sources[i] && sources[i].id) {
      sourceKinds[sources[i].id] = sources[i].kind;
    }
  }
  return (
    <FactsReview
      key="facts"
      facts={factsWithReqs}
      total={total}
      sources={sourceKinds}
      requirementNames={requirementNames}
      busy={busy}
      onDecide={onDecideFact}
      onHover={onHoverFact}
      onConfirmRest={onConfirmFacts}
      company={workspace?.application?.form?.company}
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
        onSkip={() => onSkip?.(q.id)} voice={voice} />;
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
        />
      );
    }
  }
  return null;
}
