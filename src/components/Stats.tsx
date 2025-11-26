import { useBuildStore } from '../store';
import './Stats.css';

export const Stats = () => {
  const totals = useBuildStore(state => state.totals);
  const compatibleXenogerm = useBuildStore(state => state.compatibleXenogerm);
  const finalWarning = totals.efficiency <= -5;
  const xenoWarning = totals.xenogermEfficiency <= -5;

  return (
    <div className="stats-panel">
      <div className="stat-item">
        <label>Xenogerm Efficiency:</label>
        <span className={xenoWarning ? 'warning' : ''}>{totals.xenogermEfficiency}</span>
      </div>
      <div className="stat-item">
        <label>Final Efficiency:</label>
        <span className={finalWarning ? 'warning' : ''}>{totals.efficiency}</span>
      </div>
      <div className="stat-item">
        <label>Complexity:</label>
        <span>{totals.complexity}</span>
      </div>
      <div className="status">
        <span className={compatibleXenogerm ? 'good' : 'error'}>
          {compatibleXenogerm ? 'Compatible' : 'Metabolic Efficiency too low'}
        </span>
      </div>
    </div>
  );
}
