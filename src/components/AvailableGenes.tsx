import { useBuildStore } from '../store';
import { Gene } from '../types';
import { images } from '../images';
import './AvailableGenes.css';

export function AvailableGenes() {
  const genesById = useBuildStore(s => s.genesById);
  const selectedXeno = useBuildStore(s => s.selectedXeno);
  const selectedGermline = useBuildStore(s => s.selectedGermline);
  const germlinesById = useBuildStore(s => s.germlinesById);
  const suppressedGenes = useBuildStore(s => s.suppressedGenes);
  const toggleXenoGene = useBuildStore(s => s.toggleXenoGene);

  const genes = Object.values(genesById);

  const isGermlineMember = (geneId: string) => {
    if (!selectedGermline) return false;
    const g = germlinesById[selectedGermline];
    return g?.genes.includes(geneId) ?? false;
  };

  const warningGenes = useBuildStore(s => s.warningGenes);

  const getStatusLabel = (gene: Gene) => {
    if (warningGenes.has(gene.id)) return 'warning';
    if (isGermlineMember(gene.id)) return 'germline';
    if (selectedXeno.has(gene.id)) return 'selected';
    if (suppressedGenes.has(gene.id)) return 'suppressed';
    if (gene.conflicts?.some(id => selectedXeno.has(id))) return 'conflicted';
    return '';
  };

  return (
    <section className="available-genes">
      <h2>Available Genes</h2>
      <div className="gene-grid">
        {genes.map(gene => {
          const isSelected = selectedXeno.has(gene.id);
          const isGermline = isGermlineMember(gene.id);
          const isSuppressed = suppressedGenes.has(gene.id);
          const isWarning = warningGenes.has(gene.id);
          const isConflicted =
            gene.conflicts?.some(id => selectedXeno.has(id)) ?? false;
          const classNames = [
            'gene-card',
            isWarning && 'warning',
            isGermline && 'germline',
            isSelected && 'selected',
            isSuppressed && 'suppressed',
            isConflicted && 'conflicted',
          ]
            .filter(Boolean)
            .join(' ');
          const status = getStatusLabel(gene);
          return (
            <div
              key={gene.id}
              className={classNames}
              onClick={() => toggleXenoGene(gene.id)}
            >
              <div>
                {/* <img src={images.find(img => img.name == gene.imgSrc).src} alt={gene.name} /> */}
              </div>
              <div>
                <h3>{gene.name}</h3>
                <div className="stats">
                    <span>Efficiency: {gene.efficiency}</span>
                    <span>Complexity: {gene.complexity}</span>
                </div>
                <div className="status-label">{status}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
