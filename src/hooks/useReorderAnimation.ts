import {
  MutableRefObject,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';

type Entry = {
  id: string;
  type: 'germline' | 'xeno';
};

type Params = {
  allEntries: Entry[];
  draggingId: string | null;
  dropBeforeId: string | null;
  setDraggingId: (id: string | null) => void;
  setDropBeforeId: (id: string | null) => void;
  reorderSelectedXeno: (id: string, beforeId: string | null) => void;
  triggerDropPulse: (id: string) => void;
  suppressNextContextMenu: MutableRefObject<boolean>;
};

type HookResult = {
  completeReorder: (targetBeforeId?: string | null) => void;
  cardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
};

export const useReorderAnimation = ({
  allEntries,
  draggingId,
  dropBeforeId,
  setDraggingId,
  setDropBeforeId,
  reorderSelectedXeno,
  triggerDropPulse,
  suppressNextContextMenu,
}: Params): HookResult => {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastPositions = useRef<Record<string, DOMRect>>({});

  const completeReorder = useCallback(
    (targetBeforeId?: string | null) => {
      if (!draggingId) return;

      const effectiveBeforeId =
        typeof targetBeforeId === 'undefined' ? dropBeforeId : targetBeforeId;

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
      setDraggingId,
      setDropBeforeId,
      triggerDropPulse,
      suppressNextContextMenu,
    ],
  );

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

  return { completeReorder, cardRefs };
};
