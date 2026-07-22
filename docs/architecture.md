# 시스템 설계

## 1. 설계 원칙

1. **설명 가능성:** 추천 결과는 항상 입력값과 적용 규칙을 함께 반환한다.
2. **공급자 격리:** 외부 API 응답을 내부 모델로 변환한 뒤 UI와 규칙 엔진에 전달한다.
3. **부분 실패 허용:** 날씨와 대기질 중 하나가 실패해도 다른 결과를 사용할 수 있다.
4. **최소 권한:** 공급자 자격 증명은 서버 환경 변수에만 두고 로그에 남기지 않는다.
5. **결정론:** 추천 엔진은 네트워크나 현재 시각에 직접 의존하지 않는 순수 함수로 만든다.

## 2. 제안 구조: 정적 페이지 우선

```text
Static hosting / CDN
  └─ Browser (React)
  ├─ URL/input state
  ├─ place selection
  ├─ icon dashboard
  ├─ provider clients + timeout
  ├─ geocoding/weather/air-quality adapters
  ├─ in-memory/session cache
  ├─ normalizer
  └─ recommendation policy
          │
          ▼
External provider (initially Open-Meteo)
```

MVP는 빌드 산출물만 CDN 또는 정적 호스팅에 올린다. 브라우저가 Open-Meteo를 HTTPS로 직접 호출하므로 별도 Node 서버나 서버리스 함수가 필요하지 않다. 이 방식은 공급자가 CORS를 허용하고 비밀 키를 요구하지 않으며 사용량과 이용 약관이 서비스 용도에 맞는다는 확인을 전제로 한다.

정적 배포라도 컴포넌트가 공급자 URL이나 필드에 직접 의존해서는 안 된다. `services`의 공급자 클라이언트와 어댑터가 외부 응답을 아래 내부 계약으로 바꾸고, 추천 정책은 정규화된 값만 사용한다. 따라서 나중에 BFF가 필요해져도 UI와 정책을 유지한 채 서비스 구현만 교체할 수 있다.

필드 수준과 운영 조건에 대한 공급자별 판정은 [Open-Meteo 요구사항 적합성 평가](open-meteo-evaluation.md)에서 관리한다. 검증 체크리스트가 완료되기 전까지 Open-Meteo 선택은 확정이 아니라 조건부 결정이다.

## 3. 요청 흐름

### 위치 검색 내부 서비스

```http
placesService.search("서울")
```

```json
{
  "places": [
    {
      "id": "37.5665,126.9780",
      "name": "서울",
      "admin1": "서울특별시",
      "country": "대한민국",
      "latitude": 37.5665,
      "longitude": 126.978,
      "timezone": "Asia/Seoul"
    }
  ]
}
```

### 상태와 추천 내부 서비스

```http
conditionsService.get({ latitude: 37.5665, longitude: 126.978, timezone: "Asia/Seoul" })
```

```json
{
  "location": {
    "displayName": "서울, 대한민국",
    "latitude": 37.5665,
    "longitude": 126.978,
    "timezone": "Asia/Seoul"
  },
  "observedAt": "2026-07-22T09:00:00+09:00",
  "weather": {
    "temperatureC": 28.1,
    "apparentTemperatureC": 30.4,
    "precipitationMm": 0,
    "maxPrecipitationProbabilityNext3h": 60,
    "uvIndex": 5.2
  },
  "airQuality": {
    "pm25MicrogramsPerM3": 18.4,
    "pm10MicrogramsPerM3": 33.1
  },
  "recommendations": [
    {
      "id": "umbrella",
      "active": true,
      "severity": "notice",
      "reason": "향후 3시간 강수확률이 60%입니다.",
      "ruleId": "rain.next-3h.v1"
    }
  ],
  "sources": [
    { "name": "Open-Meteo", "type": "forecast" }
  ],
  "warnings": []
}
```

계약의 숫자는 단위를 필드명에 포함한다. 알 수 없는 값은 임의의 `0`으로 바꾸지 않고 `null` 또는 필드 누락으로 표현하며 `warnings`에 원인을 추가한다.

## 4. 프런트엔드 모듈 경계

```text
src/
  app/                 # 라우팅과 전역 조립
  features/location/   # city 파싱, 검색, 후보 선택
  features/dashboard/  # 상태/오류 화면과 아이콘 패널
  domain/              # 내부 타입, 추천 정책(공유하지 않을 경우)
  services/            # 공급자 클라이언트, 어댑터, 응답 검증
  components/          # 표현 전용 공통 컴포넌트
```

초기 저장소는 JavaScript이므로 JSDoc과 런타임 응답 검증으로 계약을 보호한다. TypeScript 전환 시에도 위 경계와 API 형태는 유지한다.

## 5. 정적 배포의 제약과 BFF 전환 기준

정적 페이지 방식은 서버 운영이 없고 배포가 단순하지만 다음 제약이 있다.

