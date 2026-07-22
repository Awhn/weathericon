import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { getConditions, searchPlaces } from './services/openMeteo';
import { buildRecommendations } from './domain/recommendations';

const routeMarker = '/city/';

const readPlaceRoute = () => {
  const markerIndex = window.location.pathname.indexOf(routeMarker);
  if (markerIndex < 0) return null;
  const parts = window.location.pathname.slice(markerIndex + routeMarker.length).split('/').map(decodeURIComponent);
  if (parts.length !== 4) return null;
  const [country, admin1, name, coordinates] = parts;
  const [latitude, longitude] = coordinates.split(',').map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { id: coordinates, country, admin1, name, latitude, longitude, timezone: 'auto' };
};

const basePath = () => {
  const markerIndex = window.location.pathname.indexOf(routeMarker);
  return markerIndex < 0 ? window.location.pathname.replace(/\/$/, '') : window.location.pathname.slice(0, markerIndex);
};

const placePath = (place) => `${basePath()}${routeMarker}${[place.country || '-', place.admin1 || '-', place.name, `${place.latitude},${place.longitude}`].map(encodeURIComponent).join('/')}`;

function App() {
  const initialPlace = readPlaceRoute();
  const [cityInput, setCityInput] = useState(initialPlace?.name || '');
  const [searchedCity, setSearchedCity] = useState('');
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(initialPlace);
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
      if (results.length === 1) {
        window.history.pushState({}, '', placePath(results[0]));
        setCityInput(results[0].name);
        setSelectedPlace(results[0]);
      } else setStatus('selecting');
    } catch (requestError) {
      setError(requestError.message || '도시 검색에 실패했습니다.');
      setStatus('error');
    }
  }, []);

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
    findCity(city);
  };

  const choosePlace = (place) => {
    window.history.pushState({}, '', placePath(place));
    setCityInput(place.name);
    setSelectedPlace(place);
  };

  return (
    <main className={`app-shell ${status === 'ready' ? 'has-result' : ''}`}>
      <header className="topbar">
        <a className="brand" href={`${basePath() || ''}/`} aria-label="Weather Icon 홈">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span>WEATHER ICON</span>
        </a>
        <span className="live-label"><i /> LIVE CONDITIONS</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        {status !== 'ready' && <><p className="eyebrow">TODAY / OUTDOOR</p><h1 id="page-title">오늘의<br /><strong>준비</strong></h1></>}

        <form className="search" onSubmit={submit}>
          <label className={status === 'ready' ? 'sr-only' : ''} htmlFor="city">도시 이름</label>
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
            {places.map((place) => <button key={place.id} onClick={() => choosePlace(place)}><strong>{place.name}</strong><span>{[place.admin1, place.country].filter(Boolean).join(', ')}</span><b aria-hidden="true">→</b></button>)}
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

      <div className="signal-charts" aria-label="날씨 신호와 준비물 임계값">
        <SignalChart recommendation={recommendations[0]} label="TEMP" value={weather.apparentTemperatureC} low={weather.minTemperatureC} high={weather.maxTemperatureC} unit="°" min={-10} max={40} thresholds={[{ value: 12, label: '12°' }, { value: 25, label: '25°' }]} />
        <SignalChart recommendation={recommendations[2]} label="UV" value={weather.uvIndexNow} low={weather.minUvIndexNext3h} high={weather.maxUvIndexNext3h} unit="" min={0} max={11} thresholds={[{ value: 3, label: '3' }]} />
        <SignalChart recommendation={recommendations[1]} label="RAIN" value={weather.precipitationProbabilityNow} low={weather.minPrecipitationProbabilityNext3h} high={weather.maxPrecipitationProbabilityNext3h} unit="%" min={0} max={100} thresholds={[{ value: 40, label: '40%' }]} />
        <SignalChart recommendation={recommendations[3]} label="PM2.5" value={airQuality.pm25MicrogramsPerM3} low={airQuality.minPm25Next3h} high={airQuality.maxPm25Next3h} unit="" min={0} max={100} thresholds={[{ value: 35, label: '35' }]} suffix="µg/m³" />
        <SignalChart label="WIND" value={weather.windSpeedKmh} low={weather.minWindSpeedKmh} high={weather.maxWindSpeedKmh} unit="" min={0} max={60} thresholds={[]} suffix="km/h" />
      </div>

      {warnings.length > 0 && <p className="warning">일부 정보 누락: {warnings.join(' · ')}</p>}
      <p className="timestamp">{new Date(data.reportedAt).toLocaleString('ko-KR', data.timezone && data.timezone !== 'auto' ? { timeZone: data.timezone } : undefined)}</p>
    </section>
  );
}

function SignalChart({ label, value, low, high, unit, min, max, thresholds, suffix, recommendation }) {
  const position = (point) => `${Math.max(0, Math.min(100, ((point - min) / (max - min)) * 100))}%`;
  return (
    <article className="signal-chart">
      <div className="chart-value"><span>{label}</span><strong>{format(value, unit)}</strong>{suffix && <small>{suffix}</small>}</div>
      <div className="chart-track" role="img" aria-label={`${label} 현재 ${format(value, unit)}, 최저 ${format(low, unit)}, 최고 ${format(high, unit)}, 임계값 ${thresholds.map(({ label: thresholdLabel }) => thresholdLabel).join(', ') || '없음'}`}>
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

const format = (value, unit) => value == null ? '—' : `${Math.round(value * 10) / 10}${unit}`;

export default App;
