const format = (value, unit) => value == null ? '—' : `${Math.round(value * 10) / 10}${unit}`;

function SignalChart({ label, value, low, high, unit, min, max, suffix, recommendation }) {
  const position = (point) => `${Math.max(0, Math.min(100, ((point - min) / (max - min)) * 100))}%`;

  return (
    <article className="signal-chart">
      <div className="chart-value"><span>{label}</span><strong>{format(value, unit)}</strong>{suffix && <small>{suffix}</small>}</div>
      <div className="chart-track" role="img" aria-label={`${label} 최저 ${format(low, unit)}, 현재 ${format(value, unit)}, 최고 ${format(high, unit)}`}>
        {low != null && <span className="range-point low-point" style={{ left: position(low) }}><b>최저 {format(low, unit)}</b></span>}
        {high != null && <span className="range-point high-point" style={{ left: position(high) }}><b>최고 {format(high, unit)}</b></span>}
        {value != null && <span className="current-point" style={{ left: position(value) }}><b>현재 {format(value, unit)}</b></span>}
      </div>
      <div className={`chart-ready ${recommendation?.active ? 'active' : ''}`} title={recommendation?.reason || ''}>{recommendation ? <><span aria-hidden="true">{recommendation.icon}</span><strong>{recommendation.label}</strong><b>{recommendation.active ? 'ON' : 'OFF'}</b><i className="sr-only">{recommendation.reason}</i></> : <><strong>WIND</strong><b>—</b></>}</div>
    </article>
  );
}

export default SignalChart;
