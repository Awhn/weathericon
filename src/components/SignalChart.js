const format = (value, unit) => value == null ? '—' : `${Math.round(value * 10) / 10}${unit}`;

function SignalChart({ label, value, low, high, unit, min, max, thresholds, suffix, recommendation }) {
  const position = (point) => `${Math.max(0, Math.min(100, ((point - min) / (max - min)) * 100))}%`;
  const thresholdSummary = thresholds.map(({ label: thresholdLabel }) => thresholdLabel).join(', ') || '없음';

  return (
    <article className="signal-chart">
      <div className="chart-value"><span>{label}</span><strong>{format(value, unit)}</strong>{suffix && <small>{suffix}</small>}</div>
      <div className="chart-track" role="img" aria-label={`${label} 현재 ${format(value, unit)}, 최저 ${format(low, unit)}, 최고 ${format(high, unit)}, 임계값 ${thresholdSummary}`}>
        <i className="chart-fill" style={{ width: value == null ? 0 : position(value) }} />
        {thresholds.map((threshold) => <span className="threshold" key={threshold.label} style={{ left: position(threshold.value) }}><b>{threshold.label}</b></span>)}
        {low != null && <span className="range-point low-point" style={{ left: position(low) }}><b>최저 {format(low, unit)}</b></span>}
        {high != null && <span className="range-point high-point" style={{ left: position(high) }}><b>최고 {format(high, unit)}</b></span>}
        {value != null && <span className="current-point" style={{ left: position(value) }}><b>현재</b></span>}
      </div>
      <div className="chart-range"><span>{min}</span><span>{max}</span></div>
      {recommendation && <div className={`chart-ready ${recommendation.active ? 'active' : ''}`} title={recommendation.reason}><span aria-hidden="true">{recommendation.icon}</span><strong>{recommendation.label}</strong><b>{recommendation.active ? 'ON' : 'OFF'}</b><i className="sr-only">{recommendation.reason}</i></div>}
    </article>
  );
}

export default SignalChart;
