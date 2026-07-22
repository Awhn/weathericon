import { buildRecommendations } from './recommendations';

const conditions = (weather = {}, airQuality = {}) => ({
  weather: { apparentTemperatureC: 25, precipitationMm: 0, maxPrecipitationProbabilityNext3h: 39, maxUvIndexNext3h: 2.9, ...weather },
  airQuality: { pm25MicrogramsPerM3: 35, pm10MicrogramsPerM3: 80, ...airQuality },
});

test('activates recommendations at the documented weather boundaries', () => {
  const result = buildRecommendations(conditions({ maxPrecipitationProbabilityNext3h: 40, maxUvIndexNext3h: 3 }));
  expect(result.find(({ id }) => id === 'clothing').label).toBe('가벼운 반팔');
  expect(result.find(({ id }) => id === 'umbrella').active).toBe(true);
  expect(result.find(({ id }) => id === 'uv').active).toBe(true);
});

test('activates mask only above either air-quality threshold', () => {
  expect(buildRecommendations(conditions()).find(({ id }) => id === 'mask').active).toBe(false);
  expect(buildRecommendations(conditions({}, { pm25MicrogramsPerM3: 35.1 })).find(({ id }) => id === 'mask').active).toBe(true);
});
