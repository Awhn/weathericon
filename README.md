# Weather Icon

도시 이름 하나로 현재 날씨와 대기질을 조회하고, 자동차 계기판처럼 한눈에 알아볼 수 있는 **준비물·복장 아이콘**을 보여 주는 웹 애플리케이션입니다.

> 현재 첫 번째 수직 기능이 구현되어 있습니다. 도시 검색, Open-Meteo 날씨·대기질 조회, 추천 규칙과 반응형 아이콘 대시보드를 정적 페이지에서 실행할 수 있습니다.

## 사용자 경험

```text
/?city=Seoul
       │
       ▼
도시 검색 → 날씨·대기질 조회 → 규칙 기반 판정 → 우산/마스크/복장 아이콘
```

- 진입 URL: `/?city={도시 이름}` (예: `/?city=서울`, `/?city=New%20York`)
- `city`가 없으면 도시 입력 화면을 표시합니다.
- 같은 이름의 도시가 여러 개면 국가·행정구역을 포함한 후보를 선택하게 합니다.
- 각 아이콘에는 색상뿐 아니라 이름, 권고 이유, 관측 시각을 함께 표시합니다.

## 문서

- [제품 요구사항과 MVP 범위](docs/product-requirements.md)
- [시스템 설계와 데이터 흐름](docs/architecture.md)
- [Open-Meteo 요구사항 적합성 평가](docs/open-meteo-evaluation.md)
- [ADR-0001: 정적 페이지 우선 배포와 공급자 경계](docs/adr/0001-static-first-provider-boundary.md)

## 현재 기술 기반

- React 18 / JavaScript
- Create React App (`react-scripts`)
- Jest / React Testing Library

초기 구현에서는 기존 기반을 유지해 제품 규칙 검증에 집중합니다. **MVP는 별도 서버 없이 정적 페이지로 배포**하고 브라우저에서 날씨 공급자를 호출합니다. 단, 공급자 응답을 React 컴포넌트가 직접 사용하지 않고 클라이언트 어댑터가 내부 모델로 변환해 향후 BFF 도입 비용을 줄입니다.

## 로컬 실행

```bash
npm ci
npm start
```

검증 명령:

```bash
npm test -- --watchAll=false
npm run build
npm run build:pages
```

## 폴더 구조

애플리케이션을 중첩된 하위 폴더에서 저장소 루트로 이동해 로컬 명령과 GitHub Actions의 작업 경로를 단순화했습니다.

```text
weathericon/
├── .github/workflows/
│   └── deploy-pages.yml       # 테스트, 정적 빌드, Pages 배포
├── docs/                      # 요구사항, 아키텍처, ADR
├── public/                    # 정적 파일과 .nojekyll
├── src/
│   ├── domain/                # 공급자와 독립적인 추천 규칙
│   ├── services/              # Open-Meteo 클라이언트와 정규화
│   ├── App.js                 # 검색 및 대시보드 UI
│   └── App.css
├── package.json
└── README.md
```

`build/`와 `node_modules/`는 생성물이므로 버전에 포함하지 않습니다.

## GitHub Pages 배포

1. GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
2. `main` 브랜치에 push하거나 Actions 화면에서 `Deploy to GitHub Pages` 워크플로를 수동 실행합니다.
3. 워크플로는 `npm ci`, 테스트, `npm run build:pages`를 순서대로 실행한 뒤 `build/`의 **내용**을 Pages artifact로 배포합니다.

`homepage`를 `.`으로 설정해 사용자/조직 페이지와 `/{repository}/` 형태의 프로젝트 페이지 모두에서 JS·CSS 경로가 저장소 하위 경로를 벗어나지 않게 했습니다. 앱은 경로 라우팅 대신 `?city=`만 사용하므로 별도의 SPA `404.html` fallback은 필요하지 않습니다.

### 소스 루트와 배포 루트

저장소 루트는 React **소스 프로젝트의 루트**이고, `npm run build`가 생성하는 `build/`는 HTML·CSS·JavaScript만 들어 있는 **정적 배포 루트**입니다. GitHub Pages Actions의 artifact 배포는 `build/` 폴더 자체를 한 단계 더 올리는 것이 아니라 그 안의 파일을 사이트 루트에 풉니다.

```text
repository root                    deployed Pages root
├── package.json                   ├── index.html
├── src/                           ├── asset-manifest.json
├── public/       npm run build    ├── manifest.json
└── build/        ─────────────▶   ├── .nojekyll
    ├── index.html                 └── static/
    ├── .nojekyll                      ├── css/*.css
    └── static/                        └── js/*.js
```

따라서 빌드 결과물을 Git 저장소의 소스 루트에 복사하거나 커밋하지 않습니다. 그렇게 하면 `src/`, `package.json`, `README.md`와 배포 파일이 섞이고 매 빌드마다 해시가 붙은 파일이 커밋됩니다. 대신 `upload-pages-artifact`의 `path: build`가 배포 시점에 `build/index.html`을 실제 사이트의 루트 `index.html`로 만듭니다.

`npm run build:pages`는 정적 빌드 후 `index.html`, manifest, `.nojekyll`, CSS/JS entrypoint의 존재와 루트 절대경로 누락을 검사합니다. 이 앱은 서버에서 React를 실행하거나 HTML을 렌더링하지 않으며, 배포 후 브라우저가 정적 JS를 실행하고 Open-Meteo API를 직접 호출합니다.

## 구현 순서

1. ✅ URL 파라미터 파싱과 도시 선택 상태
2. ✅ 브라우저용 Open-Meteo 클라이언트와 정규화된 내부 응답
3. ✅ 순수 함수 형태의 초기 추천 규칙 엔진과 경계값 테스트
4. ✅ 반응형 아이콘 패널, 판정 근거, 로딩·오류 상태
5. 다음: 공급자 fixture 기반 계약 테스트와 실제 배포 origin의 CORS smoke test

## 제품 안전 원칙

이 서비스의 아이콘은 일상적인 준비를 돕는 참고 정보이며 의료·재난 경보가 아닙니다. 마스크 권고 등 건강과 관련된 문구에는 데이터 출처, 기준, 갱신 시각을 노출하고 정부 또는 지역 기관의 공식 지침을 우선하도록 안내합니다.
