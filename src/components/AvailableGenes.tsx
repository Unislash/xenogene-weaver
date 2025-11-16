import { useBuildStore } from '../store';
import { Gene } from '../types';
import { genesConflict } from '../utils/geneConflicts';
import { getGeneImage } from '../images';
import './AvailableGenes.css';

export const AvailableGenes = () => {
  const genesById = useBuildStore(s => s.genesById);
  const selectedXeno = useBuildStore(s => s.selectedXeno);
  const selectedGermline = useBuildStore(s => s.selectedGermline);
  const germlinesById = useBuildStore(s => s.germlinesById);
  const suppressedGenes = useBuildStore(s => s.suppressedGenes);
  const conflictedGenes = useBuildStore(s => s.conflictedGenes);
  const overrideGenes = useBuildStore(s => s.overrideGenes);
  const toggleXenoGene = useBuildStore(s => s.toggleXenoGene);

  const genes = Object.values(genesById);

  const isGermlineMember = (geneId: string) => {
    if (!selectedGermline) return false;
    const g = germlinesById[selectedGermline];
    return g?.genes.includes(geneId) ?? false;
  };

  const conflictsWithSelected = (gene: Gene) => {
    for (const selectedId of selectedXeno) {
      if (selectedId === gene.id) continue;
      const selectedGene = genesById[selectedId];
      if (genesConflict(gene, selectedGene)) return true;
    }
    return false;
  };

  const getStatusLabel = (
    {
      isSelected,
      isGermline,
      showSuppressed,
      isOverride,
      showConflictedHint,
    }: {
      isSelected: boolean;
      isGermline: boolean;
      showSuppressed: boolean;
      isOverride: boolean;
      showConflictedHint: boolean;
    }
  ) => {
    if (isOverride) return 'override';
    if (showSuppressed) return 'suppressed';
    if (isGermline) return 'germline';
    if (isSelected) return 'selected';
    if (showConflictedHint) return 'suppressed';
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
          const isConflictedSelected = isSelected && conflictedGenes.has(gene.id);
          const isConflicted = isSelected
            ? isConflictedSelected
            : conflictsWithSelected(gene);
          const isOverride = overrideGenes.has(gene.id);
          const showSuppressed = isGermline
            ? isSuppressed
            : isConflictedSelected;
          const classNames = [
            'gene-card',
            'clickable',
            isGermline && 'germline',
            isSelected && 'selected',
            gene.capsules && 'archite',
            showSuppressed && 'suppressed',
            !isSelected && isConflicted && 'conflicted',
          ]
            .filter(Boolean)
            .join(' ');
          const status = getStatusLabel({
            isSelected,
            isGermline,
            showSuppressed,
            isOverride,
            showConflictedHint: !isSelected && isConflicted,
          });
          const imageSrc = getGeneImage(gene.imgSrc);
          return (
            <div
              key={gene.id}
              className={classNames}
              onClick={() => toggleXenoGene(gene.id)}
            >
              {imageSrc && (
                <div className="gene-thumb">
                  <img src={imageSrc} alt={gene.name} loading="lazy" />
                </div>
              )}
              <div>
                <h3>{gene.name}</h3>
                <div className="stats">
                  <span>Complexity: {gene.complexity}</span>
                  <span>Efficiency: {gene.efficiency}</span>
                </div>
                {status && (
                  <div className={`status-label ${status}`}>
                    {{
                      override: 'Override',
                      suppressed: 'Suppressed',
                      germline: 'Germline',
                      selected: '',
                    }[status] ?? status}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
