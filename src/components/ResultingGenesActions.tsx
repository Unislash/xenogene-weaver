import { useBuildStore } from '../store';

export const UndoRedo = () => {
  const undo = useBuildStore(s => s.undoGeneSelection);
  const redo = useBuildStore(s => s.redoGeneSelection);
  const canUndo = useBuildStore(s => s.canUndo);
  const canRedo = useBuildStore(s => s.canRedo);

  return (
    <div className="resulting-genes__actions">
      <button onClick={undo} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={redo} disabled={!canRedo}>
        Redo
      </button>
    </div>
  );
};
