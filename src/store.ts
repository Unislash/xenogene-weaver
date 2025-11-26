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
  
  // Computes which selected xenogerm genes should be marked as overrides
  const computeOverrides = (
    selected: Set<string>,
    suppressedGermline: Set<string>,
    conflictingXeno: Set<string>,
  ) => {
    const { genesById } = get();
    const overrides = new Set<string>();

    // Determine whether a gene clashes with any suppressed germline gene
    const conflictsWithSuppressed = (geneId: string) => {
      const gene = genesById[geneId];
      if (!gene?.conflicts?.length) return false;
      for (const suppressedId of suppressedGermline) {
        const suppressedGene = genesById[suppressedId];
        if (genesConflict(gene, suppressedGene)) return true;
      }
      return false;
    };

    for (const id of selected) {
      if (conflictingXeno.has(id)) continue;
      const gene = genesById[id];
      if (!gene?.conflicts?.length) continue;

      // Xenogerm genes that conflict with suppressed germline genes are overrides
      if (conflictsWithSuppressed(id)) {
        overrides.add(id);
        continue;
      }

      // Selected xenogerm genes that conflict with other selected xenogerm genes are overrides
      for (const conflictedId of conflictingXeno) {
        const other = genesById[conflictedId];
        if (genesConflict(gene, other)) {
          overrides.add(id);
          break;
        }
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

  // Applies a new selected xenogerm set and updates dependent state
  const applySelectionState = (
    selected: Set<string>,
    options?: { addedGeneId?: string },
  ) => {
    const suppressed = get().calculateSuppressedGermlineGenes(selected);
    const conflicting = get().calculateConflictingXenoGenes(selected);
    if (options?.addedGeneId) conflicting.delete(options.addedGeneId);
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
    genesById: {},
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
      complexity: 0,
    },
    compatibleXenogerm: true,

    /* Actions */
    // Load given genes into the store
    loadGenes: (genes: Gene[]) => {
      const genesById = Object.fromEntries(genes.map(gene => [gene.id, gene]));
      set({ genesById });
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
      const suppressed = get().calculateSuppressedGermlineGenes();
      const overrides = computeOverrides(
        get().selectedXeno,
        suppressed,
        get().conflictingXenoGenes,
      );
      set({ suppressedGermlineGenes: suppressed, overrideGenes: overrides });
      get().calculateTotals();
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
        wasSelected ? undefined : { addedGeneId: geneId },
      );
    },

    // Recalculates which germline genes are suppressed based on current selection
    // Suppressed genes are specifically germline genes that conflict with any selected xenogerm gene
    calculateSuppressedGermlineGenes: (selectedOverride?: Set<string>) => {
      const state = get();
      const newSuppressed = new Set<string>();
      const currentGermline = state.selectedGermline
        ? state.germlinesById[state.selectedGermline]
        : null;
      const selected = selectedOverride ?? state.selectedXeno;

      if (!currentGermline) return newSuppressed;

      for (const xenoId of selected) {
        const xenoGene = state.genesById[xenoId];
        if (!xenoGene) continue;
        for (const germlineGeneId of currentGermline.genes) {
          const germlineGene = state.genesById[germlineGeneId];
          if (genesConflict(xenoGene, germlineGene)) {
            newSuppressed.add(germlineGeneId);
          }
        }
      }

      return newSuppressed;
    },

    // Recalculates which xenogerm genes are conflicting based on current selection
    // Conflicting genes are those that conflict with other selected xenogerm genes
    calculateConflictingXenoGenes: (selectedOverride?: Set<string>) => {
      const state = get();
      const selected = Array.from(selectedOverride ?? state.selectedXeno);
      const conflicting = new Set<string>();
      for (let i = 0; i < selected.length; i++) {
        const geneA = state.genesById[selected[i]];
        if (!geneA?.conflicts?.length) continue;
        for (let j = i + 1; j < selected.length; j++) {
          const geneB = state.genesById[selected[j]];
          if (!geneB?.conflicts?.length) continue;
          if (genesConflict(geneA, geneB)) {
            conflicting.add(selected[i]);
            conflicting.add(selected[j]);
          }
        }
      }
      return conflicting;
    },

    // Sums up totals (not counting suppressed genes) and determines compatibility of the xenogerm
    calculateTotals: () => {
      const state = get();
      const currentGermline = state.selectedGermline
        ? state.germlinesById[state.selectedGermline]
        : null;

      const activeGenes = new Set<string>();

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
      }

      // Sum up totals
      const totals = [...activeGenes].reduce(
        (acc, geneId) => {
          const gene = state.genesById[geneId];
          if (!gene) return acc;
          return {
            efficiency: acc.efficiency + gene.efficiency,
            complexity: acc.complexity + gene.complexity,
          };
        },
        { efficiency: 0, complexity: 0 },
      );

      set({ totals, compatibleXenogerm: totals.efficiency >= -5 });
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
      const suppressed = state.calculateSuppressedGermlineGenes(newSelected);
      const conflicting = state.calculateConflictingXenoGenes(newSelected);
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
        totals: { efficiency: 0, complexity: 0 },
        compatibleXenogerm: true,
      });
    },
  };
});
