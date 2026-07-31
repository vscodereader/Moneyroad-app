# 시그널 화면 — 필요 API

- 화면: `apps/native/src/screens/signals/index.tsx`
- 구성: 헤더(필터 sliders) + "최근 24시간 N건" 요약 + 액션 필터 칩
  (전체/매수/매도/관망) + 시그널 카드 목록(펼침, 무한 스크롤)

> **모델 전환 (2026-05): 소스 기반 → 액션 기반.**
> 시그널의 1차 분류는 **액션(매수/매도/관망)**이다. 기존 소스 분류
> (`tech`/`ai`/`event`/`community`)는 `source` 부가 필드로 보존하며 향후 확장용
> (엔진은 당분간 `tech`만 생성). 알림 설정(`buySignal`/`sellSignal`/`holdSignal`)과
> 일치한다.

---

## 구현 완료 (기반)

커밋 `2d057ef` — 스키마 + oRPC + 화면 실데이터 연결.

### DB — `signal` 테이블 (`packages/db/src/schema/signal.ts`, 마이그레이션 0003)
| 컬럼 | 설명 |
|---|---|
| `action` (`signal_action` enum) | `buy` / `sell` / `hold` — 1차 분류 |
| `source` (`signal_source` enum) | `tech`/`ai`/`event`/`community`, 기본 `tech` (향후) |
| `strength` int | 1(약)~5(강) |
| `title`, `body` text | 카드 제목 / 펼침 본문 |
| `indicators` jsonb | 산출 근거(rsi, ma cross, volume 등) — 엔진이 채움 |
| `stockCode` text | 단축코드. **FK 없음** (stock_master 재적재에도 시그널 보존) |
| `createdAt` | 생성 시각 |

인덱스: `(stockCode, createdAt)`, `(action, createdAt)`, `(createdAt)`.

### oRPC — `signalRouter` (`packages/api/src/routers/signal.ts`)
| 엔드포인트 | 반환 | 인증 | 비고 |
|---|---|---|---|
| `signal.preview()` | `{ items: SignalItem[], nextCursor }` | public | 홈 전용, 최근 24시간 최대 3건, 필터·cursor 없음 |
| `signal.feed({ action?, code?, window, cursor?, limit })` | `{ items: SignalItem[], nextCursor }` | **protected** | 키셋 페이지네이션, `window` 기본 `all`(`24h`/`7d`), 종목명 join |
| `signal.counts({ window })` | `{ all, buy, sell, hold }` | **protected** | 전체 시그널 탭 필터 칩 건수 |
| `signal.activeCount` | `number` | **protected** | 내 관심종목의 최근 24h 시그널 수 (mypage 스탯) |

`SignalItem` = `{ id, code, name, action, source, strength, title, body, time }`
(native `Signal`과 동일 구조, `time`은 상대시간 문자열).

### 화면 연결 (실데이터)
- 시그널 화면: `feed`(무한 스크롤) + `counts`(칩 배지). 필터 = 전체/매수/매도/관망.
- home "오늘의 시그널": 공개 `preview()` + **빈/로딩 상태 표기**.
- mypage "활성 시그널" 스탯: `activeCount`.
- stock-detail "최근 시그널": 로그인·온보딩 완료 시
  `feed({ code, window:"all", limit:2 })`.
- `SignalCard`: 액션 배지(매수↑ 빨강 / 매도↓ 파랑 / 관망 중립), 종목명은 API 값.
- 더미 `signals` 배열은 `@/utils/data`에서 제거됨.

---

## 남은 작업 — ⚙️ 시그널 엔진 (다음 라운드)

<!-- vscodereader 2026-07-30 수정: 관리자는 시그널을 수동 생성할 수 있으므로
테이블이 항상 비어 있다는 표현을 자동 엔진 미구현 상태로 정확히 변경. -->
자동 생성 엔진은 아직 없어 시스템이 `signal` 테이블을 주기적으로 채우지는 않는다.
관리자는 `signal.create`로 시그널을 수동 등록할 수 있다. 엔진은 realtime에 둔다
(항상 켜져 있어 크론에 적합 — 뉴스 수집기와 동일).
**상세 작업 체크리스트는 [realtime/plan.md](../../realtime/plan.md#시그널-엔진-신규)** 참고.

### 결정된 설계 (사용자 확인)
- **유니버스**: 모든 유저 `user_watchlist` 종목 **합집합**만 스캔
  (관련성 높고 KIS 호출량 제한).
- **활성 시그널 정의**: 로그인 유저의 관심종목에 대한 **최근 24h** 시그널 수
  (`signal.activeCount`로 이미 구현).
- **1차 소스**: `tech` (KIS 일봉 기술적 지표). 나머지 소스는 향후.

### 엔진 개요
<!-- vscodereader 2026-07-30 수정: 기존 미구현이었던 KIS REST 토큰·일봉 조회는
realtime에 구현되어 시그널 엔진에서 재사용할 선행 기능으로 변경. -->
1. 기존 KIS REST 토큰 발급·영속화(`index-intraday.ts`) 재사용
2. 기존 일/주/월봉 조회(`stock-chart.ts`)를 시그널 유니버스 처리에 재사용
3. 골든크로스 / RSI / 거래량 급증 → **매수/매도/관망** + `strength` + `title`/`body` 산출,
   근거를 `indicators`(jsonb)에 저장
4. `signal` 테이블 upsert (중복/쿨다운 정책 결정 필요)
5. 크론 실행 (stock-master 스케줄러 패턴 재사용; 주기·장중 한정 여부 결정)

### 미정 / 결정 필요
- [ ] 엔진 실행 주기(예: 장중 N분 / 장마감 후 1회)와 중복 시그널 정책(동일 종목·액션 재생성 쿨다운).
<!-- vscodereader 2026-07-30 수정: 기존 미정이었던 관리자 시그널 푸시는
RFC 0007의 notifyRealtimeSignal/signal-push 경로로 구현되어 완료 처리. -->
- [x] 관리자 생성 시그널 → 관심종목 보유자 알림·푸시
      (`buy_signal`/`sell_signal`/`hold_signal`, 사용자 알림설정 존중)
- [ ] 향후 자동 엔진 생성 시그널도 같은 푸시 경로를 호출하도록 연결
- [ ] 지표 임계값(RSI 과매수/과매도 경계, 거래량 배수 등) 튜닝.
- [x] `window` 24h/7d/all을 `feed`와 `counts`에서 공통 지원
- [ ] `strength` 산출 공식(여러 지표 동시 충족 시 가중).

## 상호작용
- 필터 칩 선택(클라 상태) → `signal.feed`의 `action` 파라미터로 재조회.
- 카드 펼침은 클라 상태(`openId`)만. 시그널 → 종목 상세 이동은 추가 가능.
- 헤더 sliders: 정렬·기간 등 세부 필터 화면(미구현).
