import { useEffect, useMemo, useRef, useState } from 'react';
import './CommandMenu.css';

function matchesQuery(label, query) {
  const q = query.trim();
  if (q === '') return true;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const l = label.toLowerCase();
  return words.every((w) => l.includes(w));
}

export function CommandMenu({ commands = [], onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const matching = useMemo(() => {
    return (commands || []).filter((cmd) => matchesQuery(cmd.label || '', query));
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const activeId = matching[activeIndex]?.id;

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (matching.length === 0) return;
      setActiveIndex((i) => Math.min(i + 1, matching.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matching.length === 0) return;
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matching.length === 0) return;
      const cmd = matching[activeIndex];
      if (cmd && !cmd.disabled) {
        if (typeof cmd.run === 'function') {
          cmd.run();
        }
        if (typeof onClose === 'function') {
          onClose();
        }
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (typeof onClose === 'function') {
        onClose();
      }
    }
  };

  const handleBackdropClick = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const makeActive = (idx) => () => {
    setActiveIndex(idx);
  };

  const handleOptionClick = (cmd) => (e) => {
    e.stopPropagation();
    if (cmd.disabled) return;
    if (typeof cmd.run === 'function') {
      cmd.run();
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <div className="command-backdrop" onClick={handleBackdropClick}>
      <div
        className="command-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Commands"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Type a command"
          aria-expanded="true"
          aria-controls="command-list"
          aria-activedescendant={activeId ? 'cmd-' + activeId : undefined}
          placeholder="Type a command…"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {matching.length === 0 ? (
          <p className="command-empty">No command matches “{query}”.</p>
        ) : (
          <ul id="command-list" role="listbox" aria-label="Commands">
            {matching.map((cmd, idx) => {
              const active = idx === activeIndex;
              return (
                <li
                  key={cmd.id}
                  role="option"
                  id={'cmd-' + cmd.id}
                  aria-selected={active ? 'true' : 'false'}
                  aria-disabled={cmd.disabled ? 'true' : undefined}
                  onMouseEnter={makeActive(idx)}
                  onClick={handleOptionClick(cmd)}
                >
                  <span>{cmd.label}</span>
                  {cmd.hint !== undefined && cmd.hint !== null ? <kbd>{cmd.hint}</kbd> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
