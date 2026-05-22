# 홈 화면 — 필요 API

- 화면: `apps/native/src/screens/home/index.tsx`
- 구성: 헤더(검색·알림) + 인사말 + ① 지수 스트립 + ② 오늘의 시그널(3) +
  ③ 주요 뉴스(3) + ④ 내 관심 종목(상위 4)

홈은 여러 섹션을 모아 보여주는 대시보드라, 섹션마다 캐시 무효화 단위가 다르다.
**섹션별 개별 엔드포인트 + TanStack Query 병렬 호출**을 기본으로 한다. (단일
워터폴이 우려되면 `home.dashboard`로 묶는 옵션도 가능하나, 현재는 분리 권장.)

## 필요 API

| # | 섹션 | 엔드포인트 | 반환 | 소스 |
|---|---|---|---|---|
| 1 | 헤더 인사말 | `user.me` | `{ name }` | 🔑 Auth |
| 2 | 헤더 🔔 dot | `notifications.unreadCount` | `{ count }` | 🔵 DB |
| 3 | ① 지수 스트립 | `market.indices` | `MarketIndex[]` | 🟢 KIS |
| 4 | ② 오늘의 시그널 | `signals.feed({ limit: 3 })` | `Signal[]` | ⚙️ 엔진 |
| 5 | ③ 주요 뉴스 | `news.feed({ limit: 3 })` | `NewsItem[]` | 🟣 AI / 외부 |
| 6 | ④ 관심 종목 | `watchlist.preview({ limit: 4 })` | `Stock[]` | 🔵 DB + 🟢 KIS + ⚙️ |

> 모델 정의는 `apps/native/src/utils/data.ts`의 `MarketIndex` / `Signal` /
> `NewsItem` / `Stock` 인터페이스 참조.

## 섹션 상세

### ① 지수 스트립 — `market.indices`
- 반환: `MarketIndex[]` (`{ name, value, change, changePct }`) — KOSPI/KOSDAQ.
- 소스: 🟢 KIS `inquire_index_price`. 장중엔 ⚡RT로 갱신 검토.

### ② 오늘의 시그널 — `signals.feed({ limit: 3 })`
- 반환: `Signal[]` 상위 3건. 전체 화면은 [signals.md](./signals.md).
- 카드는 펼침(`expanded`) 시 `title`/`body`/`strength`/`type` 사용 → 목록 응답에
  본문까지 포함.

### ③ 주요 뉴스 — `news.feed({ limit: 3 })`
- 반환: `NewsItem[]` 상위 3건. 카드엔 `title`/`source`/`time`/`sentiment` 사용.
- 상세/AI요약은 [news.md](./news.md).

### ④ 내 관심 종목 — `watchlist.preview({ limit: 4 })`
- 화면 로직: `watched` 종목을 `score` 내림차순 정렬 후 상위 4.
- 반환: `Stock[]`. 카드(StockRow)는 `name`/`price`/`change`/`changePct`/
  `spark`(28pt)/`score` 사용.
- 소스 결합:
  - 종목 목록 = 🔵 DB(사용자 관심종목)
  - 현재가/등락 = 🟢 KIS `inquire_price` (또는 ⚡RT)
  - `spark`(미니 차트) = 🟢 KIS `inquire_daily_itemchartprice` (일 1회 캐시)
  - `score` / `signalBreakdown` = ⚙️ 엔진

## 상호작용 (네비게이션만, 뮤테이션 없음)
- 검색 → `search`, 알림 → `alerts`, 시그널/뉴스 전체보기 → 해당 탭,
  관심종목 전체보기 → `watchlist`, 종목 행 탭 → `stock/[code]`.

## 미정 / 결정 필요
- [ ] `score`·`signalBreakdown` 산출식(엔진) 정의 — tech는 차트 기반 계산 가능,
      ai/event/community는 별도 파이프라인 필요.
- [ ] 관심종목 현재가 갱신 방식: 폴링 vs ⚡RT(SSE) 구독.
- [ ] `home.dashboard` 묶음 엔드포인트 도입 여부.
