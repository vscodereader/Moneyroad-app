# 네이티브 앱 — 화면별 필요 API 정리

<!-- vscodereader 2026-07-30 수정: 기존에는 모든 화면이 mock이고 라우터가
healthCheck/todo뿐이라고 적혀 있었으나, 주요 화면의 oRPC·realtime 연동 구현을 반영. -->
`apps/native`의 주요 탭 화면이 실제로 그리는 데이터를 기준으로, 필요한 API와 현재
구현 상태를 정리한 문서다. 홈·시그널·뉴스·토론·마이 주요 화면은 oRPC 또는 realtime
실데이터에 연결되어 있다. `@/utils/data.ts`는 일부 화면의 종목 메타데이터·타입과
정적 검색 데이터에 남아 있으며, “모든 화면이 mock”인 상태는 아니다.

- 화면 코드: `apps/native/src/screens/<name>/index.tsx`
- mock 데이터 / 타입: `apps/native/src/utils/data.ts`
- API 클라이언트: `apps/native/src/utils/orpc.ts` (oRPC + TanStack Query)
- 현재 라우터: `packages/api/src/routers/index.ts` (`news`, `notice`, `notification`,
  `onboarding`, `signal`, `stock`, `watchlist`, `discussion`, `inquiry`, `priceAlert`,
  `waitlist`, `todo`)

## 화면별 문서

<!-- vscodereader 2026-07-30 수정: Thread 도메인이 DiscussionRoom으로
리네임 완료되어 화면 설명의 기존 스레드 용어를 현재 명칭으로 변경. -->
| 탭 | 문서 | 핵심 데이터 |
|---|---|---|
| 홈 | [home.md](./home.md) | 지수 · 시그널 · 뉴스 · 관심종목 요약 |
| 시그널 | [signals.md](./signals.md) | 필터별 시그널 피드 |
| 뉴스 | [news.md](./news.md) | 탭별 뉴스 + AI 요약 |
| 토론 | [discuss.md](./discuss.md) | DiscussionRoom 목록 · 채팅방 |
| 마이 | [mypage.md](./mypage.md) | 프로필 · 통계 · 알림 설정 |

> 구현 순서·DB 스키마·Phase 로드맵은 [plan.md](./plan.md) 참고.

---

## 공통 규약

### 호출 구조

<!-- vscodereader 2026-07-30 수정: 기존 미정이었던 시세 연결이 server의 market
oRPC가 아니라 realtime REST/SSE 직접 연결로 구현되어 실제 토폴로지로 변경. -->
앱의 인증·사용자 데이터·콘텐츠·mutation은 **server의 oRPC**를 호출한다. 시세(KIS)
snapshot·차트·sparkline·SSE는 앱이 **realtime 서비스**에 직접 연결한다. KIS
자격증명·토큰·캐시·레이트리밋은 realtime 내부에 격리한다.

```
[native]  ──oRPC(/rpc)──────────────> [server] ──> DB (packages/db)
   │                                     │
   │                                     └── 내부 refresh/notify 트리거
   ├── REST(snapshot/chart/sparkline)──> [realtime] ──> KIS REST
   └── SSE(quotes/news/discussion/signal)───────────> KIS WS·각 Hub
```

### 데이터 소스 범례

문서 표의 "소스" 열에 아래 기호를 쓴다.

<!-- vscodereader 2026-07-30 수정: KIS 호출 책임이 server가 아니라
realtime 서비스에 구현되어 실제 소유 위치로 변경. -->
| 기호 | 소스 | 위치 / 상태 |
|---|---|---|
| 🟢 KIS | 한국투자증권 OpenAPI (시세성) | `apps/realtime` 내부 호출 |
| ⚡ RT | 실시간 시세 (SSE) | `apps/realtime` — **구현됨** |
| 🔵 DB | 자체 DB (사용자·관심종목·토론·설정) | `packages/db` |
| ⚙️ 엔진 | 시그널 산출 (지표 계산·집계) | 미구현 |
| 🟣 AI | 뉴스 분류·관련성 판단 / AI 시그널 | 뉴스 분류 구현, AI 시그널 엔진 미구현 |
| 🔑 Auth | better-auth 세션 | `packages/auth` — **구현됨** |

### 엔드포인트 네이밍

oRPC 라우터는 도메인별로 그룹핑한다(`packages/api/src/routers/<domain>.ts`).
대부분 `protectedProcedure`(로그인 필요)이며, 지수·뉴스 등 공개 데이터는
`publicProcedure`로 둘 수 있다.

RFC 0009 적용 후 공개/보호 경계는 다음과 같다.

- 공개: 홈, 지수, 홈 시그널 미리보기(`signal.preview`), 일반·카테고리 뉴스,
  토론방 인기·최신 목록과 방 메타데이터, 종목 검색·시세·차트·기본 정보
- 보호: 전체 시그널, 토론 검색·관심·즐겨찾기와 실제 메시지, 관심종목·알림·
  설정·마이페이지, 쓰기·좋아요·즐겨찾기·가격 알림
- 보호 기능은 화면의 `AuthGate`/`useProtectedAction`과 서버의
  `protectedProcedure`를 함께 적용한다.
- 신규 계정의 온보딩 완료 여부는 `user.onboarding_completed_at`을
  `onboarding.status/complete`로 조회·저장한다.

<!-- vscodereader 2026-07-30 수정: 설계 단계의 복수형·가상 라우터 이름을 현재
appRouter의 실제 단수형 도메인 이름과 realtime 경로로 교체. -->
```text
signal.*        시그널 미리보기·피드·관리
news.*          뉴스 피드·상세·관리자 작성
discussion.*    DiscussionRoom·메시지·모더레이션·답글
watchlist.*     관심 종목
notification.*  알림함·설정·푸시 토큰
onboarding.*    계정 온보딩 상태·관심종목 완료 저장
stock.*         종목 검색·기본 정보
priceAlert.*    가격 알림
realtime REST   지수·현재가·차트·sparkline
realtime SSE    시세·뉴스·토론 목록·시그널 갱신
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
