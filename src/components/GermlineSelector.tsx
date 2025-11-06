import { useEffect } from 'react';
import { useBuildStore } from '../store';
import './GermlineSelector.css';

export function GermlineSelector() {
  const germlinesById = useBuildStore(s => s.germlinesById);
  const selectedGermline = useBuildStore(s => s.selectedGermline);
  const selectGermline = useBuildStore(s => s.selectGermline);

  const germlines = Object.values(germlinesById);

  return (
    <section className="germline-selector">
      <h2>Select A Germline</h2>
      <div className="gene-chips">
        {germlines.map(g => (
          <button
            key={g.name}
            className={`gene-chip ${selectedGermline === g.name ? 'selected' : ''}`}
            onClick={() => selectGermline(selectedGermline === g.name ? null : g.name)}
          >
            <div className="name">{g.name}</div>
          </button>
        ))}
      </div>
    </section>
  );
}