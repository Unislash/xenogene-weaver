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

export const useBuildStore = create<BuildState & BuildActions>((set, get) => {
  
  /**
   * Computes which selected xenogerm genes should be marked as overrides
   * Overrides are those selected xenogerms that either suppress a germline gene,
   * or are the winner between selected xeno genes that conflict.
   * 
   * Winners between conflicting xeno genes are determined by those that have greater
   * efficiency; ties go to the later-selected gene (based on Set iteration order)
   * 
   * Does not modify state directly; returns the new Set of override gene IDs
   */
  const computeOverrides = (
    selected: Set<string>,
    suppressedGermline: Set<string>,
    conflictingXeno: Set<string>,
  ) => {
    const overrides = new Set<string>();

    const state = get();
    const { allGenesById } = state;

    // First, add any selected xeno genes that suppress germline genes
    // TODO: implement this logic

    // Next, determine winners among conflicting xeno genes
    const conflictingGroups: string[][] = [];
    const processed = new Set<string>();

    for (const geneId of conflictingXeno) {
      if (processed.has(geneId)) continue;
      const group = [geneId];
      processed.add(geneId);
      const geneA = allGenesById[geneId];
      if (!geneA || !geneA.conflicts) continue;

      for (const otherId of conflictingXeno) {
        if (otherId === geneId || processed.has(otherId)) continue;
        const geneB = allGenesById[otherId];
        if (!geneB) continue;
        if (genesConflict(geneA, geneB)) {
          group.push(otherId);
          processed.add(otherId);
        }
      }

      conflictingGroups.push(group);
    }

    // For each group of conflicting genes, determine the winner
    for (const group of conflictingGroups) {
      let winnerId: string | null = null;
      let winnerEfficiency = -Infinity;

      for (const geneId of group) {
        const gene = allGenesById[geneId];
        if (!gene) continue;
        if (
          gene.efficiency > winnerEfficiency ||
          (gene.efficiency === winnerEfficiency &&
            (!winnerId || Array.from(selected).indexOf(geneId) >
              Array.from(selected).indexOf(winnerId)))
        ) {
          winnerId = geneId;
          winnerEfficiency = gene.efficiency;
        }
      }

      if (winnerId) {
        overrides.add(winnerId);
      }
    }

    return overrides;
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
   * Does not modify state directly; returns the new Set of suppressed gene IDs
   */
  const calculateSuppressedGermlineGenes = (selectedXenoGeneIds: Set<string>) => {
    const state = get();
    const newSuppressed = new Set<string>();
    const currentGermline = state.selectedGermline
      ? state.germlinesById[state.selectedGermline]
      : null;

    if (!currentGermline) return newSuppressed;

    for (const xenoId of selectedXenoGeneIds) {
      const xenoGene = state.allGenesById[xenoId];
      if (!xenoGene) continue;
      for (const germlineGeneId of currentGermline.genes) {
        const germlineGene = state.allGenesById[germlineGeneId];
        if (genesConflict(xenoGene, germlineGene)) {
          newSuppressed.add(germlineGeneId);
        }
      }
    }

    return newSuppressed;
  };

  /**
   * Helper method that calculates which xenogerm genes are conflicting based on given selection of xeno genes
   * Note: Conflicting genes are selected xenogerm genes that conflict with other selected xenogerm genes
   * 
   * Does not modify state directly; returns the new Set of suppressed gene IDs
   */
  const calculateConflictingXenoGenes = (
    selectedXenoGeneIds: Set<string>
  ): Set<string> => {
    const { allGenesById } = get();

    // Map selected IDs to gene objects and filter out anything
    // that doesn't exist or has no possible conflicts
    const selectedGenes: Gene[] = Array.from(selectedXenoGeneIds)
      .map((id) => allGenesById[id] as Gene | undefined)
      .filter(
        (gene): gene is Gene =>
          Boolean(gene && gene.conflicts && gene.conflicts.length > 0)
      );

    const conflicting = new Set<string>();

    for (let i = 0; i < selectedGenes.length; i++) {
      const geneA = selectedGenes[i];

      for (let j = i + 1; j < selectedGenes.length; j++) {
        const geneB = selectedGenes[j];

        if (genesConflict(geneA, geneB)) {
          conflicting.add(geneA.id);
          conflicting.add(geneB.id);
        }
      }
    }

    return conflicting;
  };

  /**
   * This is an abstraction method that is used in many actions. It takes the given "selected" xenogerm set
   * and updates the state accordingly.
   * Note: this is what actually sets the state when xenogerms are toggled or a germline is selected
   */
  const applySelectionState = (
    selected: Set<string>,
  ) => {
    const suppressed = calculateSuppressedGermlineGenes(selected);
    const conflicting = calculateConflictingXenoGenes(selected);
    const overrides = computeOverrides(selected, suppressed, conflicting);
    set({
      selectedXeno: selected,
      suppressedGermlineGenes: suppressed,
      conflictingXenoGenes: conflicting,
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
    suppressedGermlineGenes: new Set<string>(),
    conflictingXenoGenes: new Set<string>(),
    overrideGenes: new Set<string>(),
    savedXenogerms: loadSavedXenogerms(),
    currentSavedXenogermId: null,
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
        for (const geneId of currentGermline.genes) {
          if (!state.suppressedGermlineGenes.has(geneId)) activeGenes.add(geneId);
        }
      }

      // Add selected xenogerm genes that are not conflicting
      for (const geneId of state.selectedXeno) {
        if (state.conflictingXenoGenes.has(geneId)) continue;
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
      const suppressed = calculateSuppressedGermlineGenes(newSelected);
      const conflicting = calculateConflictingXenoGenes(newSelected);
      const overrides = computeOverrides(newSelected, suppressed, conflicting);
      set({
        selectedXeno: newSelected,
        suppressedGermlineGenes: suppressed,
        conflictingXenoGenes: conflicting,
        overrideGenes: overrides,
        currentSavedXenogermId: id,
      });
      get().calculateTotals();
    },

    // Start a new unsaved xenogerm selection
    startNewSavedXenogerm: () => {
      set({ currentSavedXenogermId: null });
      applySelectionState(new Set());
    },

    reset: () => {
      set({
        selectedGermline: null,
        selectedXeno: new Set(),
        suppressedGermlineGenes: new Set(),
        conflictingXenoGenes: new Set(),
        overrideGenes: new Set(),
        currentSavedXenogermId: null,
        totals: { efficiency: 0, xenogermEfficiency: 0, complexity: 0 },
        compatibleXenogerm: true,
      });
    },
  };
});
