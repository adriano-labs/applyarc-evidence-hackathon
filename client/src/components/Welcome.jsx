// A fresh workspace opens on the welcome alone: what the app does, the samples and a box
// for your own notes, without the workspace's steps, tabs and evidence rail around them.
import { NotesView } from './NotesView.jsx';
import './Welcome.css';

export function Welcome({ form, sample, busy, liveModel, onAddNotes, onStartSample, onStartOwn, voice }) {
  const docs = form?.documents ?? [];
  const answerDoc = docs.find((d) => d.id === 'answer') ?? docs[0];
  return (
    <main className="welcome">
      <NotesView
        sources={[]}
        facts={[]}
        questions={[]}
        activeFactId={null}
        busy={Boolean(busy)}
        sampleNotes={sample?.notes}
        onAddNotes={onAddNotes}
        company={form?.company}
        wordLimit={answerDoc?.wordLimit}
        snapshotDate={form?.snapshot?.fetchedAt}
        samples={sample?.samples}
        liveModel={liveModel}
        onStartSample={onStartSample}
        onStartOwn={onStartOwn}
        voice={voice}
      />
    </main>
  );
}
