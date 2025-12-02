import { create } from 'zustand';
import {
  BuildState,
  BuildActions,
  Gene,
  Germline,
  SavedXenogerm,
} from './types';
import { genesConflict } from './utils/geneConflicts';

const STORAGE_KEY = 'savedXenogerms';

// Storage helpers guard against SSR and swallow failures so the UI keeps working
const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const loadSavedXenogerms = (): Record<string, SavedXenogerm> => {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // ignore storage errors
  }
  return {};
};

const persistSavedXenogerms = (saved: Record<string, SavedXenogerm>) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // ignore write failures
  }
};

const generateSavedId = (name: string) => {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'xenogerm';
  return `${slug}-${Date.now().toString(36)}`;
};

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((val, idx) => val === b[idx]);

const MAX_HISTORY = 50;
const selectionToArray = (selection: Set<string>) => Array.from(selection);
const selectionsMatch = (a: Set<string>, b: Set<string>) =>
  arraysEqual(selectionToArray(a), selectionToArray(b));

export const useBuildStore = create<BuildState & BuildActions>((set, get) => {
  
  /**
   * Computes which selected xenogerm genes should be marked as overrides.
   *
   * Overrides are selected xenogerms that either:
   *   - suppress a germline gene (and are not overridden themselves in a conflict), or
   *   - are the "winner" among conflicting selected xeno genes.
   *
   * Winners among conflicting xeno genes are chosen by:
   *   1) higher efficiency
   *   2) on ties, later selection order (based on Set iteration order)
   *
   * Does not modify state; returns a new Set of override gene IDs.
   */
  const computeOverrides = (
    selected: Set<string>,
    suppressedByXeno: Map<string, Set<string>>,
    conflictGroups: Array<Set<string>>,
  ): Set<string> => {
    const { allGenesById } = get();

    const overrides = new Set<string>();

    // Determine winners/losers in each conflict group
    const losers = new Set<string>();

    // Tie-breaker: remember selection order
    const selectionOrder = new Map<string, number>();
    let orderIndex = 0;
    for (const id of selected) {
      selectionOrder.set(id, orderIndex++);
    }

    for (const group of conflictGroups) {
      let winnerId: string | null = null;
      let winnerEfficiency = -Infinity;
      let winnerOrder = -1;

      for (const geneId of group) {
        const gene = allGenesById[geneId];
        if (!gene) continue;

        const currentOrder = selectionOrder.get(geneId) ?? -1;

        if (
          gene.efficiency > winnerEfficiency ||
          (gene.efficiency === winnerEfficiency && currentOrder > winnerOrder)
        ) {
          winnerId = geneId;
          winnerEfficiency = gene.efficiency;
          winnerOrder = currentOrder;
        }
      }

      if (!winnerId) continue;

      // Winner is always an override
      overrides.add(winnerId);

      // Everyone else in the group is a loser
      for (const geneId of group) {
        if (geneId !== winnerId) {
          losers.add(geneId);
        }
      }
    }

    // Any xenogerm that suppresses germline genes is an override,
    // unless it lost a conflict.
    for (const [xenoId, suppressed] of suppressedByXeno) {
      if (suppressed.size > 0 && !losers.has(xenoId)) {
        overrides.add(xenoId);
      }
    }

    return overrides;
  };

  // Abstracted method to update undo/redo history state.
  // Is the low-level setter that writes both stacks (past and future) and keeps canUndo/canRedo in sync
  const updateHistoryState = (past: string[][], future: string[][]) => {
    set({
      selectionHistory: { past, future },
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    });
  };

  // Helper method that decides when a change should be recorded (e.g., only when the selection actually
  // changed, deduping against the last entry, trimming to max length) and then calls updateHistoryState.
  const recordSelectionHistory = (previousSelection: Set<string>) => {
    const previousArray = selectionToArray(previousSelection);
    const { selectionHistory } = get();
    const lastPast = selectionHistory.past[selectionHistory.past.length - 1];
    if (lastPast && arraysEqual(lastPast, previousArray)) return;
    const trimmedPast = [...selectionHistory.past, previousArray].slice(-MAX_HISTORY);
    updateHistoryState(trimmedPast, []);
  };

  // Update the currently loaded saved xenogerm with the new selection
  const syncCurrentSavedXenogerm = (selected: Set<string>) => {
    const state = get();
    const currentId = state.currentSavedXenogermId;
    if (!currentId) return;
    const saved = state.savedXenogerms[currentId];
    if (!saved) return;
    const genes = Array.from(selected);
    if (arraysEqual(saved.genes, genes)) return;
    const updated = { ...saved, genes };
    const savedXenogerms = { ...state.savedXenogerms, [currentId]: updated };
    persistSavedXenogerms(savedXenogerms);
    set({ savedXenogerms });
  };

  /**
   * Helper method that calculates which germline genes are suppressed based on given selection of xeno genes
   * Note: Suppressed genes are specifically germline genes that conflict with any selected xenogerm gene
   * 
   * Does not modify state directly; returns a map of xeno gene ID -> suppressed germline gene IDs
   */
  const calculateSuppressedGermlineGenes = (
    selectedXenoGeneIds: Set<string>,
  ): Map<string, Set<string>> => {
    const state = get();
    const suppressedByXeno = new Map<string, Set<string>>();
    const currentGermline = state.selectedGermline
      ? state.germlinesById[state.selectedGermline]
      : null;

    if (!currentGermline) return suppressedByXeno;

    for (const xenoId of selectedXenoGeneIds) {
      const xenoGene = state.allGenesById[xenoId];
      if (!xenoGene) continue;
      let suppressedForXeno: Set<string> | undefined;
      for (const germlineGeneId of currentGermline.genes) {
        const germlineGene = state.allGenesById[germlineGeneId];
        if (genesConflict(xenoGene, germlineGene)) {
          if (!suppressedForXeno) {
            suppressedForXeno = new Set<string>();
            suppressedByXeno.set(xenoId, suppressedForXeno);
          }
          suppressedForXeno.add(germlineGeneId);
        }
      }
    }

    return suppressedByXeno;
  };

  /**
   * Helper that groups selected xenogerm genes and any genes that share a conflict string.
   *
   * For each selected xenogerm:
   *   - look through allGenesById for genes whose `conflicts` array
   *     shares at least one string with the selected gene's `conflicts`
   *   - if any matches are found, create a group containing:
   *       - the selected gene's ID
   *       - the IDs of all matching genes
   *
   * Does not modify state; returns an array of Sets of gene IDs.
   */
  const calculateConflictingXenoGenes = (
    selectedXenoGeneIds: Set<string>
  ): Array<Set<string>> => {
    const { allGenesById } = get();

    const groups: Array<Set<string>> = [];
    const seenSignatures = new Set<string>();

    for (const selectedId of selectedXenoGeneIds) {
      const selectedGene = allGenesById[selectedId];
      if (!selectedGene?.conflicts?.length) continue;

      const groupIds: string[] = [selectedId];

      for (const otherGeneId of selectedXenoGeneIds) {
        if (otherGeneId === selectedId) continue;

        const otherGene = allGenesById[otherGeneId];
        if (!otherGene) continue;

        if (!genesConflict(selectedGene, otherGene)) continue;

        groupIds.push(otherGeneId);
      }

      // If we found no matching genes, skip this one
      if (groupIds.length <= 1) continue;

      // Sort + join to avoid adding duplicate groups (e.g. [A,B] vs [B,A])
      const signature = [...groupIds].sort().join("|");
      if (seenSignatures.has(signature)) continue;

      seenSignatures.add(signature);
      groups.push(new Set(groupIds));
    }

    return groups;
  };

  /**
   * This is an abstraction method that is used in many actions. It takes the given "selected" xenogerm set
   * and updates the state accordingly.
   * Note: this is what actually sets the state when xenogerms are toggled or a germline is selected
   */
  const applySelectionState = (
    selected: Set<string>,
  ) => {
    const suppressedByXeno = calculateSuppressedGermlineGenes(selected);
    const conflictGroups = calculateConflictingXenoGenes(selected);
    const overrides = computeOverrides(selected, suppressedByXeno, conflictGroups);
    set({
      selectedXeno: selected,
      suppressedGermlineGenesByXeno: suppressedByXeno,
      conflictingXenoGenesGroups: conflictGroups,
      overrideGenes: overrides,
    });
    syncCurrentSavedXenogerm(selected);
    get().calculateTotals();
  };
  
  // Initial state
  return {
    /* State */
    allGenesById: {},
    germlinesById: {},
    selectedGermline: null,
    selectedXeno: new Set<string>(),
    suppressedGermlineGenesByXeno: new Map<string, Set<string>>(),
    conflictingXenoGenesGroups: [],
    overrideGenes: new Set<string>(),
    savedXenogerms: loadSavedXenogerms(),
    currentSavedXenogermId: null,
    selectionHistory: { past: [], future: [] },
    canUndo: false,
    canRedo: false,
    totals: {
      efficiency: 0,
      xenogermEfficiency: 0,
      complexity: 0,
    },
    compatibleXenogerm: true,

    /* Actions */
    // Load given genes into the store
    loadGenes: (genes: Gene[]) => {
      const allGenesById = Object.fromEntries(genes.map(gene => [gene.id, gene]));
      set({ allGenesById: allGenesById });
    },

    // Load given germlines into the store
    loadGermlines: (germlines: Germline[]) => {
      const germlinesById = Object.fromEntries(
        germlines.map(germline => [germline.name, germline]),
      );
      set({ germlinesById });
    },

    // Select a germline by ID (or null to deselect)
    selectGermline: (germlineId: string | null) => {
      set({ selectedGermline: germlineId });
      applySelectionState(new Set(get().selectedXeno));
    },

    // Toggle selection of a xenogerm gene by ID
    toggleXenoGene: (geneId: string) => {
      const state = get();
      const newSelected = new Set(state.selectedXeno);
      const wasSelected = newSelected.has(geneId);
      if (wasSelected) newSelected.delete(geneId);
      else newSelected.add(geneId);
      if (selectionsMatch(state.selectedXeno, newSelected)) return;
      recordSelectionHistory(state.selectedXeno);
      // Keep suppressed/conflicting/override state in sync with the new selection
      applySelectionState(
        newSelected,
      );
    },

    // Sums up totals (not counting suppressed genes) and determines compatibility of the xenogerm
    calculateTotals: () => {
      const state = get();
      const currentGermline = state.selectedGermline
        ? state.germlinesById[state.selectedGermline]
        : null;

      const activeGenes = new Set<string>();
      const activeXenogermGenes = new Set<string>();

      // Add germline genes that are not suppressed
      if (currentGermline) {
        const suppressedSet = new Set<string>();
        for (const suppressed of state.suppressedGermlineGenesByXeno.values()) {
          for (const id of suppressed) suppressedSet.add(id);
        }

        for (const geneId of currentGermline.genes) {
          if (!suppressedSet.has(geneId)) activeGenes.add(geneId);
        }
      }

      // Add selected xenogerm genes that are not conflicting
      const conflictingSet = new Set<string>();
      for (const group of state.conflictingXenoGenesGroups) {
        for (const id of group) conflictingSet.add(id);
      }

      for (const geneId of state.selectedXeno) {
        if (conflictingSet.has(geneId) && !state.overrideGenes.has(geneId) ) continue;
        activeGenes.add(geneId);
        activeXenogermGenes.add(geneId);
      }

      const sumTotals = (genes: Set<string>) =>
        [...genes].reduce(
          (acc, geneId) => {
            const gene = state.allGenesById[geneId];
            if (!gene) return acc;
            return {
              efficiency: acc.efficiency + gene.efficiency,
              complexity: acc.complexity + gene.complexity,
            };
          },
          { efficiency: 0, complexity: 0 },
        );

      // Sum up totals
      const totals = sumTotals(activeGenes);
      const xenogermTotals = sumTotals(activeXenogermGenes);

      set({
        totals: { ...totals, xenogermEfficiency: xenogermTotals.efficiency },
        compatibleXenogerm: totals.efficiency >= -5,
      });
    },

    // Save or update the current xenogerm selection under a given name to local storage
    setSavedXenogermName: (rawName: string) => {
      const name = rawName.trim();
      if (!name) return;
      const state = get();
      const existingId = state.currentSavedXenogermId;
      if (existingId) {
        const existing = state.savedXenogerms[existingId];
        if (!existing) return;
        if (existing.name === name) return;
        const updated = { ...existing, name };
        const savedXenogerms = { ...state.savedXenogerms, [existingId]: updated };
        persistSavedXenogerms(savedXenogerms);
        set({ savedXenogerms });
      } else {
        const id = generateSavedId(name);
        const newEntry: SavedXenogerm = {
          id,
          name,
          genes: Array.from(state.selectedXeno),
        };
        const savedXenogerms = { ...state.savedXenogerms, [id]: newEntry };
        persistSavedXenogerms(savedXenogerms);
        set({ savedXenogerms, currentSavedXenogermId: id });
      }
    },

    // Delete a saved xenogerm selection by ID
    deleteSavedXenogerm: (id: string) => {
      const state = get();
      if (!state.savedXenogerms[id]) return;
      const savedXenogerms = { ...state.savedXenogerms };
      delete savedXenogerms[id];
      persistSavedXenogerms(savedXenogerms);
      set({
        savedXenogerms,
        currentSavedXenogermId:
          state.currentSavedXenogermId === id ? null : state.currentSavedXenogermId,
      });
    },

    // Load a saved xenogerm selection by ID
    loadSavedXenogerm: (id: string) => {
      const state = get();
      const saved = state.savedXenogerms[id];
      if (!saved) return;
      const newSelected = new Set(saved.genes);
      if (!selectionsMatch(state.selectedXeno, newSelected)) {
        recordSelectionHistory(state.selectedXeno);
      }
      set({ currentSavedXenogermId: id });
      applySelectionState(newSelected);
    },

    // Start a new unsaved xenogerm selection
    startNewSavedXenogerm: () => {
      const state = get();
      const emptySelection = new Set<string>();
      if (!selectionsMatch(state.selectedXeno, emptySelection)) {
        recordSelectionHistory(state.selectedXeno);
      }
      set({ currentSavedXenogermId: null });
      applySelectionState(emptySelection);
    },

    undoGeneSelection: () => {
      const state = get();
      const { past, future } = state.selectionHistory;
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      const updatedPast = past.slice(0, -1);
      const currentArray = selectionToArray(state.selectedXeno);
      const updatedFuture = [currentArray, ...future];
      updateHistoryState(updatedPast, updatedFuture);
      applySelectionState(new Set(previous));
    },

    redoGeneSelection: () => {
      const state = get();
      const { past, future } = state.selectionHistory;
      if (future.length === 0) return;
      const next = future[0];
      const remainingFuture = future.slice(1);
      const currentArray = selectionToArray(state.selectedXeno);
      const updatedPast = [...past, currentArray].slice(-MAX_HISTORY);
      updateHistoryState(updatedPast, remainingFuture);
      applySelectionState(new Set(next));
    },

    reorderSelectedXeno: (id: string, beforeId: string | null) => {
      const state = get();
      if (!state.selectedXeno.has(id)) return;
      const currentOrder = Array.from(state.selectedXeno);
      const without = currentOrder.filter(geneId => geneId !== id);
      const insertIndex =
        beforeId && without.includes(beforeId) ? without.indexOf(beforeId) : without.length;
      const newOrder = [
        ...without.slice(0, insertIndex),
        id,
        ...without.slice(insertIndex),
      ];
      if (arraysEqual(currentOrder, newOrder)) return;
      recordSelectionHistory(state.selectedXeno);
      applySelectionState(new Set(newOrder));
    },

    reset: () => {
      set({
        selectedGermline: null,
        selectedXeno: new Set(),
        suppressedGermlineGenesByXeno: new Map(),
        conflictingXenoGenesGroups: [],
        overrideGenes: new Set(),
        currentSavedXenogermId: null,
        selectionHistory: { past: [], future: [] },
        canUndo: false,
        canRedo: false,
        totals: { efficiency: 0, xenogermEfficiency: 0, complexity: 0 },
        compatibleXenogerm: true,
      });
    },
  };
});
