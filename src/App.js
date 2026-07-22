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
        <p className="eyebrow">OUTDOOR READINESS SYSTEM</p>
        <h1 id="page-title">오늘, 무엇을<br /><strong>준비할까요?</strong></h1>
        <p className="intro">도시를 입력하면 날씨와 대기질을 분석해<br />필요한 복장과 준비물을 알려드려요.</p>

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
          {[['01', '☂', '강수'], ['02', '☀', '자외선'], ['03', '◌', '대기질'], ['04', '♨', '체감온도']].map(([number, icon, label]) => <div key={number}><small>{number}</small><span aria-hidden="true">{icon}</span><strong>{label}</strong></div>)}
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

      <div className="recommendation-grid">
        {recommendations.map((item) => <article key={item.id} className={`recommendation ${item.active ? 'active' : ''}`}><span className="recommendation-icon" aria-hidden="true">{item.icon}</span><div><small>{item.category}</small><h3>{item.label}</h3><p>{item.reason}</p></div><b>{item.active ? 'ON' : '—'}</b></article>)}
      </div>

      <dl className="metrics">
        <div><dt>기온</dt><dd>{format(weather.temperatureC, '°C')}</dd></div>
        <div><dt>3시간 강수확률</dt><dd>{format(weather.maxPrecipitationProbabilityNext3h, '%')}</dd></div>
        <div><dt>UV 지수</dt><dd>{format(weather.maxUvIndexNext3h, '')}</dd></div>
        <div><dt>PM2.5</dt><dd>{format(airQuality.pm25MicrogramsPerM3, '')}<small> µg/m³</small></dd></div>
        <div><dt>PM10</dt><dd>{format(airQuality.pm10MicrogramsPerM3, '')}<small> µg/m³</small></dd></div>
      </dl>

      {warnings.length > 0 && <p className="warning">일부 정보 누락: {warnings.join(' · ')}</p>}
      <p className="timestamp">예보 기준 {new Date(data.reportedAt).toLocaleString('ko-KR', { timeZone: place.timezone })} · 방금 갱신</p>
    </section>
  );
}

const format = (value, unit) => value == null ? '—' : `${Math.round(value * 10) / 10}${unit}`;

export default App;
