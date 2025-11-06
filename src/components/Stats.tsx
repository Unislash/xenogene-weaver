import { useBuildStore } from '../store';
import './Stats.css';

export function Stats() {
  const totals = useBuildStore(state => state.totals);
  const compatibleXenogerm = useBuildStore(state => state.compatibleXenogerm);

  return (
    <div className="stats-panel">
      <div className="stat-item">
        <label>Efficiency:</label>
        <span className={totals.efficiency < -4 ? 'warning' : ''}>{totals.efficiency}</span>
      </div>
      <div className="stat-item">
        <label>Complexity:</label>
        <span>{totals.complexity}</span>
      </div>
      <div className="status">
        <span className={compatibleXenogerm ? 'good' : 'error'}>
          {compatibleXenogerm ? 'Compatible' : 'Incompatible'}
        </span>
      </div>
    </div>
  );
}