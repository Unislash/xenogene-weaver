import { useEffect } from 'react';
import { useBuildStore } from '../store';

/**
 * Wires Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y to undo/redo gene selection.
 * Ignores hotkeys while the user is typing in an input, textarea, or contentEditable region.
 */
export const useUndoRedoHotkeys = () => {
  const undo = useBuildStore(s => s.undoGeneSelection);
  const redo = useBuildStore(s => s.redoGeneSelection);
  const canUndo = useBuildStore(s => s.canUndo);
  const canRedo = useBuildStore(s => s.canRedo);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isTextInput) return;

      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      if (!ctrlOrMeta) return;

      const key = event.key.toLowerCase();
      const wantsUndo = key === 'z' && !event.shiftKey;
      const wantsRedo = (key === 'z' && event.shiftKey) || key === 'y';

      if (wantsUndo && canUndo) {
        event.preventDefault();
        undo();
      } else if (wantsRedo && canRedo) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, canUndo, canRedo]);
};
