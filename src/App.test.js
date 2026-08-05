import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { getConditions, searchPlaces } from './services/openMeteo';

jest.mock('./services/openMeteo', () => ({ searchPlaces: jest.fn(), getConditions: jest.fn() }));

test('renders the city search entry screen', () => {
  window.history.replaceState({}, '', '/');
  render(<App />);
  expect(screen.getByRole('heading', { name: /오늘의 준비/ })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '도시 이름' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /확인/ })).toBeInTheDocument();
});

test('uses actual temperature, readiness summary, and a unique region URI after selecting a city', async () => {
  window.history.replaceState({}, '', '/weathericon/');
  searchPlaces.mockResolvedValue([{ id: '37.5,127', name: '서울', admin1: '서울특별시', country: '대한민국', latitude: 37.5, longitude: 127, timezone: 'Asia/Seoul' }]);
  getConditions.mockResolvedValue({
    timezone: 'Asia/Seoul', reportedAt: '2026-07-22T12:00:00+09:00', warnings: [],
    weather: {
      temperatureC: 25,
      apparentTemperatureC: 40.8,
      precipitationMm: 0,
      weatherCode: 61,
      precipitationProbabilityNow: 10,
      maxPrecipitationProbabilityNext3h: 10,
      minPrecipitationProbabilityNext3h: 0,
      uvIndexNow: 2,
      maxUvIndexNext3h: 2,
      minUvIndexNext3h: 1,
      minTemperatureC: 20,
      maxTemperatureC: 29,
      windSpeedKmh: 4,
      minWindSpeedKmh: 2,
      maxWindSpeedKmh: 9,
    },
    airQuality: { pm25MicrogramsPerM3: 12, minPm25Next3h: 11, maxPm25Next3h: 13, pm10MicrogramsPerM3: 20 },
  });
  render(<App />);
  fireEvent.change(screen.getByRole('textbox', { name: '도시 이름' }), { target: { value: '서울' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /확인/ }));
  });
  await waitFor(() => expect(window.location.pathname).toContain('/city/'));
  expect(decodeURIComponent(window.location.pathname)).toContain('/대한민국/서울특별시/서울/37.5,127');
  expect(await screen.findByLabelText('오늘의 준비물 요약')).toBeInTheDocument();
  expect(screen.getByText(/현재 기온 · 체감 40.8°/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /서울 비/ })).toBeInTheDocument();

  const tempChart = screen.getByRole('img', { name: /TEMP .*현재 25°/ });
  expect(tempChart).toBeInTheDocument();
  expect(within(tempChart).queryByText(/현재 40.8°/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('날씨 상세 신호')).toBeInTheDocument();
});


test('loads weather dashboard from a city detail URI directly', async () => {
  window.history.replaceState({}, '', '/weathericon/city/%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD/%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C/%EC%84%9C%EC%9A%B8/37.5,127');
  getConditions.mockResolvedValue({
    timezone: 'Asia/Seoul', reportedAt: '2026-07-22T12:00:00+09:00', warnings: [],
    weather: {
      temperatureC: 24,
      apparentTemperatureC: 25,
      precipitationMm: 0,
      weatherCode: 0,
      precipitationProbabilityNow: 0,
      maxPrecipitationProbabilityNext3h: 0,
      minPrecipitationProbabilityNext3h: 0,
      uvIndexNow: 3,
      maxUvIndexNext3h: 4,
      minUvIndexNext3h: 2,
      minTemperatureC: 19,
      maxTemperatureC: 28,
      windSpeedKmh: 5,
      minWindSpeedKmh: 2,
      maxWindSpeedKmh: 8,
    },
    airQuality: { pm25MicrogramsPerM3: 9, minPm25Next3h: 8, maxPm25Next3h: 10, pm10MicrogramsPerM3: 18 },
  });

  render(<App />);

  expect(await screen.findByRole('heading', { name: /서울 맑음/ })).toBeInTheDocument();
  expect(getConditions).toHaveBeenCalledWith(expect.objectContaining({ name: '서울', latitude: 37.5, longitude: 127 }));
});
