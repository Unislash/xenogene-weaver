import { useBuildStore } from '../store';
import { getGeneImage } from '../images';
import './ResultingGenes.css';

export const ResultingGenes = () => {
  const genesById = useBuildStore(s => s.allGenesById);
  const selectedXeno = useBuildStore(s => s.selectedXeno);
  const selectedGermline = useBuildStore(s => s.selectedGermline);
  const germlinesById = useBuildStore(s => s.germlinesById);
  const suppressedGermlineGenesByXeno = useBuildStore(s => s.suppressedGermlineGenesByXeno);
  const conflictingXenoGenesGroups = useBuildStore(s => s.conflictingXenoGenesGroups);
  const overrideGenes = useBuildStore(s => s.overrideGenes);
  const toggleXenoGene = useBuildStore(s => s.toggleXenoGene);

  const suppressedSet = new Set<string>();
  for (const suppressed of suppressedGermlineGenesByXeno.values()) {
    for (const id of suppressed) suppressedSet.add(id);
  }

  const conflictingSet = new Set<string>();
  for (const group of conflictingXenoGenesGroups) {
    for (const id of group) conflictingSet.add(id);
  }

  const activeGenes: Array<{
    id: string;
    type: 'germline' | 'xeno';
    inactive?: boolean;
    override?: boolean;
  }> = [];

  if (selectedGermline) {
    const g = germlinesById[selectedGermline];
    if (g) {
      for (const id of g.genes) {
        const isSuppressed = suppressedSet.has(id);
        activeGenes.push({ id, type: 'germline', inactive: isSuppressed });
      }
    }
  }

  for (const id of selectedXeno) {
    const inactiveFromConflict = conflictingSet.has(id) && !overrideGenes.has(id);
    activeGenes.push({
      id,
      type: 'xeno',
      inactive: inactiveFromConflict,
      override: overrideGenes.has(id),
    });
  }

  return (
    <section className="resulting-genes">
      <h2>Resulting Xenogerm</h2>
      <div className="gene-grid">
        {activeGenes.map(({ id, type, inactive, override }) => {
          const gene = genesById[id];
          if (!gene) return null;
          const isXeno = type === 'xeno';
          const isSuppressed = Boolean(inactive);
          const classNames = [
            'gene-card',
            gene.capsules && 'archite',
            type,
            isSuppressed && 'suppressed',
            isXeno && 'clickable',
          ]
            .filter(Boolean)
            .join(' ');

          const statusLabels: Array<{ key: string; text: string }> = [];
          if (isSuppressed) {
            statusLabels.push({ key: 'suppressed', text: 'Suppressed' });
          }
          if (override) {
            statusLabels.push({ key: 'override', text: 'Override' });
          }
          const imageSrc = getGeneImage(gene.imgSrc);

          return (
            <div
              key={`${gene.id}-${type}`}
              className={classNames}
              onClick={isXeno ? () => toggleXenoGene(gene.id) : undefined}
            >
              {imageSrc && (
                <div className="gene-thumb">
                  <img src={imageSrc} alt={gene.name} loading="lazy" />
                </div>
              )}
              <h3>{gene.name}</h3>
              <div className="stats">
                <span>Complexity: {gene.complexity}</span>
                <span>Efficiency: {gene.efficiency}</span>
              </div>
              {statusLabels.length > 0 && (
                <div className="status-label">
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
            No genes selected. Select a germline and/or add xenogenes to begin.
          </div>
        )}
      </div>
    </section>
  );
}
