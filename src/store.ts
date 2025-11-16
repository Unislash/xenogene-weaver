import { create } from 'zustand';
import { BuildState, BuildActions, Gene, Germline } from './types';
import { genesConflict } from './utils/geneConflicts';

export const useBuildStore = create<BuildState & BuildActions>((set, get) => ({
  genesById: {},
  germlinesById: {},
  selectedGermline: null,
  selectedXeno: new Set<string>(),
  suppressedGenes: new Set<string>(),
  conflictedGenes: new Set<string>(),
  overrideGenes: new Set<string>(),
  totals: {
    efficiency: 0,
    complexity: 0,
  },
  compatibleXenogerm: true,

  loadGenes: (genes: Gene[]) => {
    const genesById = Object.fromEntries(
      genes.map(gene => [gene.id, gene])
    );
    set({ genesById });
  },

  loadGermlines: (germlines: Germline[]) => {
    const germlinesById = Object.fromEntries(
      germlines.map(germline => [germline.name, germline])
    );
    set({ germlinesById });
  },

  selectGermline: (germlineId: string | null) => {
    // update selected germline and recompute suppressed genes and totals
    set({ selectedGermline: germlineId });
    const newSuppressed = get().calculateSuppressedGenes();
    set({ suppressedGenes: newSuppressed });
    get().calculateTotals();
  },

  toggleXenoGene: (geneId: string) => {
    const state = get();
    const newSelected = new Set(state.selectedXeno);
    const wasSelected = newSelected.has(geneId);

    if (wasSelected) {
      newSelected.delete(geneId);
    } else {
      newSelected.add(geneId);
    }

    const newSuppressed = get().calculateSuppressedGenes(newSelected);
    const newConflicted = get().calculateConflictedGenes(newSelected);
    if (!wasSelected) {
      newConflicted.delete(geneId);
    }
    const newOverrides = (() => {
      const overrides = new Set<string>();
      const snapshot = get();
      const suppressedGermline = newSuppressed;

      const conflictsSuppressed = (geneId: string) => {
        const gene = snapshot.genesById[geneId];
        if (!gene?.conflicts?.length) return false;
        for (const suppressedId of suppressedGermline) {
          const suppressedGene = snapshot.genesById[suppressedId];
          if (genesConflict(gene, suppressedGene)) return true;
        }
        return false;
      };

      for (const id of newSelected) {
        if (newConflicted.has(id)) continue;
        const gene = snapshot.genesById[id];
        if (!gene?.conflicts?.length) continue;

        if (conflictsSuppressed(id)) {
          overrides.add(id);
          continue;
        }

        for (const conflictedId of newConflicted) {
          const other = snapshot.genesById[conflictedId];
          if (genesConflict(gene, other)) {
            overrides.add(id);
            break;
          }
        }
      }

      return overrides;
    })();
    set({
      selectedXeno: newSelected,
      suppressedGenes: newSuppressed,
      conflictedGenes: newConflicted,
      overrideGenes: newOverrides,
    });
    get().calculateTotals();
  },

  calculateSuppressedGenes: (selectedOverride?: Set<string>) => {
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
        if (genesConflict(xenoGene, germlineGene)) newSuppressed.add(germlineGeneId);
      }
    }

    return newSuppressed;
  },

  calculateConflictedGenes: (selectedOverride?: Set<string>) => {
    const state = get();
    const selected = Array.from(selectedOverride ?? state.selectedXeno);
    const conflicted = new Set<string>();
    for (let i = 0; i < selected.length; i++) {
      const geneA = state.genesById[selected[i]];
      if (!geneA?.conflicts?.length) continue;
      for (let j = i + 1; j < selected.length; j++) {
        const geneB = state.genesById[selected[j]];
        if (!geneB?.conflicts?.length) continue;
        if (genesConflict(geneA, geneB)) {
          conflicted.add(selected[i]);
          conflicted.add(selected[j]);
        }
      }
    }
    return conflicted;
  },

  calculateTotals: () => {
    const state = get();
    const currentGermline = state.selectedGermline
      ? state.germlinesById[state.selectedGermline]
      : null;

    const activeGenes = new Set<string>();

    if (currentGermline) {
      for (const geneId of currentGermline.genes) {
        if (!state.suppressedGenes.has(geneId)) activeGenes.add(geneId);
      }
    }

    for (const geneId of state.selectedXeno) {
      if (state.conflictedGenes.has(geneId)) continue;
      activeGenes.add(geneId);
    }

    const totals = [...activeGenes].reduce(
      (acc, geneId) => {
        const gene = state.genesById[geneId];
        if (!gene) return acc;
        return {
          efficiency: acc.efficiency + gene.efficiency,
          complexity: acc.complexity + gene.complexity,
        };
      },
      { efficiency: 0, complexity: 0 }
    );

    set({ totals, compatibleXenogerm: totals.efficiency >= -5 });
  },

  reset: () => {
    set({
      selectedGermline: null,
      selectedXeno: new Set(),
      suppressedGenes: new Set(),
      conflictedGenes: new Set(),
      overrideGenes: new Set(),
      totals: { efficiency: 0, complexity: 0 },
      compatibleXenogerm: true,
    });
  },
}));
