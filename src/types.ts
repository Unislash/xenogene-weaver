export interface Gene {
  id: string;
  name: string;
  efficiency: number;
  complexity: number;
  conflicts?: string[];
  imgSrc?: string;
  capsules?: string[];
  sourceXeno?: string;
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
  warningGenes: Set<string>;
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
  calculateSuppressedGenes: () => Set<string>;
  clearWarningGenes: () => void;
  reset: () => void;
};