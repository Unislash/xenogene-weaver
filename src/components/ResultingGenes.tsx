import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useBuildStore } from '../store';
import { getGeneImage } from '../images';
import { useUndoRedoHotkeys } from '../hooks/useUndoRedoShortcuts';
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
  const undo = useBuildStore(s => s.undoGeneSelection);
  const redo = useBuildStore(s => s.redoGeneSelection);
  const canUndo = useBuildStore(s => s.canUndo);
  const canRedo = useBuildStore(s => s.canRedo);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropBeforeId, setDropBeforeId] = useState<string | null>(null);
  const suppressNextContextMenu = useRef(false);
  const skipNextClickToggle = useRef(false);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const dropPulseTimeout = useRef<number | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastPositions = useRef<Record<string, DOMRect>>({});

  const triggerDropPulse = useCallback((id: string) => {
    setJustDroppedId(id);
    if (dropPulseTimeout.current !== null) {
      window.clearTimeout(dropPulseTimeout.current);
    }
    dropPulseTimeout.current = window.setTimeout(() => {
      setJustDroppedId(null);
      dropPulseTimeout.current = null;
    }, 400);
  }, []);

  const completeReorder = useCallback(
    (targetBeforeId?: string | null) => {
      if (!draggingId) return;
      const effectiveBeforeId =
        typeof targetBeforeId === 'undefined' ? dropBeforeId : targetBeforeId;
      if (effectiveBeforeId !== draggingId) {
        reorderSelectedXeno(draggingId, effectiveBeforeId);
        triggerDropPulse(draggingId);
      }
      setDraggingId(null);
      setDropBeforeId(null);
      suppressNextContextMenu.current = true;
      setTimeout(() => {
        suppressNextContextMenu.current = false;
      }, 0);
    },
    [draggingId, dropBeforeId, reorderSelectedXeno, triggerDropPulse],
  );

  useUndoRedoHotkeys();

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

  useEffect(() => {
    if (!draggingId) return;
    const handleMouseUp = () => {
      completeReorder();
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [draggingId, completeReorder]);

  const beginDrag = (geneId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setDraggingId(geneId);
    setDropBeforeId(geneId);
  };

  useLayoutEffect(() => {
    // Skip measuring while dragging; it introduces temporary placeholders that skew the positions.
    if (draggingId) return;

    const newPositions: Record<string, DOMRect> = {};
    const entryKeys = allEntries.map(entry => `${entry.id}-${entry.type}`);
    const canAnimate = entryKeys.every(key => Boolean(lastPositions.current[key]));

    for (const entryKey of entryKeys) {
      const el = cardRefs.current[entryKey];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      newPositions[entryKey] = rect;

      if (!canAnimate) continue;

      const prev = lastPositions.current[entryKey];
      if (prev) {
        const dx = prev.left - rect.left;
        const dy = prev.top - rect.top;
        if (dx !== 0 || dy !== 0) {
          el.style.transition = 'transform 0s';
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          requestAnimationFrame(() => {
            el.style.transition = 'transform 260ms ease';
            el.style.transform = 'translate(0, 0)';
            window.setTimeout(() => {
              // Clean inline styles after animation completes
              if (
                el.style.transform === 'translate(0px, 0px)' ||
                el.style.transform === 'translate(0, 0)'
              ) {
                el.style.transition = '';
                el.style.transform = '';
              }
            }, 300);
          });
        }
      }
    }

    lastPositions.current = newPositions;
  }, [allEntries, draggingId]);

  useEffect(
    () => () => {
      if (dropPulseTimeout.current !== null) {
        window.clearTimeout(dropPulseTimeout.current);
      }
    },
    [],
  );

  return (
    <section
      className="resulting-genes"
      onContextMenu={e => {
        // Suppress browser menu within the panel to keep right-click reordering smooth
        e.preventDefault();
      }}
    >
      <div className="resulting-genes__header">
        <h2>Resulting Xenogerm</h2>
        <div className="resulting-genes__actions">
          <button onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button onClick={redo} disabled={!canRedo}>
            Redo
          </button>
        </div>
      </div>
      <div className="gene-grid">
        {allEntries.map(entry => {
          const gene = genesById[entry.id];
          if (!gene) return null;
          const isXeno = entry.type === 'xeno';
          const isSuppressed = Boolean(entry.inactive);
          const entryKey = `${gene.id}-${entry.type}`;
          const classNames = [
            'gene-card',
            gene.capsules && 'archite',
            entry.type,
            isSuppressed && 'suppressed',
            isXeno && 'clickable',
            draggingId && dropBeforeId === entry.id ? 'drop-target' : '',
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
              onMouseDown={e => {
                if (draggingId && isXeno && e.button === 0) {
                  // Lock in this tile as the drop target before mouseup fires
                  e.preventDefault();
                  setDropBeforeId(gene.id);
                  skipNextClickToggle.current = true;
                }
              }}
              onClick={
                isXeno
                  ? e => {
                      if (draggingId) {
                        e.preventDefault();
                        return;
                      }
                      if (skipNextClickToggle.current) {
                        e.preventDefault();
                        skipNextClickToggle.current = false;
                        return;
                      }
                      toggleXenoGene(gene.id);
                    }
                  : undefined
              }
              onContextMenu={
                isXeno
                  ? e => {
                      if (suppressNextContextMenu.current || draggingId) {
                        e.preventDefault();
                        return;
                      }
                      beginDrag(gene.id, e);
                    }
                  : undefined
              }
              onMouseEnter={() => {
                if (draggingId && isXeno) setDropBeforeId(gene.id);
              }}
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
        {draggingId && (
          <div
            className={`result-drop-zone ${dropBeforeId === null ? 'active' : ''}`}
            onMouseEnter={() => setDropBeforeId(null)}
          />
        )}
        {allEntries.length === 0 && (
          <div className="empty-state">
            No genes selected. Select a germline and/or add xenogenes to begin.
          </div>
        )}
      </div>
    </section>
  );
}
