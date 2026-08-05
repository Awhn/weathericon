import { rankPlacesBySimilarity, searchPlaces } from './openMeteo';

afterEach(() => {
  jest.restoreAllMocks();
});

test('ranks places by fuzzy similarity across city and region names', () => {
  const ranked = rankPlacesBySimilarity('seoul', [
    { name: 'Busan', admin1: 'Busan', country: 'South Korea' },
    { name: 'Seoul', admin1: 'Seoul', country: 'South Korea' },
    { name: 'Incheon', admin1: 'Seoul Capital Area', country: 'South Korea' },
  ]);

  expect(ranked.map((place) => place.name)).toEqual(['Seoul', 'Incheon']);
});

test('matches Seoul when searching with the Korean city name', () => {
  const ranked = rankPlacesBySimilarity('서울', [
    { name: 'Busan', admin1: 'Busan', country: 'South Korea' },
    { name: 'Seoul', admin1: 'Seoul', country: 'South Korea' },
  ]);

  expect(ranked.map((place) => place.name)).toEqual(['Seoul']);
});

test('searches Korean Seoul with a romanized fallback query', async () => {
  jest.spyOn(global, 'fetch').mockImplementation(async (url) => ({
    ok: true,
    json: async () => new URL(url).searchParams.get('name') === 'seoul' ? {
      results: [{ name: 'Seoul', admin1: 'Seoul', country: 'South Korea', latitude: 37.5665, longitude: 126.978, timezone: 'Asia/Seoul' }],
    } : { results: [] },
  }));

  const places = await searchPlaces('서울');

  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(global.fetch.mock.calls.map(([url]) => new URL(url).searchParams.get('name'))).toEqual(['서울', 'seoul']);
  expect(places).toEqual([{ id: '37.5665,126.978', name: 'Seoul', admin1: 'Seoul', country: 'South Korea', latitude: 37.5665, longitude: 126.978, timezone: 'Asia/Seoul' }]);
});
