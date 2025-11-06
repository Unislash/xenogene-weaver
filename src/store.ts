import { create } from 'zustand';
import { BuildState, BuildActions, Gene, Germline } from './types';

export const useBuildStore = create<BuildState & BuildActions>((set, get) => ({
  genesById: {},
  germlinesById: {},
  selectedGermline: null,
  selectedXeno: new Set<string>(),
  suppressedGenes: new Set<string>(),
  warningGenes: new Set<string>(),
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

    if (newSelected.has(geneId)) {
      newSelected.delete(geneId);
    } else {
      const gene = state.genesById[geneId];
      const currentGermline = state.selectedGermline
        ? state.germlinesById[state.selectedGermline]
        : null;

      // Determine conflicts *only* with other selected xeno genes. Conflicts with germline are allowed
      const conflictedWithXeno = gene.conflicts?.filter(conflictId => state.selectedXeno.has(conflictId)) ?? [];

      if (conflictedWithXeno.length > 0) {
        // Remove the conflicting xenogene(s) and add warning highlight
        for (const id of conflictedWithXeno) newSelected.delete(id);
        newSelected.add(geneId);
        const newWarnings = new Set(state.warningGenes);
        for (const id of conflictedWithXeno) newWarnings.add(id);
        set({ warningGenes: newWarnings });

        // Clear warnings after short timeout
        setTimeout(() => {
          const s = get();
          const cleared = new Set(s.warningGenes);
          for (const id of conflictedWithXeno) cleared.delete(id);
          set({ warningGenes: cleared });
        }, 1500);
      } else {
        // No conflict with other xeno genes, selection allowed even if it conflicts with germline
        newSelected.add(geneId);
      }
    }

    const newSuppressed = get().calculateSuppressedGenes();
    set({ selectedXeno: newSelected, suppressedGenes: newSuppressed });
    get().calculateTotals();
  },

  clearWarningGenes: () => {
    set({ warningGenes: new Set<string>() });
  },

  calculateSuppressedGenes: () => {
    const state = get();
    const newSuppressed = new Set<string>();
    const currentGermline = state.selectedGermline
      ? state.germlinesById[state.selectedGermline]
      : null;

    if (!currentGermline) return newSuppressed;

    for (const xenoId of state.selectedXeno) {
      const xenoGene = state.genesById[xenoId];
      if (!xenoGene?.conflicts) continue;
      for (const conflictId of xenoGene.conflicts) {
        if (currentGermline.genes.includes(conflictId)) newSuppressed.add(conflictId);
      }
    }

    return newSuppressed;
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

    for (const geneId of state.selectedXeno) activeGenes.add(geneId);

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
      totals: { efficiency: 0, complexity: 0 },
      compatibleXenogerm: true,
    });
  },
}));