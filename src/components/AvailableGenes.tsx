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
  const suppressedGermlineGenesByXeno = useBuildStore(s => s.suppressedGermlineGenesByXeno);
  const conflictingXenoGenesGroups = useBuildStore(s => s.conflictingXenoGenesGroups);
  const overrideGenes = useBuildStore(s => s.overrideGenes);
  const toggleXenoGene = useBuildStore(s => s.toggleXenoGene);
  const [searchTerm, setSearchTerm] = useState('');

  const genes = Object.values(genesById);
  const filteredGenes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return genes;
    return genes.filter(gene => gene.name.toLowerCase().includes(query));
  }, [genes, searchTerm]);

  const suppressedSet = useMemo(() => {
    const combined = new Set<string>();
    for (const suppressed of suppressedGermlineGenesByXeno.values()) {
      for (const id of suppressed) combined.add(id);
    }
    return combined;
  }, [suppressedGermlineGenesByXeno]);

  const conflictingSet = useMemo(() => {
    const combined = new Set<string>();
    for (const group of conflictingXenoGenesGroups) {
      for (const id of group) combined.add(id);
    }
    return combined;
  }, [conflictingXenoGenesGroups]);

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
    isGermline,
    isSuppressed,
    isOverride,
    isConflicted,
  }: {
    isGermline: boolean;
    isSuppressed: boolean;
    isOverride: boolean;
    isConflicted: boolean;
  }) => {
    if (isOverride) return 'override';
    if (isSuppressed) return 'suppressed';
    if (isGermline) return 'germline';
    if (isConflicted) return 'conflicts';
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
          const isSuppressed = conflictingSet.has(gene.id) && !overrideGenes.has(gene.id);
          const isConflicted = !isSelected && (conflictsWithSelectedGene(gene) || isGermline && suppressedSet.has(gene.id));
          const isOverride = overrideGenes.has(gene.id);
          const classNames = [
            'gene-card',
            'clickable',
            isSelected && 'selected',
            gene.capsules && 'archite',
            isSuppressed && 'suppressed',
          ]
            .filter(Boolean)
            .join(' ');
          const status = getStatusLabel({
            isSelected,
            isGermline,
            isSuppressed,
            isOverride,
            isConflicted,
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
