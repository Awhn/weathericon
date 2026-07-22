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
  const params = new URLSearchParams({ name: city, count: '5', language: 'ko', format: 'json' });
  const payload = await request(`${endpoints.geocoding}?${params}`);
  return (payload.results || []).map((place) => ({
    id: `${place.latitude},${place.longitude}`,
    name: place.name,
    admin1: place.admin1 || '',
    country: place.country || '',
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || 'auto',
  }));
}

export async function getConditions(place) {
  const base = { latitude: String(place.latitude), longitude: String(place.longitude), timezone: place.timezone };
  const forecastParams = new URLSearchParams({ ...base, current: 'temperature_2m,apparent_temperature,precipitation', hourly: 'precipitation_probability,uv_index', forecast_days: '1' });
  const airParams = new URLSearchParams({ ...base, current: 'pm2_5,pm10' });
  const [forecastResult, airResult] = await Promise.allSettled([
    request(`${endpoints.forecast}?${forecastParams}`),
    request(`${endpoints.airQuality}?${airParams}`),
  ]);

  if (forecastResult.status === 'rejected' && airResult.status === 'rejected') throw new Error('날씨와 대기질 정보를 모두 불러오지 못했습니다.');
  const forecast = forecastResult.status === 'fulfilled' ? forecastResult.value : {};
  const air = airResult.status === 'fulfilled' ? airResult.value : {};
  const startIndex = findCurrentHourIndex(forecast.hourly?.time, forecast.current?.time);

  return {
    reportedAt: forecast.current?.time || air.current?.time || new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    dataKind: 'forecast',
    weather: {
      temperatureC: numberOrNull(forecast.current?.temperature_2m),
      apparentTemperatureC: numberOrNull(forecast.current?.apparent_temperature),
      precipitationMm: numberOrNull(forecast.current?.precipitation),
      maxPrecipitationProbabilityNext3h: maxWindow(forecast.hourly?.precipitation_probability, startIndex),
      maxUvIndexNext3h: maxWindow(forecast.hourly?.uv_index, startIndex),
    },
    airQuality: {
      pm25MicrogramsPerM3: numberOrNull(air.current?.pm2_5),
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

function maxWindow(values = [], start = 0) {
  const usable = values.slice(start, start + 3).filter((value) => Number.isFinite(value));
  return usable.length ? Math.max(...usable) : null;
}

const numberOrNull = (value) => Number.isFinite(value) ? value : null;
