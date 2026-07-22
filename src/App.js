import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { getConditions, searchPlaces } from './services/openMeteo';
import { buildRecommendations } from './domain/recommendations';

const readCity = () => new URLSearchParams(window.location.search).get('city')?.trim() || '';

function App() {
  const [cityInput, setCityInput] = useState(readCity);
  const [searchedCity, setSearchedCity] = useState('');
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [conditions, setConditions] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const findCity = useCallback(async (rawCity) => {
    const city = rawCity.trim().replace(/\s+/g, ' ');
    if (!city || city.length > 100) {
      setError('도시 이름을 1자 이상 100자 이하로 입력해 주세요.');
      setStatus('error');
      return;
    }

    setStatus('searching');
    setError('');
    setConditions(null);
    setSelectedPlace(null);
    setPlaces([]);
    setSearchedCity(city);

    try {
      const results = await searchPlaces(city);
      if (!results.length) {
        throw new Error(`“${city}”에 해당하는 도시를 찾지 못했습니다.`);
      }
      setPlaces(results);
      if (results.length === 1) setSelectedPlace(results[0]);
      else setStatus('selecting');
    } catch (requestError) {
      setError(requestError.message || '도시 검색에 실패했습니다.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const initialCity = readCity();
    if (initialCity) findCity(initialCity);
  }, [findCity]);

  useEffect(() => {
    if (!selectedPlace) return;
    let active = true;

    const load = async () => {
      setStatus('loading');
      setError('');
      try {
        const data = await getConditions(selectedPlace);
        if (active) {
          setConditions({ ...data, recommendations: buildRecommendations(data) });
          setStatus('ready');
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || '날씨 정보를 불러오지 못했습니다.');
          setStatus('error');
        }
      }
    };

    load();
    return () => { active = false; };
  }, [selectedPlace]);

  const submit = (event) => {
    event.preventDefault();
    const city = cityInput.trim().replace(/\s+/g, ' ');
    const url = new URL(window.location.href);
    if (city) url.searchParams.set('city', city);
    else url.searchParams.delete('city');
    window.history.pushState({}, '', url);
    findCity(city);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href={process.env.PUBLIC_URL || './'} aria-label="Weather Icon 홈">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span>WEATHER ICON</span>
        </a>
        <span className="live-label"><i /> LIVE CONDITIONS</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">TODAY / OUTDOOR</p>
        <h1 id="page-title">오늘의<br /><strong>준비</strong></h1>

        <form className="search" onSubmit={submit}>
          <label htmlFor="city">도시 이름</label>
          <div className="search-control">
            <span aria-hidden="true">⌖</span>
            <input id="city" value={cityInput} onChange={(event) => setCityInput(event.target.value)} placeholder="서울, Busan, New York..." maxLength="100" />
            <button type="submit">확인 <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>

      {(status === 'searching' || status === 'loading') && (
        <section className="status-card" aria-live="polite"><span className="spinner" /> {status === 'searching' ? '도시를 찾는 중입니다' : '날씨 신호를 분석하는 중입니다'}</section>
      )}

      {status === 'selecting' && (
        <section className="places" aria-labelledby="places-title">
          <div><p className="section-number">01 / LOCATION</p><h2 id="places-title">어느 도시인가요?</h2></div>
          <div className="place-list">
            {places.map((place) => <button key={place.id} onClick={() => setSelectedPlace(place)}><strong>{place.name}</strong><span>{[place.admin1, place.country].filter(Boolean).join(', ')}</span><b aria-hidden="true">→</b></button>)}
          </div>
        </section>
      )}

      {status === 'error' && (
        <section className="error-card" role="alert"><span aria-hidden="true">!</span><div><strong>확인할 수 없습니다</strong><p>{error}</p></div><button onClick={() => findCity(searchedCity || cityInput)}>다시 시도</button></section>
      )}

      {status === 'ready' && conditions && <Dashboard place={selectedPlace} data={conditions} />}

      {status === 'idle' && (
        <section className="signal-preview" aria-label="분석 항목">
          {[['01', '☂', 'RAIN'], ['02', '☀', 'UV'], ['03', '◌', 'AIR'], ['04', '♨', 'TEMP']].map(([number, icon, label]) => <div key={number}><small>{number}</small><span aria-hidden="true">{icon}</span><strong>{label}</strong></div>)}
        </section>
      )}

      <footer><span>DATA BY OPEN-METEO</span><span>FORECAST-BASED GUIDANCE · NOT A SAFETY ALERT</span></footer>
    </main>
  );
}

function Dashboard({ place, data }) {
  const { weather, airQuality, recommendations, warnings } = data;
  return (
    <section className="dashboard" aria-labelledby="result-title">
      <div className="result-heading">
        <div><p className="section-number">02 / READINESS</p><h2 id="result-title">{place.name}<span>{[place.admin1, place.country].filter(Boolean).join(', ')}</span></h2></div>
        <div className="temperature"><strong>{format(weather.apparentTemperatureC, '°')}</strong><span>체감온도</span></div>
      </div>

      <div className="recommendation-grid" aria-label="준비물 추천">
        {recommendations.map((item) => <article key={item.id} className={`recommendation ${item.active ? 'active' : ''}`} title={item.reason}><span className="recommendation-icon" aria-hidden="true">{item.icon}</span><div><small>{item.category}</small><h3>{item.label}</h3></div><b>{item.active ? 'ON' : '—'}</b><span className="sr-only">{item.reason}</span></article>)}
      </div>

      <div className="signal-charts" aria-label="날씨 신호와 준비물 임계값">
        <SignalChart label="TEMP" value={weather.apparentTemperatureC} unit="°" min={-10} max={40} thresholds={[{ value: 12, label: 'OUTER 12°' }, { value: 25, label: 'T-SHIRT 25°' }]} />
        <SignalChart label="UV" value={weather.maxUvIndexNext3h} unit="" min={0} max={11} thresholds={[{ value: 3, label: 'SUN 3' }]} />
        <SignalChart label="RAIN" value={weather.maxPrecipitationProbabilityNext3h} unit="%" min={0} max={100} thresholds={[{ value: 40, label: 'UMBRELLA 40%' }]} />
        <SignalChart label="PM2.5" value={airQuality.pm25MicrogramsPerM3} unit="" min={0} max={100} thresholds={[{ value: 35, label: 'MASK 35' }]} suffix="µg/m³" />
      </div>

      {warnings.length > 0 && <p className="warning">일부 정보 누락: {warnings.join(' · ')}</p>}
      <p className="timestamp">예보 기준 {new Date(data.reportedAt).toLocaleString('ko-KR', { timeZone: place.timezone })} · 방금 갱신</p>
    </section>
  );
}

function SignalChart({ label, value, unit, min, max, thresholds, suffix }) {
  const position = (point) => `${Math.max(0, Math.min(100, ((point - min) / (max - min)) * 100))}%`;
  return (
    <article className="signal-chart">
      <div className="chart-value"><span>{label}</span><strong>{format(value, unit)}</strong>{suffix && <small>{suffix}</small>}</div>
      <div className="chart-track" role="img" aria-label={`${label} ${format(value, unit)}, 임계값 ${thresholds.map(({ label: thresholdLabel }) => thresholdLabel).join(', ')}`}>
        <i className="chart-fill" style={{ width: value == null ? 0 : position(value) }} />
        {thresholds.map((threshold) => <span className="threshold" key={threshold.label} style={{ left: position(threshold.value) }}><b>{threshold.label}</b></span>)}
        {value != null && <span className="current-point" style={{ left: position(value) }} />}
      </div>
      <div className="chart-range"><span>{min}</span><span>{max}</span></div>
    </article>
  );
}

const format = (value, unit) => value == null ? '—' : `${Math.round(value * 10) / 10}${unit}`;

export default App;
