export interface Gene {
  id: string;
  name: string;
  efficiency: number;
  complexity: number;
  conflicts?: string[];
  imgSrc?: string;
  capsules?: string;
  sourceXenos?: string[];
}

export interface Germline {
  name: string;
  genes: string[];
}

export interface SavedXenogerm {
  id: string;
  name: string;
  genes: string[];
}

export interface BuildState {
  allGenesById: Record<string, Gene>;
  germlinesById: Record<string, Germline>;
  selectedGermline: string | null;
  selectedXeno: Set<string>;
  suppressedGermlineGenesByXeno: Map<string, Set<string>>;
  conflictingXenoGenesGroups: Array<Set<string>>;
  overrideGenes: Set<string>;
  savedXenogerms: Record<string, SavedXenogerm>;
  currentSavedXenogermId: string | null;
  totals: {
    efficiency: number;
    xenogermEfficiency: number;
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
  setSavedXenogermName: (name: string) => void;
  deleteSavedXenogerm: (id: string) => void;
  loadSavedXenogerm: (id: string) => void;
  startNewSavedXenogerm: () => void;
  reset: () => void;
};
