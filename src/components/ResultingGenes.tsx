import { useBuildStore } from '../store';
import './ResultingGenes.css';

export const ResultingGenes = () => {
  const genesById = useBuildStore(s => s.genesById);
  const selectedXeno = useBuildStore(s => s.selectedXeno);
  const selectedGermline = useBuildStore(s => s.selectedGermline);
  const germlinesById = useBuildStore(s => s.germlinesById);
  const suppressedGenes = useBuildStore(s => s.suppressedGenes);
  const conflictedGenes = useBuildStore(s => s.conflictedGenes);
  const overrideGenes = useBuildStore(s => s.overrideGenes);
  const toggleXenoGene = useBuildStore(s => s.toggleXenoGene);

  const activeGenes: Array<{
    id: string;
    type: 'germline' | 'xeno';
    suppressed?: boolean;
    conflicted?: boolean;
    override?: boolean;
  }> = [];

  if (selectedGermline) {
    const g = germlinesById[selectedGermline];
    if (g) {
      for (const id of g.genes) {
        const isSuppressed = suppressedGenes.has(id);
        activeGenes.push({ id, type: 'germline', suppressed: isSuppressed });
      }
    }
  }

  for (const id of selectedXeno) {
    activeGenes.push({
      id,
      type: 'xeno',
      conflicted: conflictedGenes.has(id),
      override: overrideGenes.has(id),
    });
  }

  return (
    <section className="resulting-genes">
      <h2>Resulting Xenogerm</h2>
      <div className="gene-grid">
        {activeGenes.map(({ id, type, suppressed, conflicted, override }) => {
          const gene = genesById[id];
          if (!gene) return null;
          const isXeno = type === 'xeno';
          const classNames = [
            'gene-card',
            type,
            (suppressed || conflicted) && 'suppressed',
            isXeno && 'clickable',
          ]
            .filter(Boolean)
            .join(' ');

          const statusLabels: Array<{ key: string; text: string }> = [];
          if (suppressed || conflicted) {
            statusLabels.push({ key: 'suppressed', text: 'Suppressed' });
          }
          if (override) {
            statusLabels.push({ key: 'override', text: 'Override' });
          }

          return (
            <div
              key={gene.id}
              className={classNames}
              onClick={isXeno ? () => toggleXenoGene(gene.id) : undefined}
            >
              <h3>{gene.name}</h3>
              <div className="stats">
                <span>Complexity: {gene.complexity}</span>
                <span>Efficiency: {gene.efficiency}</span>
              </div>
              {statusLabels.length > 0 && (
                <div className="status-row">
                  {statusLabels.map(({ key, text }) => (
                    <span key={key} className={`status ${key}`}>
                      {text}
                    </span>
                  ))}
                </div>
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
