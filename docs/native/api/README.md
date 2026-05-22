# 네이티브 앱 — 화면별 필요 API 정리

`apps/native`의 주요 탭 화면이 실제로 그리는 데이터를 기준으로, 필요한 API를
역산해 정리한 문서다. 현재 모든 화면은 `@/utils/data.ts`의 **mock 데이터**를
import하고 있으며, 이 문서는 그 mock을 실제 API로 대체하기 위한 설계 기준이다.

- 화면 코드: `apps/native/src/screens/<name>/index.tsx`
- mock 데이터 / 타입: `apps/native/src/utils/data.ts`
- API 클라이언트: `apps/native/src/utils/orpc.ts` (oRPC + TanStack Query)
- 현재 라우터: `packages/api/src/routers/index.ts` (`healthCheck`, `todo`만 존재)

## 화면별 문서

| 탭 | 문서 | 핵심 데이터 |
|---|---|---|
| 홈 | [home.md](./home.md) | 지수 · 시그널 · 뉴스 · 관심종목 요약 |
| 시그널 | [signals.md](./signals.md) | 필터별 시그널 피드 |
| 뉴스 | [news.md](./news.md) | 탭별 뉴스 + AI 요약 |
| 토론 | [discuss.md](./discuss.md) | 스레드 목록 · 채팅방 |
| 마이 | [mypage.md](./mypage.md) | 프로필 · 통계 · 알림 설정 |

> 구현 순서·DB 스키마·Phase 로드맵은 [plan.md](./plan.md) 참고.

---

## 공통 규약

### 호출 구조

앱은 **자체 oRPC 엔드포인트만** 호출한다. 시세(KIS)는 앱이 직접 부르지 않고
서버가 내부에서 조합해 내려준다. KIS는 단일 자격증명·등록 한도(연결당 ~40종목)
제약이 있어, 자격증명을 서버에 격리하고 캐시·레이트리밋을 서버가 책임진다.

```
[native]  ──oRPC(/rpc)──>  [server]  ──REST/WS──>  [KIS OpenAPI]
                              │
                              ├── DB (packages/db)
                              ├── AI 파이프라인 (요약/시그널)
                              └── realtime (SSE, apps/realtime)  ←─ 실시간 시세
```

### 데이터 소스 범례

문서 표의 "소스" 열에 아래 기호를 쓴다.

| 기호 | 소스 | 위치 / 상태 |
|---|---|---|
| 🟢 KIS | 한국투자증권 OpenAPI (시세성) | 서버 내부 호출 |
| ⚡ RT | 실시간 시세 (SSE) | `apps/realtime` — **구현됨** |
| 🔵 DB | 자체 DB (사용자·관심종목·토론·설정) | `packages/db` |
| ⚙️ 엔진 | 시그널 산출 (지표 계산·집계) | 미구현 |
| 🟣 AI | 자체 LLM (뉴스 요약·AI 시그널) | 미구현 |
| 🔑 Auth | better-auth 세션 | `packages/auth` — **구현됨** |

### 엔드포인트 네이밍

oRPC 라우터는 도메인별로 그룹핑한다(`packages/api/src/routers/<domain>.ts`).
대부분 `protectedProcedure`(로그인 필요)이며, 지수·뉴스 등 공개 데이터는
`publicProcedure`로 둘 수 있다.

```
market.*       지수·시세 (KIS 래핑)
signals.*      시그널 피드 (⚙️ 엔진)
news.*         뉴스 + AI 요약
discuss.*      토론 스레드·채팅
watchlist.*    관심 종목
notifications.*알림함·미읽음
user.*         프로필·통계
settings.*     알림/표시 설정
```

### 페이지네이션 / 캐시

- 목록형(시그널·뉴스·토론)은 커서 기반(`{ cursor?, limit }` → `{ items, nextCursor }`).
- TanStack Query 키는 도메인+파라미터 단위. 시세성 데이터는 짧은 `staleTime`,
  차트·프로필은 길게.
- 차트(일봉)는 장중 1회/일 단위 캐시, 현재가는 폴링 또는 ⚡RT로 갱신.

### KIS API 매핑 (확인 완료)

서버가 내부에서 사용할 KIS function (kis-code-assistant 명세 기준).

| 용도 | KIS function | API명 |
|---|---|---|
| 지수(코스피/코스닥) | `inquire_index_price` | 국내업종 현재지수 |
| 종목 현재가/등락 | `inquire_price` | 주식현재가 시세 |
| 종목 일봉 차트 | `inquire_daily_itemchartprice` | 국내주식기간별시세(일/주/월/년) |
| 지수 기간 차트 | `inquire_daily_indexchartprice` | 국내주식업종기간별시세 |
| 실시간 체결가 | `H0STCNT0` (WS) | 실시간 체결가 — **연동됨** |
| 장 상태/휴장 | `chk_holiday`, `market_time` | 휴장일/영업일 조회 |

> 종목 뉴스 제목은 KIS 업종/기타 카테고리에 마땅한 API가 없어, 뉴스 원천은
> 외부 소스 + 자체 수집으로 본다([news.md](./news.md) 참고).
