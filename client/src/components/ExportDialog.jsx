import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { docNotes } from '../flow.js';
import './ExportDialog.css';

function splitParagraphs(text) {
  if (typeof text !== 'string') {
    return [];
  }
  return text.split(/\n\s*\n/);
}

export function ExportDialog({ pack, onClose, onCopy, onDownload, onDownloadPass }) {
  const dialogRef = useRef(null);
  // Focus the dialog; when it closes, give focus back to whatever opened it.
  useEffect(() => {
    const opener = document.activeElement;
    dialogRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  if (!pack) {
    return null;
  }

  const application = pack.application || {};
  const company = application.company || '';
  const role = application.role || '';
  const documents = Array.isArray(pack.documents) ? pack.documents : [];
  const portalTasks = Array.isArray(pack.portalTasks) ? pack.portalTasks : [];

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (onClose) {
        onClose();
      }
      return;
    }
    if (e.key === 'Tab') {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusableElements = Array.from(
        dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstElement || !dialog.contains(document.activeElement)) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement || !dialog.contains(document.activeElement)) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }
  };

  const tasks = pack.application?.portalStatus === 'unknown' ? 'Employer portal not checked'
    : portalTasks.length === 1 ? '1 thing to do on the employer’s site' : `${portalTasks.length} things to do on the employer’s site`;
  const contentsText = `In this pack: ${[...documents.map((d) => `${d.title}, version ${d.revision}`), tasks].join(' · ')}`;

  return (
    <div className="export-backdrop" onClick={onClose}>
      <div
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        ref={dialogRef}
      >
        <header>
          <div className="export-header-top">
            <h2 id="export-title">Your application pack</h2>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <span className="stamp">NOT SUBMITTED</span>
          <p className="export-for">{company} · {role}</p>
          <p className="export-notice">{pack.notice}</p>
          <p className="export-contents">{contentsText}</p>
        </header>

        {documents.map((doc) => {
          const paragraphs = splitParagraphs(doc.text || '');
          const title = doc.title || '';
          const references = Array.isArray(doc.references) ? doc.references : [];
          return (
            <article className="export-doc" key={doc.id || title}>
              <DocHead doc={doc} title={title} onCopy={onCopy} />
              {docNotes(doc).map((note) => <p key={note} className="export-doc-note">{note}</p>)}
              {paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
              {references.length > 0 && (
                <>
                  <h4>Your evidence</h4>
                  <ol className="export-refs">
                    {references.map((ref, rIdx) => (
                      <li key={rIdx}>
                        <span className="ref-n">{ref.n}</span>
                        <span className="export-ref-statement">{ref.statement}</span>
                        <span className="export-quote">
                          “<mark>{ref.quote}</mark>”
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </article>
          );
        })}

        <h3 id="portal-list">Still to do on the employer’s site</h3>
        <ol className="export-tasks" aria-labelledby="portal-list">
          {portalTasks.map((task, idx) => (
            <li key={idx}>{task}</li>
          ))}
        </ol>

        <footer>
          <button type="button" className="btn primary" onClick={() => onDownload && onDownload()}>
            Download the pack (.md)
          </button>
          <button type="button" className="btn" onClick={() => onDownloadPass && onDownloadPass()}>
            Download Evidence Pass
          </button>
          <button type="button" className="btn" onClick={onClose} aria-label="Close dialog">
            Close
          </button>
        </footer>
        <p className="export-hint">One page to attach: every sentence opens your own words behind it.</p>
      </div>
    </div>
  );
}

// A document's head row: its title line, and a copy button that says "Copied" for two seconds.
function DocHead({ doc, title, onCopy }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  useEffect(() => {
    if (!copyError) return undefined;
    const timer = setTimeout(() => setCopyError(''), 4000);
    return () => clearTimeout(timer);
  }, [copyError]);

  return (
    <div className="export-doc-head">
      <h3>
        {title} · version {doc.revision} · {doc.words} of {doc.wordLimit} words
      </h3>
      <div className="export-copy-row">
        <button
          type="button"
          className="btn small"
          onClick={async () => {
            setCopied(false);
            setCopyError('');
            // The failure shows here, inside the dialog, not behind it.
            if (await onCopy?.(doc.text || '')) setCopied(true);
            else setCopyError('Could not copy automatically. Select the text and copy it yourself.');
          }}
        >
          {copied ? 'Copied' : `Copy the ${title.toLowerCase()}`}
        </button>
        {copyError ? <span className="export-copy-error">{copyError}</span> : null}
      </div>
    </div>
  );
}
