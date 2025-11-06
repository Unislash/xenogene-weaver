import { useBuildStore } from '../store';
import './ResultingGenes.css';

export function ResultingGenes() {
  const genesById = useBuildStore(s => s.genesById);
  const selectedXeno = useBuildStore(s => s.selectedXeno);
  const selectedGermline = useBuildStore(s => s.selectedGermline);
  const germlinesById = useBuildStore(s => s.germlinesById);
  const suppressedGenes = useBuildStore(s => s.suppressedGenes);
  const toggleXenoGene = useBuildStore(s => s.toggleXenoGene);

  const activeGenes: Array<{ id: string; type: 'germline' | 'xeno' }> = [];

  if (selectedGermline) {
    const g = germlinesById[selectedGermline];
    if (g) {
      for (const id of g.genes) {
        if (!suppressedGenes.has(id)) activeGenes.push({ id, type: 'germline' });
      }
    }
  }

  for (const id of selectedXeno) activeGenes.push({ id, type: 'xeno' });

  return (
    <section className="resulting-genes">
      <h2>Resulting Xenogerm</h2>
      <div className="gene-grid">
        {activeGenes.map(({ id, type }) => {
          const gene = genesById[id];
          if (!gene) return null;
          return (
            <div key={gene.id} className={`gene-card ${type}`}>
              <h3>{gene.name}</h3>
              <div className="stats">
                <span>Efficiency: {gene.efficiency}</span>
                <span>Complexity: {gene.complexity}</span>
              </div>
              {type === 'xeno' && (
                <button className="remove-button" onClick={() => toggleXenoGene(gene.id)}>
                  Remove
                </button>
              )}
            </div>
          );
        })}
        {activeGenes.length === 0 && (
          <div className="empty-state">
            No genes selected. Select a germline and/or add xenogenes to create your xenogerm.
          </div>
        )}
      </div>
    </section>
  );
}