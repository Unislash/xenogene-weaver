import { useBuildStore } from '../store';
import './Stats.css';

export const Stats = () => {
  const totals = useBuildStore(state => state.totals);
  const compatibleXenogerm = useBuildStore(state => state.compatibleXenogerm);
  const finalWarning = totals.efficiency <= -5;
  const xenoWarning = totals.xenogermEfficiency <= -5;

  return (
    <div className="stats-panel">
      <div className="stat-item info"
        title="Total metabolic efficiency contributed by xenogerm genes alone. You can't create the xenogerm if this is less than -5."
      >
        <span className="label">
          Xenogerm Efficiency*:
        </span>
        <span className={xenoWarning ? 'warning' : ''}>{totals.xenogermEfficiency}</span>
      </div>
      <div className="stat-item info"
        title="Total metabolic efficiency after combining germline genes, suppressed genes, and xenogenes. You can't implant the xenogerm if this is less than -5."
      >
        <span className="label">
          Final Efficiency*:
        </span>
        <span className={finalWarning ? 'warning' : ''}>{totals.efficiency}</span>
      </div>
      <div className="stat-item">
        <label>Complexity:</label>
        <span>{totals.complexity}</span>
      </div>
      <div className="status">
        <span
          className={compatibleXenogerm ? 'good' : 'error'}
          title={compatibleXenogerm ? 'You can implant this xenogerm into the target germline.' : 'The metabolic efficiency is too low to implant this xenogerm.'}
        >
          {compatibleXenogerm ? 'Implantation Compatible' : 'Metabolic Efficiency too low to Implant'}
        </span>
      </div>
    </div>
  );
}
