import { useEffect } from 'react';

export function useKeyboard({ setCommandsOpen, setTab, setPinnedFactId, setPeekFactId } = {}) {
  useEffect(() => {
    const handler = (e) => {
      const key = e.key;
      if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'k') {
        e.preventDefault();
        if (setCommandsOpen) {
          setCommandsOpen((v) => !v);
        }
        return;
      }
      const target = e.target;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }
      if (key === 'Escape') {
        setPinnedFactId?.(null);
        setPeekFactId?.(null);
        return;
      }
      if (key === '1') {
        if (setTab) setTab('notes');
        return;
      }
      if (key === '2') {
        if (setTab) setTab('answer');
        return;
      }
      if (key === '3') {
        if (setTab) setTab('letter');
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandsOpen, setTab, setPinnedFactId]);
}
