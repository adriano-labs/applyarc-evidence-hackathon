// How each start opens the walk-through: a sample who speaks on her voice note, a prepared state at
// its key moment, anything else at once. A refused start goes back to the welcome. Any start but her
// voice note's own clears a chosen voice note, so it never opens (and is never sent) again later.
export function startHandlers({ actions, samples = [], sampleNotes, setGuided, setStarting }) {
  const addNotes = (text, ...extra) => {
    setStarting(null);
    if (text === sampleNotes) setGuided(true);
    return actions.addNotes(text, ...extra);
  };
  const startSample = async (id, ...heard) => {
    setGuided(true);
    if (!(await actions.startSample(id, ...heard))) setGuided(false);
    setStarting(null);
  };
  const chooseSample = (id) => {
    const spoken = samples.find((s) => s.id === id && s.clips);
    setStarting(spoken ?? null);
    if (!spoken) return startSample(id);
    setGuided(true);
  };
  const startPrepared = async (id) => {
    setStarting(null);
    setGuided(true);
    if (!(await actions.startPrepared(id))) setGuided(false);
  };
  return { addNotes, startSample, chooseSample, startPrepared };
}
