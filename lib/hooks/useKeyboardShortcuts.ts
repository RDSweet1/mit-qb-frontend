import { useEffect, useCallback } from 'react';

interface ShortcutHandler {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  handler: () => void;
  /** If true, the shortcut fires even when focus is inside an input/textarea */
  ignoreInputFocus?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

    for (const shortcut of shortcuts) {
      if (!shortcut.ignoreInputFocus && isInput) continue;

      const ctrlMatch = shortcut.ctrlKey ? (e.ctrlKey || e.metaKey) : true;
      const metaMatch = shortcut.metaKey ? (e.ctrlKey || e.metaKey) : true;

      if (e.key === shortcut.key && ctrlMatch && metaMatch) {
        e.preventDefault();
        shortcut.handler();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
