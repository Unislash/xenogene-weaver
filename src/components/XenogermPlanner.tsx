import { useEffect } from 'react';
import { useBuildStore } from '../store';
import { GermlineSelector } from './GermlineSelector';
import { AvailableGenes } from './AvailableGenes';
import { ResultingGenes } from './ResultingGenes';
import { Stats } from './Stats';
import { SavedXenogerms } from './SavedXenogerms';
import './XenogermPlanner.css';

export function XenogermPlanner() {
  const loadGenes = useBuildStore(state => state.loadGenes);
  const loadGermlines = useBuildStore(s => s.loadGermlines);

  useEffect(() => {
    Promise.all([
      import('../data/genes.json'),
      import('../data/germlines.json')
    ]).then(([genesData, germlinesData]) => {
      loadGenes(genesData.genes);
      loadGermlines(germlinesData.germlines);
    });
  }, [loadGenes, loadGermlines]);

  return (
    <div className="xenogerm-planner">
      <h1>RimWorld Xenogerm Planner</h1>
      <SavedXenogerms />
      <GermlineSelector />
      <Stats />
      <ResultingGenes />
      <AvailableGenes />
    </div>
  );
}
