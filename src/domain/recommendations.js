const recommendation = (id, category, label, icon, active, reason) => ({ id, category, label, icon, active, reason });

export function buildRecommendations({ weather, airQuality }) {
  const feels = weather.apparentTemperatureC;
  let clothing;
  if (feels == null) clothing = recommendation('clothing', 'CLOTHING', '복장 판정 불가', '◇', false, '체감온도 정보가 없습니다.');
  else if (feels >= 25) clothing = recommendation('clothing', 'CLOTHING', '가벼운 반팔', '◫', true, `체감온도 ${round(feels)}°C로 가벼운 옷이 좋아요.`);
  else if (feels >= 12) clothing = recommendation('clothing', 'CLOTHING', '얇은 겉옷', '♢', true, `체감온도 ${round(feels)}°C로 겹쳐 입기 좋아요.`);
  else clothing = recommendation('clothing', 'CLOTHING', '따뜻한 외투', '▣', true, `체감온도 ${round(feels)}°C로 따뜻하게 입으세요.`);

  const rain = weather.precipitationMm > 0 || weather.maxPrecipitationProbabilityNext3h >= 40;
  const uv = weather.maxUvIndexNext3h >= 3;
  const mask = airQuality.pm25MicrogramsPerM3 > 35 || airQuality.pm10MicrogramsPerM3 > 80;

  return [
    clothing,
    recommendation('umbrella', 'RAIN', '우산', '☂', rain, rain ? `향후 3시간 강수확률이 최대 ${round(weather.maxPrecipitationProbabilityNext3h)}%예요.` : '당분간 우산 없이 이동해도 좋아요.'),
    recommendation('uv', 'UV', '자외선 대비', '☀', uv, uv ? `향후 3시간 UV 지수가 최대 ${round(weather.maxUvIndexNext3h)}예요.` : '자외선 지수가 높지 않아요.'),
    recommendation('mask', 'AIR', '마스크 고려', '◉', mask, mask ? '미세먼지 수치가 기준보다 높아 공식 지침을 확인하세요.' : '미세먼지 수치가 권고 기준 이내예요.'),
  ];
}

const round = (value) => value == null ? '—' : Math.round(value * 10) / 10;
