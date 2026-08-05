import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { getConditions, searchPlaces } from './services/openMeteo';
import { buildRecommendations } from './domain/recommendations';
import SignalChart from './components/SignalChart';

const routeMarker = '/city/';

const readPlaceRoute = () => {
  const markerIndex = window.location.pathname.indexOf(routeMarker);
  if (markerIndex < 0) return null;
  const parts = window.location.pathname.slice(markerIndex + routeMarker.length).split('/').map(safeDecodeURIComponent);
  if (parts.length < 4) return null;
  const [country, admin1, name, coordinates] = parts;
  const [latitude, longitude] = coordinates.split(',').map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { id: coordinates, country: restoreRouteValue(country), admin1: restoreRouteValue(admin1), name, latitude, longitude, timezone: 'auto' };
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
    findCity(cityInput);
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
        <span className="data-label">FORECAST DATA</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        {status !== 'ready' && <h1 id="page-title">오늘의<br /><strong>준비</strong></h1>}

        <form className="search" onSubmit={submit}>
          <label className={status === 'ready' ? 'sr-only' : ''} htmlFor="city">도시 이름</label>
          <div className="search-control">
            <input id="city" value={cityInput} onChange={(event) => setCityInput(event.target.value)} placeholder="서울, Busan, New York..." maxLength="100" />
            <button type="submit">확인 <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>

      {status === 'searching' && <section className="status-card" aria-live="polite"><span className="spinner" /> 도시를 찾는 중입니다</section>}
      {status === 'loading' && <LoadingDashboard place={selectedPlace} />}

      {status === 'selecting' && (
        <section className="places" aria-labelledby="places-title">
          <div><h2 id="places-title">어느 도시인가요?</h2></div>
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
          {[['☂', 'RAIN'], ['☀', 'UV'], ['◌', 'PM2.5'], ['♨', 'TEMP']].map(([icon, label]) => <div key={label}><span aria-hidden="true">{icon}</span><strong>{label}</strong></div>)}
        </section>
      )}

      <footer><span>DATA BY OPEN-METEO</span><span>FORECAST-BASED GUIDANCE · NOT A SAFETY ALERT</span></footer>
    </main>
  );
}

function Dashboard({ place, data }) {
  const { weather, airQuality, recommendations, warnings } = data;
  const activeRecommendations = useMemo(() => recommendations.filter((recommendation) => recommendation.active), [recommendations]);
  const summaryItems = activeRecommendations.length ? activeRecommendations : [recommendations[0]].filter(Boolean);

  return (
    <section className="dashboard" aria-labelledby="result-title">
      <div className="readiness-summary" aria-label="오늘의 준비물 요약">
        {summaryItems.map((recommendation) => <div key={recommendation.id} className="ready-box"><span aria-hidden="true">{recommendation.icon}</span><strong>{recommendation.label}</strong><b>{recommendation.active ? 'ON' : 'OFF'}</b></div>)}
      </div>

      <div className="result-heading">
        <div><h2 id="result-title">{place.name} <span className="weather-emoji" aria-label={weatherEmojiLabel(weather.weatherCode)}>{weatherEmoji(weather.weatherCode)}</span><span>{[place.admin1, place.country].filter(Boolean).join(', ')}</span></h2></div>
        <div className="temperature"><strong>{format(weather.temperatureC, '°')}</strong><span>현재 기온 · 체감 {format(weather.apparentTemperatureC, '°')}</span></div>
      </div>

      <div className="signal-charts" aria-label="날씨 상세 신호">
        <SignalChart recommendation={recommendations[0]} label="TEMP" value={weather.temperatureC} low={weather.minTemperatureC} high={weather.maxTemperatureC} unit="°" min={-10} max={40} />
        <SignalChart recommendation={recommendations[2]} label="UV" value={weather.uvIndexNow} low={weather.minUvIndexNext3h} high={weather.maxUvIndexNext3h} unit="" min={0} max={11} />
        <SignalChart recommendation={recommendations[1]} label="RAIN" value={weather.precipitationProbabilityNow} low={weather.minPrecipitationProbabilityNext3h} high={weather.maxPrecipitationProbabilityNext3h} unit="%" min={0} max={100} />
        <SignalChart recommendation={recommendations[3]} label="PM2.5" value={airQuality.pm25MicrogramsPerM3} low={airQuality.minPm25Next3h} high={airQuality.maxPm25Next3h} unit="" min={0} max={100} suffix="µg/m³" />
        <SignalChart label="WIND" value={weather.windSpeedKmh} low={weather.minWindSpeedKmh} high={weather.maxWindSpeedKmh} unit="" min={0} max={60} suffix="km/h" />
      </div>

      {warnings.length > 0 && <p className="warning">일부 정보 누락: {warnings.join(' · ')}</p>}
      <p className="timestamp">{new Date(data.reportedAt).toLocaleString('ko-KR', data.timezone && data.timezone !== 'auto' ? { timeZone: data.timezone } : undefined)} 업데이트 · Open-Meteo forecast</p>
    </section>
  );
}

function LoadingDashboard({ place }) {
  return (
    <section className="dashboard loading-dashboard" aria-live="polite" aria-label="날씨 분석 중">
      <div className="readiness-summary"><div className="ready-box skeleton"><span /></div><div className="ready-box skeleton"><span /></div></div>
      <div className="result-heading"><div><h2>{place?.name || '도시'} <span className="weather-emoji" aria-hidden="true">⛅</span><span>{[place?.admin1, place?.country].filter(Boolean).join(', ') || '날씨 분석 중'}</span></h2></div><div className="temperature skeleton"><strong>--°</strong><span>현재 기온</span></div></div>
      <div className="signal-charts">{['TEMP', 'UV', 'RAIN', 'PM2.5', 'WIND'].map((label) => <div className="signal-chart skeleton-row" key={label}><div className="chart-value"><span>{label}</span><strong>—</strong></div><div className="chart-track" /><div className="chart-ready"><strong>분석 중</strong><b>—</b></div></div>)}</div>
    </section>
  );
}

const routePlaceholder = '-';
const restoreRouteValue = (value) => value === routePlaceholder ? '' : value;
const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const weatherEmoji = (code) => {
  if (code == null) return '⛅';
  if (code === 0) return '☀️';
  if ([1, 2, 3].includes(code)) return '⛅';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '⛅';
};

const weatherEmojiLabel = (code) => {
  if (code == null) return '날씨 정보';
  if (code === 0) return '맑음';
  if ([1, 2, 3].includes(code)) return '구름';
  if ([45, 48].includes(code)) return '안개';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '비';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '눈';
  if ([95, 96, 99].includes(code)) return '뇌우';
  return '날씨 정보';
};

const format = (value, unit) => value == null ? '—' : `${Math.round(value * 10) / 10}${unit}`;

export default App;
