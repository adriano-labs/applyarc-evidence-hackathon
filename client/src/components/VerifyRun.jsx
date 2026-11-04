// Verify this run: the server re-checks the saved workspace by code, with no model call.
// Results stand for the version they checked; any later change hides them until the next press.
import { useEffect, useState } from 'react';
import { Check, Minus, X } from 'lucide-react';
import { getVerification } from '../api.js';
import './VerifyRun.css';

// A mark and its words for each result, so colour is never the only signal.
const MARK = { pass: [Check, 'Holds'], none: [Minus, 'Nothing to check'], fail: [X, 'Does not hold'] };

// auto: run once on arrival and again after each export (the finish screen), so the result is in view.
export function VerifyRun({ workspace = null, fixture = false, auto = false }) {
  const [result, setResult] = useState(null);
  const verify = () => getVerification().then(setResult, (e) => setResult({ error: e.message }));
  const exports = workspace?.application?.exports?.length ?? 0;
  useEffect(() => { if (auto) verify(); }, [auto, workspace?.revision, exports]);
  const checks = result?.checks && result.revision === workspace?.revision ? result.checks : null;
  const name = workspace?.applicant?.name;
  return (
    <div className="verify">
      <button type="button" className="btn small primary" onClick={verify}>Verify this run</button>
      <div aria-live="polite">
        {result?.error ? <p className="trail-error">{result.error}</p> : null}
        {checks ? (
          <>
            <p className="trail-foot">Checked by code, with no model call{fixture ? ' · Fixture: hand-written outputs, not a model' : ''}</p>
            <ul className="verify-list">
              {checks.map((c) => {
                const state = !c.pass ? 'fail' : c.count ? 'pass' : 'none';
                const [Icon, label] = MARK[state];
                return (
                  <li key={c.id} className={state}>
                    <Icon size={14} aria-hidden="true" />
                    <span><span className="visually-hidden">{label}: </span>{c.text}{c.failures.length ? ` · ${c.failures.join(', ')}` : ''}</span>
                  </li>
                );
              })}
            </ul>
            <p className="trail-footnote">These checks prove the record matches {name ? `${name}’s` : 'the applicant’s'} own words and approvals. They do not prove the account is true.</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
