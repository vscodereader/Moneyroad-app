# 시그널 화면 — 필요 API

- 화면: `apps/native/src/screens/signals/index.tsx`
- 구성: 헤더(필터 sliders) + "최근 24시간 N건" 요약 + 타입 필터 칩
  (전체/기술적/AI 모델/이벤트/커뮤니티) + 시그널 카드 목록(펼침)

필터 키는 `all | tech | ai | event | community` (`SignalTypeKey`, `@/utils/theme`).
각 칩에 **타입별 건수**가 붙고, 헤더엔 **24시간 총 건수**가 표시된다.

## 필요 API

| # | 용도 | 엔드포인트 | 반환 | 소스 |
|---|---|---|---|---|
| 1 | 시그널 목록 | `signals.feed({ type?, window, cursor?, limit })` | `{ items: Signal[], nextCursor }` | ⚙️ 엔진 |
| 2 | 필터별 건수 | `signals.counts({ window })` | `{ all, tech, ai, event, community }` | ⚙️ 엔진 |

- `type` 미지정 = 전체. `window` 기본 `"24h"`.
- `Signal` = `{ id, code, name, type, strength(1~5), title, body, time }`
  (`apps/native/src/utils/data.ts`).
- 목록 카드가 펼침 시 `body`까지 쓰므로 피드 응답에 본문 포함.

> `counts`를 따로 두는 이유: 현재 화면은 전체 목록을 받아 클라이언트에서
> 필터별 카운트를 센다. 서버 페이지네이션으로 바뀌면 전체 건수를 알 수 없으므로
> 카운트 전용 엔드포인트(혹은 `feed` 응답의 `facets` 필드)가 필요하다.

## 시그널 타입별 산출 소스 (⚙️ 엔진)

| type | 의미 | 산출 근거 |
|---|---|---|
| `tech` | 기술적 지표 | 🟢 KIS 일봉(`inquire_daily_itemchartprice`)으로 골든크로스·RSI·거래량 계산 |
| `ai` | AI 모델 예측 | 🟣 자체 모델 (가격 추세 예측 + 신뢰도) |
| `event` | 공시·이벤트 | 공시/뉴스 수집 파이프라인 (외부) |
| `community` | 커뮤니티 신호 | 🔵 DB 토론량·감성 집계 ([discuss.md](./discuss.md)) |

`strength`(1~5)·`title`·`body`는 엔진이 생성. tech를 제외하면 KIS만으로는
불가하며 별도 데이터 소스가 필요하다.

## 상호작용
- 필터 칩 선택(클라 상태) → `signals.feed`의 `type` 파라미터로 재조회.
- 카드 펼침은 클라 상태(`openId`)만. 시그널 → 종목 상세 이동(`stock/[code]`)은
  카드 내부 액션으로 추가 가능.
- 헤더 sliders: 정렬·기간 등 세부 필터 화면(미구현).

## 미정 / 결정 필요
- [ ] `window` 옵션 범위(24h/7d/all)와 기본값.
- [ ] 카운트 제공 방식: 전용 `counts` vs `feed` 응답 facets.
- [ ] 시그널 → 알림(`notifications`)·푸시 연동 여부.
- [ ] 엔진 산출 주기(배치 vs 실시간)와 저장 위치(DB 캐시).
