# Native No Mock Market Values Design

## Goal

`apps/native`에서 시세성 mock 값이 실제 데이터처럼 보이지 않도록 막는다.
가격, 등락률, 차트, 지수, 현재가 대비 계산은 신뢰할 수 있는 live/seed/API 데이터가
없으면 숫자를 표시하지 않고 로딩, 연결 중, 또는 데이터 없음 상태를 표시한다.

## Background

현재 `apps/native/src/utils/data.ts`는 디자인 프로토타입에서 넘어온 mock 데이터를
담고 있다. 최근 화면들은 oRPC, realtime SSE, TanStack Query 기반으로 많이
전환됐지만 일부 화면은 아직 `findStock()`, `stocks`, `indices`를 통해 mock 값을
폴백으로 사용한다.

금융 앱에서 mock 가격이나 등락률이 실제 값처럼 보이면 사용자 신뢰를 해칠 수 있다.
이번 작업은 전체 market API 구현이 아니라, 우선 위험한 숫자 폴백을 차단하는 작은
안전장치다.

## Scope

이번 변경은 native 앱의 표시 로직만 다룬다.

- `stock-detail`: 알 수 없는 종목 코드를 `stocks[0]`로 폴백하지 않는다. live quote가
  없으면 가격 `0원` 대신 시세 연결 상태를 표시한다.
- `home` 지수 스트립: 정적 `indices` 값을 KOSPI/KOSDAQ 현재값처럼 표시하지 않는다.
  realtime seed/SSE 값이 없으면 지수 카드에 연결 중 상태를 표시한다.
- `price-alert`: mock 현재가로 `% 기준 도달가`를 계산하지 않는다. 신뢰할 수 있는
  현재가가 없으면 직접 입력만 허용하고, 기존 알림 목록의 mock 기준 diff도 숨긴다.
- `search`: 정적 `stocks`, `trending`, `recent` 사용은 당장 완전히 제거하지 않되,
  mock 가격/등락률을 실제 시세처럼 표시하지 않는다.

## Non-Goals

- KIS REST 기반 `market.*` oRPC 라우터를 새로 만들지 않는다.
- 서버 시세 캐시, 레이트리밋, market chart API를 구현하지 않는다.
- `utils/data.ts`를 완전히 삭제하지 않는다.
- 뉴스, 토론, 시그널의 서버 데이터 모델을 재설계하지 않는다.

## Data Classification

로컬 mock/seed 데이터는 다음 기준으로만 사용한다.

### Allowed Local Metadata

- 종목명
- 종목 코드
- 섹터
- 로고 글자, 로고 색상
- 화면 시연용 선택 후보

### Disallowed Market Values

- 현재가
- 전일 대비 금액
- 등락률
- sparkline/chart series
- KOSPI/KOSDAQ 지수값
- 현재가 대비 `%` 계산
- score가 실제 엔진 산출값처럼 보이는 표시

## UI States

데이터 없음은 숫자 폴백이 아니라 상태로 표현한다.

- 요청 중 또는 SSE seed 대기: `시세 연결 중` 또는 skeleton
- 요청 실패 또는 seed 없음: `시세 정보를 불러오지 못했어요`
- 종목 코드 자체를 찾을 수 없음: `종목 정보를 찾을 수 없습니다`
- 현재가 없음: `% 기준 설정` 비활성화, 직접 입력만 사용

## Screen Design

### Stock Detail

`findStock(code) ?? stocks[0]` 패턴을 제거한다. `findStock(code)`가 실패하면 not-found
상태를 렌더한다.

시세 영역은 live quote가 있을 때만 가격, 변화 금액, 등락률을 표시한다. live quote가
없으면 큰 `0원` 대신 연결 중 UI를 보여준다. 차트 hook이 빈 series를 반환하는 것은
허용하지만, UI는 이를 mock 차트로 대체하지 않는다.

### Home Index Strip

`useIndexStream`은 더 이상 정적 `indices` 배열을 값 폴백으로 받지 않는다. 반환 모델은
각 지수별로 live data 존재 여부를 드러내야 한다. `IndexStrip`은 값이 없으면 숫자,
변화량, 차트를 숨기고 skeleton 또는 연결 중 텍스트를 표시한다.

### Price Alert

가격 알림 생성 화면은 `findStock(selected.code)?.price`를 현재가로 쓰지 않는다.
현재 별도 신뢰 가능한 quote 소스가 없으므로 `% 기준 설정`을 사용할 수 없게 하고,
직접 입력 모드만 허용한다.

가격 알림 목록은 `findStock(alert.stockCode)?.price` 기준으로 현재가 대비 diff를
계산하지 않는다. 종목명과 로고는 로컬 메타 또는 서버 반환명으로 표시하되, diff는
신뢰 가능한 현재가가 붙기 전까지 숨긴다.

### Search

현재 검색 화면은 정적 `stocks`로 결과와 인기 종목을 만든다. 이번 작업에서는 검색
화면의 가격/등락률 표시를 제거한다. 서버 검색 전환은 별도 작업으로 남긴다.

## Verification

- `rg`로 `stocks[0]`, `indices as fallbackIndices`, `findStock(...).price`,
  `stock.price`, `stock.change`, `stock.changePct` 사용처를 확인한다.
- native 소스에서 시세성 mock 값이 화면에 직접 표시되지 않는지 확인한다.
- `pnpm dlx ultracite check`로 lint/type 수준의 회귀를 확인한다.
- Expo dev 서버가 실행 가능한 환경이면 홈, 검색, 종목 상세, 가격 알림 화면을 수동
  확인한다. native 런타임을 실행할 수 없으면 그 사유를 완료 보고에 명시한다.

## Risks

- market API가 아직 없으므로 일부 화면은 숫자 대신 연결 중/데이터 없음 상태가 더 자주
  보일 수 있다.
- `utils/data.ts`의 `Stock` 타입이 가격 필드를 필수로 갖고 있어, 이번 작업만으로
  타입 차원에서 시세성 mock 사용을 완전히 막지는 못한다.
- `score`도 실제 엔진값처럼 보일 수 있지만, 이번 범위에서는 가격/등락률/지수/차트
  중심으로 차단한다.
