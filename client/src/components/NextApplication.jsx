import './NextApplication.css';

export function NextApplication({ forms, busy, onChoose, onCancel }) {
  const otherForms = Array.isArray(forms) ? forms.filter((f) => f && !f.current) : [];

  return (
    <section className="next-application" aria-labelledby="next-title">
      <h2 id="next-title">Start your next application</h2>
      <p>Your confirmed facts come with you. The app asks only what the new form needs.</p>
      {otherForms.length === 0 ? (
        <p>There are no other forms to start yet.</p>
      ) : (
        <div className="next-forms">
          {otherForms.map((form) => (
            <button
              key={form.id}
              type="button"
              className="next-form"
              disabled={Boolean(busy)}
              onClick={() => onChoose && onChoose(form.id)}
            >
              {form.role} · {form.company}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn small link" onClick={() => onCancel && onCancel()}>
        Not now
      </button>
    </section>
  );
}
