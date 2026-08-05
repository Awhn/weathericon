import { rankPlacesBySimilarity } from './openMeteo';

test('ranks places by fuzzy similarity across city and region names', () => {
  const ranked = rankPlacesBySimilarity('seoul', [
    { name: 'Busan', admin1: 'Busan', country: 'South Korea' },
    { name: 'Seoul', admin1: 'Seoul', country: 'South Korea' },
    { name: 'Incheon', admin1: 'Seoul Capital Area', country: 'South Korea' },
  ]);

  expect(ranked.map((place) => place.name)).toEqual(['Seoul', 'Incheon']);
});
