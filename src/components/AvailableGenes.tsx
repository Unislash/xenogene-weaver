import { useMemo, useState } from 'react';
import { useBuildStore } from '../store';
import { Gene } from '../types';
import { genesConflict } from '../utils/geneConflicts';
import { getGeneImage } from '../images';
import './AvailableGenes.css';

export const AvailableGenes = () => {
  const genesById = useBuildStore(s => s.allGenesById);
  const selectedXeno = useBuildStore(s => s.selectedXeno);
  const selectedGermline = useBuildStore(s => s.selectedGermline);
  const germlinesById = useBuildStore(s => s.germlinesById);
  const suppressedGermlineGenes = useBuildStore(s => s.suppressedGermlineGenes);
  const conflictingXenoGenes = useBuildStore(s => s.conflictingXenoGenes);
  const overrideGenes = useBuildStore(s => s.overrideGenes);
  const toggleXenoGene = useBuildStore(s => s.toggleXenoGene);
  const [searchTerm, setSearchTerm] = useState('');

  const genes = Object.values(genesById);
  const filteredGenes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return genes;
    return genes.filter(gene => gene.name.toLowerCase().includes(query));
  }, [genes, searchTerm]);

  const isGermlineMember = (geneId: string) => {
    if (!selectedGermline) return false;
    const g = germlinesById[selectedGermline];
    return g?.genes.includes(geneId) ?? false;
  };

  const conflictsWithSelectedGene = (gene: Gene) => {
    for (const selectedId of selectedXeno) {
      if (selectedId === gene.id) continue;
      const selectedGene = genesById[selectedId];
      if (genesConflict(gene, selectedGene)) return true;
    }
    return false;
  };

  const getStatusLabel = ({
    isSelected,
    isGermline,
    isSuppressed,
    isOverride,
    hasConflictWarning,
  }: {
    isSelected: boolean;
    isGermline: boolean;
    isSuppressed: boolean;
    isOverride: boolean;
    hasConflictWarning: boolean;
  }) => {
    if (isOverride) return 'override';
    if (isSuppressed) return 'suppressed';
    if (isGermline) return 'germline';
    if (isSelected) return 'selected';
    if (hasConflictWarning) return 'suppressed';
    return '';
  };

  return (
    <section className="available-genes">
      <div className="available-genes__header">
        <h2>Available Genes</h2>
        <input
          type="search"
          className="available-genes__search"
          placeholder="Search genes"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="gene-grid">
        {filteredGenes.map(gene => {
          const isSelected = selectedXeno.has(gene.id);
          const isGermline = isGermlineMember(gene.id);
          const germlineSuppressed = suppressedGermlineGenes.has(gene.id);
          const conflictSuppressed = isSelected && conflictingXenoGenes.has(gene.id);
          const isSuppressed = isGermline ? germlineSuppressed : conflictSuppressed;
          const hasConflictWarning = !isSelected && conflictsWithSelectedGene(gene);
          const isOverride = overrideGenes.has(gene.id);
          const visuallySuppressed = isSuppressed || hasConflictWarning;
          const classNames = [
            'gene-card',
            'clickable',
            isGermline && 'germline',
            isSelected && 'selected',
            gene.capsules && 'archite',
            visuallySuppressed && 'suppressed',
          ]
            .filter(Boolean)
            .join(' ');
          const status = getStatusLabel({
            isSelected,
            isGermline,
            isSuppressed: visuallySuppressed,
            isOverride,
            hasConflictWarning,
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