- 모든 외부 요청이 사용자의 브라우저와 IP에서 발생한다.
- 공급자 호출량을 중앙에서 제한하거나 응답을 사용자 간 공유 캐시할 수 없다.
- 공급자 장애 응답과 URL이 브라우저 개발자 도구에 보인다.
- 공급자가 CORS 정책을 바꾸거나 인증 키를 요구하면 클라이언트만으로 호출할 수 없다.
- 보안 헤더와 CSP는 정적 호스팅이 제공하는 설정 범위 안에서 적용해야 한다.

다음 중 하나가 발생하면 동일 출처의 BFF/serverless function을 도입한다.

1. 비밀 API 키, 서명 또는 유료 자격 증명을 보호해야 한다.
2. 공급자가 브라우저 CORS 요청을 허용하지 않는다.
3. 중앙 rate limit, 사용자 간 캐시 또는 공급자 fallback이 필요하다.
4. 호출량, 오류율, 지연 시간을 서버 관점에서 관측해야 한다.
5. 공급자 약관이 브라우저 직접 호출 방식을 허용하지 않는다.

BFF 도입 후에는 브라우저가 동일한 내부 모델을 반환하는 `/api/places`와 `/api/conditions`를 호출하도록 `services` 구현만 교체한다.

## 6. 캐시와 시간

- 위치 검색 결과는 도시 문자열 기준으로 메모리 또는 `sessionStorage`에 비교적 길게 캐시할 수 있다.
- 날씨와 대기질은 브라우저 세션 안에서 각각 독립된 키와 TTL을 사용해 한 요청의 실패가 다른 데이터를 막지 않게 한다.
- 캐시 키에는 반올림한 좌표와 요청 데이터 종류를 포함한다.
- 공급자 시각을 ISO 8601과 해당 지역 시간대로 보존한다. 서버 시각으로 덮어쓰지 않는다.
- 정확한 TTL과 오래된 데이터 기준은 공급자 약관 및 실제 갱신 주기를 확인한 뒤 환경 설정으로 둔다.

개인 간 공유 캐시, stale-while-revalidate 또는 공급자 장애 시 공용 fallback이 필요해지면 BFF로 옮긴다.

## 7. 오류 모델

| 코드 | 의미 | UI 동작 |
| --- | --- | --- |
| `INVALID_CITY` | 비었거나 너무 긴 검색어 | 입력 안내 |
| `PLACE_NOT_FOUND` | 위치 후보 없음 | 검색어 유지, 재입력 |
| `AMBIGUOUS_PLACE` | 복수 후보 | 후보 선택 |
| `UPSTREAM_TIMEOUT` | 공급자 시간 초과 | 재시도, 캐시가 있으면 오래됨 표시 |
| `WEATHER_UNAVAILABLE` | 날씨 데이터 실패 | 대기질만 표시 |
| `AIR_QUALITY_UNAVAILABLE` | 대기질 데이터 실패 | 날씨 기반 권고만 표시 |
| `STALE_DATA` | 허용 시간보다 오래된 값 | 명시적 경고 |

클라이언트에는 안전한 메시지와 상관관계 ID만 제공하고, 공급자 응답 본문이나 스택 추적은 노출하지 않는다.

## 8. 테스트 전략

- **단위:** URL 정규화, 공급자 변환, 추천 규칙의 모든 경계값
- **계약:** 저장된 공급자 fixture를 내부 모델로 변환하고 누락/추가 필드를 처리하는지 검사
- **통합:** 공급자 client mock을 이용한 성공, 부분 실패, 시간 초과, 세션 캐시
- **컴포넌트:** 로딩, 후보 선택, 활성/비활성 아이콘, 판정 불가
- **E2E:** 공유 URL 진입부터 결과 및 재시도까지의 핵심 흐름

외부 실 API는 결정론적 테스트에 직접 사용하지 않는다. 소수의 별도 smoke test만 운영 환경의 계약 변화 감지에 사용한다.

## 9. 관측성과 개인정보

- MVP에서는 개인정보를 수집하는 원격 분석을 기본으로 넣지 않는다. 브라우저 오류 관측을 도입할 경우 공급자별 지연, 오류율, 캐시 적중률, 누락 데이터율만 최소한으로 측정한다.
- 정적 호스팅/CDN 로그의 IP 보존 정책을 확인하고, 애플리케이션은 불필요한 검색 이력을 서버로 전송하지 않는다.
- 위도·경도는 도시 중심 좌표 수준이며 사용자 기기의 정밀 위치를 MVP에서 수집하지 않는다.
- 분석 도구를 추가하기 전 보존 기간과 동의 정책을 별도로 결정한다.

## 10. 구현 전 확인 목록

- Open-Meteo의 최신 이용 약관, 호출 한도, 저작자 표시 요구를 배포 용도와 대조한다.
- 실제 브라우저에서 geocoding, forecast, air-quality 엔드포인트의 CORS 동작을 자동화된 smoke test로 확인한다.
- 선택한 정적 호스팅의 SPA fallback, 보안 헤더, CSP, 캐시 설정 방식을 결정한다.
- 제품 정책의 온도·UV·미세먼지 임계값을 검토하고 버전을 부여한다.
- 아이콘 라이선스와 색각 이상/고대비 접근성을 검토한다.
- 공급자 장애 시 허용할 캐시 수명과 화면 문구를 확정한다.
