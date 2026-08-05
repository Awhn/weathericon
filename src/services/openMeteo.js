const endpoints = {
  geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
  forecast: 'https://api.open-meteo.com/v1/forecast',
  airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
};

async function request(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`외부 데이터 요청이 실패했습니다 (${response.status}).`);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchPlaces(city) {
  const params = new URLSearchParams({ name: city, count: '20', language: 'ko', format: 'json' });
  const payload = await request(`${endpoints.geocoding}?${params}`);
  return rankPlacesBySimilarity(city, payload.results || []).slice(0, 5).map((place) => ({
    id: `${place.latitude},${place.longitude}`,
    name: place.name,
    admin1: place.admin1 || '',
    country: place.country || '',
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || 'auto',
  }));
}

export function rankPlacesBySimilarity(query, places) {
  const normalizedQuery = normalizeSearchText(query);
  return [...places]
    .map((place, index) => ({ ...place, similarityScore: placeSimilarityScore(normalizedQuery, place), originalIndex: index }))
    .filter((place) => place.similarityScore >= 0.5)
    .sort((first, second) => second.similarityScore - first.similarityScore || first.originalIndex - second.originalIndex);
}

function placeSimilarityScore(normalizedQuery, place) {
  const fields = [place.name, place.admin1, place.country].filter(Boolean).map(normalizeSearchText);
  return Math.max(...fields.map((field) => stringSimilarity(normalizedQuery, field)), 0);
}

function normalizeSearchText(value = '') {
  return value.toString().normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function stringSimilarity(query, candidate) {
  if (!query || !candidate) return 0;
  if (candidate === query) return 1;
  if (candidate.startsWith(query)) return 0.92;
  if (candidate.includes(query)) return 0.82;
  if (query.includes(candidate)) return 0.74;
  const distance = levenshteinDistance(query, candidate);
  const maxLength = Math.max(query.length, candidate.length);
  return maxLength ? 1 - distance / maxLength : 0;
}

function levenshteinDistance(first, second) {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let i = 1; i <= first.length; i += 1) {
    let lastDiagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= second.length; j += 1) {
      const substitute = lastDiagonal + (first[i - 1] === second[j - 1] ? 0 : 1);
      lastDiagonal = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, substitute);
    }
  }
  return previous[second.length];
}

export async function getConditions(place) {
  const base = { latitude: String(place.latitude), longitude: String(place.longitude), timezone: place.timezone };
  const forecastParams = new URLSearchParams({ ...base, current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m', hourly: 'precipitation_probability,uv_index,wind_speed_10m', daily: 'temperature_2m_max,temperature_2m_min', forecast_days: '1' });
  const airParams = new URLSearchParams({ ...base, current: 'pm2_5,pm10', hourly: 'pm2_5' });
  const [forecastResult, airResult] = await Promise.allSettled([
    request(`${endpoints.forecast}?${forecastParams}`),
    request(`${endpoints.airQuality}?${airParams}`),
  ]);

  if (forecastResult.status === 'rejected' && airResult.status === 'rejected') throw new Error('날씨와 대기질 정보를 모두 불러오지 못했습니다.');
  const forecast = forecastResult.status === 'fulfilled' ? forecastResult.value : {};
  const air = airResult.status === 'fulfilled' ? airResult.value : {};
  const startIndex = findCurrentHourIndex(forecast.hourly?.time, forecast.current?.time);
  const airStartIndex = findCurrentHourIndex(air.hourly?.time, air.current?.time);
  const precipitationRange = windowRange(forecast.hourly?.precipitation_probability, startIndex);
  const uvRange = windowRange(forecast.hourly?.uv_index, startIndex);
  const pm25Range = windowRange(air.hourly?.pm2_5, airStartIndex);

  return {
    timezone: forecast.timezone || air.timezone || place.timezone,
    reportedAt: forecast.current?.time || air.current?.time || new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    dataKind: 'forecast',
    weather: {
      temperatureC: numberOrNull(forecast.current?.temperature_2m),
      apparentTemperatureC: numberOrNull(forecast.current?.apparent_temperature),
      precipitationMm: numberOrNull(forecast.current?.precipitation),
      weatherCode: numberOrNull(forecast.current?.weather_code),
      precipitationProbabilityNow: precipitationRange.current,
      minPrecipitationProbabilityNext3h: precipitationRange.min,
      maxPrecipitationProbabilityNext3h: precipitationRange.max,
      uvIndexNow: uvRange.current,
      minUvIndexNext3h: uvRange.min,
      maxUvIndexNext3h: uvRange.max,
      maxTemperatureC: numberOrNull(forecast.daily?.temperature_2m_max?.[0]),
      minTemperatureC: numberOrNull(forecast.daily?.temperature_2m_min?.[0]),
      maxWindSpeedKmh: maxValues(forecast.hourly?.wind_speed_10m),
      minWindSpeedKmh: minValues(forecast.hourly?.wind_speed_10m),
      windSpeedKmh: numberOrNull(forecast.current?.wind_speed_10m),
    },
    airQuality: {
      pm25MicrogramsPerM3: numberOrNull(air.current?.pm2_5),
      minPm25Next3h: pm25Range.min,
      maxPm25Next3h: pm25Range.max,
      pm10MicrogramsPerM3: numberOrNull(air.current?.pm10),
    },
    warnings: [forecastResult.status === 'rejected' && '날씨', airResult.status === 'rejected' && '대기질'].filter(Boolean),
  };
}

function findCurrentHourIndex(times = [], currentTime) {
  if (!currentTime) return 0;
  const hour = currentTime.slice(0, 13);
  const index = times.findIndex((time) => time.startsWith(hour));
  return index < 0 ? 0 : index;
}

function windowRange(values = [], start = 0) {
  const usable = values.slice(start, start + 3).filter((value) => Number.isFinite(value));
  return {
    current: usable[0] ?? null,
    min: usable.length ? Math.min(...usable) : null,
    max: usable.length ? Math.max(...usable) : null,
  };
}

function maxValues(values = []) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? Math.max(...usable) : null;
}

function minValues(values = []) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? Math.min(...usable) : null;
}

const numberOrNull = (value) => Number.isFinite(value) ? value : null;
