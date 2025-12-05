import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type MutableRefObject,
} from 'react';

type Entry = {
  id: string;
  type: 'germline' | 'xeno';
};

type Params = {
  allEntries: Entry[];
  toggleXenoGene: (id: string) => void;
  reorderSelectedXeno: (id: string, beforeId: string | null) => void;
};

type HookResult = {
  draggingId: string | null;
  justDroppedId: string | null;
  dropIndicatorId: string | null;
  reorderPathIds: Set<string>;
  cardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  handlePanelContextMenu: (e: MouseEvent) => void;
  handleGeneMouseDown: (geneId: string, isXeno: boolean, e: MouseEvent) => void;
  handleGeneClick: (geneId: string, isXeno: boolean, e: MouseEvent) => void;
  handleGeneContextMenu: (geneId: string, isXeno: boolean, e: MouseEvent) => void;
  handleGeneMouseEnter: (geneId: string, isXeno: boolean) => void;
};

export const useReorderAnimation = ({
  allEntries,
  toggleXenoGene,
  reorderSelectedXeno,
}: Params): HookResult => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropBeforeId, setDropBeforeId] = useState<string | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const [dropIndicatorId, setDropIndicatorId] = useState<string | null>(null);
  const dropPulseTimeout = useRef<number | null>(null);
  const suppressNextContextMenu = useRef(false);
  const skipNextClickToggle = useRef(false);

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

      const effectiveBeforeId = typeof targetBeforeId === 'undefined' ? dropBeforeId : targetBeforeId;

      if (effectiveBeforeId !== draggingId) {
        // Snapshot positions before the DOM reorders so FLIP has a baseline.
        const snapshot: Record<string, DOMRect> = {};
        for (const entry of allEntries) {
          const key = `${entry.id}-${entry.type}`;
          const el = cardRefs.current[key];
          if (!el) continue;
          snapshot[key] = el.getBoundingClientRect();
        }
        if (Object.keys(snapshot).length > 0) {
          lastPositions.current = snapshot;
        }

        reorderSelectedXeno(draggingId, effectiveBeforeId);
        triggerDropPulse(draggingId);
      }

      setDraggingId(null);
      setDropBeforeId(null);
      setDropIndicatorId(null);
      suppressNextContextMenu.current = true;
      setTimeout(() => {
        suppressNextContextMenu.current = false;
      }, 0);
    },
    [
      allEntries,
      draggingId,
      dropBeforeId,
      reorderSelectedXeno,
      setDropBeforeId,
      setDraggingId,
      suppressNextContextMenu,
      triggerDropPulse,
    ],
  );

  useEffect(() => {
    if (!draggingId) return;
    const handleMouseUp = () => {
      completeReorder();
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [draggingId, completeReorder]);

  useLayoutEffect(() => {
    // Skip measuring while dragging; it introduces temporary placeholders that skew the positions.
    if (draggingId) return;

    const entryKeys = allEntries.map(entry => `${entry.id}-${entry.type}`);
    const prevSnapshot = lastPositions.current;

    const newPositions: Record<string, DOMRect> = {};

    // If we have no prior snapshot, capture the current layout as the baseline and bail.
    if (Object.keys(prevSnapshot).length === 0) {
      for (const entryKey of entryKeys) {
        const el = cardRefs.current[entryKey];
        if (!el) continue;
        newPositions[entryKey] = el.getBoundingClientRect();
      }
      if (Object.keys(newPositions).length > 0) {
        lastPositions.current = newPositions;
      }
      return;
    }

    for (const entryKey of entryKeys) {
      const el = cardRefs.current[entryKey];
      if (!el) continue;

      const rect = el.getBoundingClientRect();
      newPositions[entryKey] = rect;

      const prev = prevSnapshot[entryKey];
      if (!prev) continue;

      const dx = prev.left - rect.left;
      const dy = prev.top - rect.top;
      if (dx === 0 && dy === 0) continue;

      el.style.transition = 'transform 0s';
      el.style.transform = `translate(${dx}px, ${dy}px)`;

      requestAnimationFrame(() => {
        el.style.transition = 'transform 260ms ease';
        el.style.transform = 'translate(0, 0)';

        window.setTimeout(() => {
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

    if (Object.keys(newPositions).length > 0) {
      lastPositions.current = newPositions;
    }
  }, [allEntries, draggingId]);

  useEffect(
    () => () => {
      if (dropPulseTimeout.current !== null) {
        window.clearTimeout(dropPulseTimeout.current);
      }
    },
    [],
  );

  const xenoIds = useMemo(
    () => allEntries.filter(entry => entry.type === 'xeno').map(entry => entry.id),
    [allEntries],
  );

  const reorderPathIds = useMemo(() => {
    const set = new Set<string>();
    if (!draggingId || !dropIndicatorId) return set;
    const draggingIndex = xenoIds.indexOf(draggingId);
    const targetIndex = xenoIds.indexOf(dropIndicatorId);
    if (draggingIndex === -1 || targetIndex === -1) return set;
    const step = draggingIndex < targetIndex ? 1 : -1;
    for (let i = draggingIndex + step; i !== targetIndex + step; i += step) {
      const geneId = xenoIds[i];
      if (!geneId || geneId === draggingId) continue;
      set.add(geneId);
    }
    return set;
  }, [draggingId, dropIndicatorId, xenoIds]);

  const handlePanelContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  const updateDropTarget = useCallback(
    (geneId: string) => {
      if (!draggingId) return;
      const draggingIndex = xenoIds.indexOf(draggingId);
      const targetIndex = xenoIds.indexOf(geneId);
      if (draggingIndex !== -1 && targetIndex !== -1 && targetIndex > draggingIndex) {
        const afterTarget = xenoIds[targetIndex + 1] ?? null;
        setDropBeforeId(afterTarget);
        setDropIndicatorId(geneId);
      } else {
        setDropBeforeId(geneId);
        setDropIndicatorId(geneId);
      }
    },
    [draggingId, xenoIds],
  );

  const handleGeneMouseDown = useCallback(
    (geneId: string, isXeno: boolean, e: MouseEvent) => {
      if (!isXeno) return;
      if (draggingId && e.button === 0) {
        // Lock in this tile as the drop target before mouseup fires
        e.preventDefault();
        updateDropTarget(geneId);
        skipNextClickToggle.current = true;
      }
    },
    [draggingId, updateDropTarget],
  );

  const handleGeneClick = useCallback(
    (geneId: string, isXeno: boolean, e: MouseEvent) => {
      if (!isXeno) return;
      if (draggingId) {
        e.preventDefault();
        return;
      }
      if (skipNextClickToggle.current) {
        e.preventDefault();
        skipNextClickToggle.current = false;
        return;
      }
      toggleXenoGene(geneId);
    },
    [draggingId, toggleXenoGene],
  );

  const handleGeneContextMenu = useCallback(
    (geneId: string, isXeno: boolean, e: MouseEvent) => {
      if (!isXeno) return;
      if (suppressNextContextMenu.current || draggingId) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      setDraggingId(geneId);
      setDropBeforeId(geneId);
      setDropIndicatorId(geneId);
    },
    [draggingId, setDraggingId, setDropBeforeId, suppressNextContextMenu],
  );

  const handleGeneMouseEnter = useCallback(
    (geneId: string, isXeno: boolean) => {
      if (draggingId && isXeno) updateDropTarget(geneId);
    },
    [draggingId, updateDropTarget],
  );

  return {
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
  };
};
