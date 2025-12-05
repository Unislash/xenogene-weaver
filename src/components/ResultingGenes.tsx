import { useMemo } from 'react';
import { useBuildStore } from '../store';
import { getGeneImage } from '../images';
import { useUndoRedoHotkeys } from '../hooks/useUndoRedoShortcuts';
import { useReorderAnimation } from '../hooks/useReorderAnimation';
import { UndoRedo } from './ResultingGenesActions';
import './ResultingGenes.css';

export const ResultingGenes = () => {
  const genesById = useBuildStore(s => s.allGenesById);
  const selectedXeno = useBuildStore(s => s.selectedXeno);
  const selectedGermline = useBuildStore(s => s.selectedGermline);
  const germlinesById = useBuildStore(s => s.germlinesById);
  const suppressedGermlineGenesByXeno = useBuildStore(s => s.suppressedGermlineGenesByXeno);
  const conflictingXenoGenesGroups = useBuildStore(s => s.conflictingXenoGenesGroups);
  const overrideGenes = useBuildStore(s => s.overrideGenes);
  const toggleXenoGene = useBuildStore(s => s.toggleXenoGene);
  const reorderSelectedXeno = useBuildStore(s => s.reorderSelectedXeno);

  const suppressedSet = useMemo(() => {
    const combined = new Set<string>();
    for (const suppressed of suppressedGermlineGenesByXeno.values()) {
      for (const id of suppressed) combined.add(id);
    }
    return combined;
  }, [suppressedGermlineGenesByXeno]);

  const conflictingSet = useMemo(() => {
    const combined = new Set<string>();
    for (const group of conflictingXenoGenesGroups) {
      for (const id of group) combined.add(id);
    }
    return combined;
  }, [conflictingXenoGenesGroups]);

  const germlineEntries = useMemo(() => {
    const entries: Array<{
      id: string;
      type: 'germline';
      inactive?: boolean;
    }> = [];
    if (selectedGermline) {
      const g = germlinesById[selectedGermline];
      if (g) {
        for (const id of g.genes) {
          const isSuppressed = suppressedSet.has(id);
          entries.push({ id, type: 'germline', inactive: isSuppressed });
        }
      }
    }
    return entries;
  }, [selectedGermline, germlinesById, suppressedSet]);

  const xenoEntries = useMemo(() => {
    const entries: Array<{
      id: string;
      type: 'xeno';
      inactive?: boolean;
      override?: boolean;
    }> = [];
    for (const id of selectedXeno) {
      const inactiveFromConflict = conflictingSet.has(id) && !overrideGenes.has(id);
      entries.push({
        id,
        type: 'xeno',
        inactive: inactiveFromConflict,
        override: overrideGenes.has(id),
      });
    }
    return entries;
  }, [selectedXeno, conflictingSet, overrideGenes]);

  const allEntries = useMemo(
    () => [...germlineEntries, ...xenoEntries],
    [germlineEntries, xenoEntries],
  );

  useUndoRedoHotkeys();

  const {
    draggingId,
    justDroppedId,
    dropIndicatorId,
    reorderPathIds,
    cardRefs,
    handlePanelContextMenu,
    handleGeneMouseDown,
    handleGeneClick,
    handleGeneContextMenu,
    handleGeneMouseEnter,
  } = useReorderAnimation({
    allEntries,
    toggleXenoGene,
    reorderSelectedXeno,
  });


  return (
    <section
      className="resulting-genes"
      onContextMenu={handlePanelContextMenu}
    >
      <div className="resulting-genes__header">
        <h2>Resulting Xenogerm</h2>
        <UndoRedo />
      </div>
      <div className="gene-grid">
        {allEntries.map(entry => {
          const gene = genesById[entry.id];
          if (!gene) return null;
          const isXeno = entry.type === 'xeno';
          const isSuppressed = Boolean(entry.inactive);
          const entryKey = `${gene.id}-${entry.type}`;
          const inReorderPath = isXeno && draggingId && reorderPathIds.has(entry.id);
          const classNames = [
            'gene-card',
            gene.capsules && 'archite',
            entry.type,
            isSuppressed && 'suppressed',
            isXeno && 'clickable',
            draggingId && dropIndicatorId === entry.id ? 'drop-target' : '',
            inReorderPath ? 'reorder-path' : '',
            draggingId === entry.id ? 'dragging' : '',
            justDroppedId === entry.id ? 'reordered' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const statusLabels: Array<{ key: string; text: string }> = [];
          if (isSuppressed) {
            statusLabels.push({ key: 'suppressed', text: 'Suppressed' });
          }
          if (entry.override) {
            statusLabels.push({ key: 'override', text: 'Override' });
          }
          const imageSrc = getGeneImage(gene.imgSrc);

          return (
            <div
              key={entryKey}
              className={classNames}
              ref={el => {
                cardRefs.current[entryKey] = el;
              }}
              onMouseDown={e => handleGeneMouseDown(gene.id, isXeno, e)}
              onClick={e => handleGeneClick(gene.id, isXeno, e)}
              onContextMenu={e => handleGeneContextMenu(gene.id, isXeno, e)}
              onMouseEnter={() => handleGeneMouseEnter(gene.id, isXeno)}
            >
              {imageSrc && (
                <div className="gene-thumb">
                  <img src={imageSrc} alt={gene.name} loading="lazy" />
                </div>
              )}
              <h3>{gene.name}</h3>
              <div className="stats">
                <span>Complexity: {gene.complexity}</span>
                <span>Efficiency: {gene.efficiency}</span>
              </div>
              {statusLabels.length > 0 && (
                <div className="status-label">
                  {statusLabels.map(({ key, text }) => (
                    <span key={key} className={`status ${key}`}>
                      {text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {allEntries.length === 0 && (
          <div className="empty-state">
            No genes selected. Select a germline and/or add xenogenes to begin.
          </div>
        )}
      </div>
    </section>
  );
};
