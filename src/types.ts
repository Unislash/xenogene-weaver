export interface Gene {
  id: string;
  name: string;
  efficiency: number;
  complexity: number;
  conflicts?: string[];
  imgSrc?: string;
  capsules?: string[];
  sourceXenos?: string[];
}

export interface Germline {
  name: string;
  genes: string[];
}

export interface BuildState {
  genesById: Record<string, Gene>;
  germlinesById: Record<string, Germline>;
  selectedGermline: string | null;
  selectedXeno: Set<string>;
  suppressedGenes: Set<string>;
  conflictedGenes: Set<string>;
  overrideGenes: Set<string>;
  totals: {
    efficiency: number;
    complexity: number;
  };
  compatibleXenogerm: boolean;
}

export type BuildActions = {
  loadGenes: (genes: Gene[]) => void;
  loadGermlines: (germlines: Germline[]) => void;
  selectGermline: (germlineId: string | null) => void;
  toggleXenoGene: (geneId: string) => void;
  calculateTotals: () => void;
  calculateSuppressedGenes: (selectedOverride?: Set<string>) => Set<string>;
  calculateConflictedGenes: (selectedOverride?: Set<string>) => Set<string>;
  reset: () => void;
};
