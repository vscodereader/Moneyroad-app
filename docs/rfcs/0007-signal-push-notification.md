# RFC 0007 — 시그널 푸시 알림 (signal-push-notification)

- 상태: **Draft — D1 확정(관망 포함).** 매수·매도·관망 구현 완료.
- 작성일: 2026-07-28
- 범위: 관리자가 시그널을 작성하면 **그 종목을 관심종목에 넣고 알림 설정을 켜 둔 사용자에게 푸시**를 보낸다.
- 범위 밖: 시그널 자동생성 엔진(미구현), 알림 화면 UI 변경, iOS 검증.
- 관련 코드:
  - `apps/realtime/src/services/news/push.ts` (**본으로 삼는 원형** — 속보 푸시)
  - `apps/realtime/src/services/news/expo-push.ts` (`sendPushToUser` — 쿨다운·이력·토큰정리)
  - `packages/api/src/routers/signal.ts:159` (`create` — 유일한 시그널 생성 경로)
  - `packages/api/src/lib/realtime-trigger.ts` (server→realtime 내부 호출)
  - `apps/realtime/src/plugins/internal.ts` (내부 라우트)
- 참조: **RFC 0004/0005**(첨부), **RFC 0006**(뉴스 썸네일)과 무관. 같은 브랜치의 **시그널 목록 실시간 갱신**(이슈 #31) 위에 쌓는다.

---

## 1. 배경 — 설정은 있는데 기능이 없다

사용자가 앱에서 이렇게 해도 아무 일도 일어나지 않는다:

```
tester 계정   삼성전자를 관심종목에 등록          ✅ 저장됨
tester 계정   "매수 시그널" · "매도 시그널" ON     ✅ 저장됨
admin 계정    삼성전자 매수 시그널 작성            ✅ DB에 들어감
                        ↓
                   ❌ 아무 일도 안 일어남
```

### 1-1. 실제로 있는 것 / 없는 것

| 있는 것 | 위치 |
|---|---|
| 설정 화면 토글 "매수 시그널"·"매도 시그널"·"관망 시그널" | `apps/native/src/screens/settings/pages.tsx:48,54,60` |
| DB 컬럼 `buy_signal` `sell_signal` `hold_signal` | `user_notification_setting` |
| 알림 타입 enum `buy_signal` `sell_signal` | `notification_type` |
| 설정 저장·조회 API | `packages/api/src/routers/notification.ts` |
| 푸시 발송 인프라 (쿨다운·이력·토큰정리) | `apps/realtime/src/services/news/expo-push.ts` |

**없는 것: 이 설정을 읽어 푸시를 보내는 코드.**

전 코드베이스에서 `buySignal`/`sellSignal`을 참조하는 곳은 **설정 CRUD뿐**이다(grep 검증). 유일한 예외가 `expo-push.ts:91`인데, 이건 타입이 안 넘어왔을 때의 기본 라벨(`?? "buy_signal"`)이지 시그널 푸시가 아니다.

`sendPushToUser`를 실제로 부르는 곳은 **두 군데뿐**이다:

```
apps/realtime/src/services/news/push.ts:110              뉴스 속보
apps/realtime/src/services/price-alert/evaluator.ts:142  가격 알림
```

**설정 화면은 "켜면 알림이 온다"고 약속하는데 백엔드가 없다.** 켜도 꺼도 결과가 같으므로 사용자에게는 고장으로 보인다.

### 1-2. 시그널은 지금 수동 작성만 존재한다

`signal` 테이블에 INSERT 하는 코드는 **전 코드베이스에 하나뿐**이다:

```
packages/api/src/routers/signal.ts:171   ← adminProcedure create
```

`docs/realtime/plan.md` §시그널 엔진이 계획한 **자동 생성 엔진은 아직 한 줄도 구현되지 않았다**("엔진(생성기)만 남았다"). 따라서 이 RFC가 다루는 대상은 **관리자 수동 작성뿐**이다.

---

## 2. 팀장님 지침 — 방법은 이미 정해져 있다

시그널 푸시에 관한 서술은 팀장님 문서 **세 곳**에 있다(전 문서 grep 검증).

**① `docs/realtime/plan.md:22` — 시그널 엔진 파이프라인 6단계**
> 6. (선택) 신규 시그널 → `notification_history` + Expo 푸시(**뉴스 속보 경로 재사용**)

**② `docs/realtime/plan.md:31` — 작업 체크리스트**
> - [ ] (선택) 시그널 푸시 연동(**알림설정 ON**·`buy_signal`/`sell_signal` 타입)

**③ `docs/native/api/signals.md:75-76` — 미정/결정 필요**
> - [ ] 시그널 → 알림(`notification_history`)·**푸시** 연동 여부
>       (알림 타입 `buy_signal`/`sell_signal` 이미 존재). **연동 시 알림설정 ON 사용자 타겟.**

### 2-1. "뉴스 속보 경로"가 무엇인지도 팀장님이 적어 두었다

`docs/realtime/plan.md:137-140`:

> ### 속보 푸시 (`push.ts` + `expo-push.ts`) — 서버측 구현 완료
> - **`news` 워치리스트 구독자 중 `breakingNews` 설정 ON 사용자에게 Expo 푸시**
> - 키워드 휴리스틱으로 속보 판정, **`stockCode` 있는 뉴스만 타겟**
> - **피로도 쿨다운(5분 내 동일 user·type 상한)** + `notification_history` 추적

**첫 줄이 이 RFC의 요구사항과 정확히 같다** — "워치리스트 구독자 중 설정 ON 사용자에게". 즉 팀장님 지침을 그대로 따르면 **관심종목 기반 타겟팅이 자동으로 나온다.**

### 2-2. 정리

| 항목 | 팀장님 지침 | 출처 |
|---|---|---|
| 방법 | 뉴스 속보 경로 재사용 | ① |
| 대상 | 관심종목 구독자 중 **알림설정 ON** | ②③ + 2-1 |
| 타입 | `buy_signal` / `sell_signal` | ②③ |
| 이력 | `notification_history` 기록 | ①③ |
| **미정** | **연동 여부(할지 말지) 그 자체** | ③ |

**유일한 미정 항목은 사용자가 확정했다** — *"관리자가 시그널을 작성하면, 그 종목을 관심종목에 넣은 사용자에게 푸시를 보내야만 한다"*(2026-07-28).

### 2-3. 문서에 없는 것

- **관리자 수동 작성에 대한 언급.** 세 곳 모두 `## 시그널 엔진` 아래에 있고 "신규 시그널"은 엔진 산출물을 뜻한다. 다만 엔진이든 관리자든 `signal` 테이블에 행이 생기는 것은 같으므로 지침을 그대로 적용한다. → **D2**
- **알림 문구 형식.** 속보가 `"${종목명} 속보"`이므로 같은 꼴을 따른다(§4-3).

---

## 3. 목표 · 비목표

**목표**
- G1. 관리자가 **매수/매도** 시그널을 작성하면, 해당 종목을 관심종목에 넣은 사용자에게 푸시.
- G2. 사용자의 **알림 설정을 존중**한다 — `buySignal`/`sellSignal`이 꺼져 있으면 안 보낸다.
- G3. 기존 **쿨다운·이력·토큰정리**를 그대로 재사용한다(중복 구현 금지).
- G4. 푸시 실패가 **시그널 생성을 실패시키지 않는다**(best-effort).
- G5. 시그널 **삭제 시에는 푸시하지 않는다**.

**비목표**
- 자동생성 엔진, 알림 화면 UI 변경, iOS 실기기 검증

---

## 4. 설계

### 4-1. 어디서 보내나 — 내부 호출이 필요한 이유

푸시 발송 함수 `sendPushToUser`는 **realtime에 있고**, 시그널 생성은 **server(`packages/api`)에서 일어난다**. 뉴스는 수집기가 realtime **안**에 있어 직접 호출하지만, 관리자 작성은 그렇지 않다.

```
[server]  signal.create
   │  notifyRealtimeSignal({ signalId, stockCode, action, title })
   ▼  POST /internal/notify-signal   (x-internal-secret)
[realtime]  notifySignal()
   │  ├─ user_watchlist 구독자 조회 (type='news')
   │  ├─ user_notification_setting 에서 action별 컬럼 확인
   │  └─ sendPushToUser()  ← 쿨다운·이력·토큰정리 전부 여기서
   ▼
[Expo]  →  사용자 단말
```

**이미 깔린 배선을 쓴다.** 이슈 #31에서 만든 `refreshRealtimeSignal` → `/internal/refresh-signal`과 같은 패턴·같은 시크릿 인증이다.

### 4-2. 왜 `/internal/refresh-signal`에 얹지 않고 새 엔드포인트인가

| | `/internal/refresh-signal` (기존) | `/internal/notify-signal` (신규) |
|---|---|---|
| 뜻 | "화면 새로고침해라" | "이 사용자들에게 알림 보내라" |
| 대상 | 연결된 **전 클라이언트** broadcast | **특정 사용자**만 |
| 호출 시점 | create **및** remove | create **만** |
| 페이로드 | `{ reason }` | 시그널 내용 필요 |

**삭제 때는 푸시하면 안 되므로**(G5) 하나로 합치면 분기 플래그가 필요해진다. 의미가 다른 두 동작을 한 엔드포인트에 섞지 않는다.

### 4-3. 수신자 선정 — 속보 경로를 그대로 옮긴다

`news/push.ts`의 구조를 복사하고 **설정 컬럼만 바꾼다**:

| | 뉴스 속보 (기존) | 시그널 (신규) |
|---|---|---|
| 대상 조회 | `user_watchlist` where `stock_code` = ? AND `type='news'` | **동일** |
| 설정 확인 | `breakingNews` | `action`에 따라 `buySignal` / `sellSignal` |
| 설정 행 없을 때 | ON 취급 | **동일**(컬럼 기본값이 `true`) |
| 발송 조건 판정 | 키워드 휴리스틱(속보/급등/…) | **불필요** — 관리자가 만든 것 자체가 알릴 거리 |
| `stockCode` 없으면 | skip | 시그널은 종목이 **필수**라 항상 존재 |
| 문구 | `"${종목명} 속보"` + 기사 제목 | `"${종목명} 매수 시그널"` + 시그널 제목 |
| 알림 타입 | `breaking_news` | `buy_signal` / `sell_signal` / `hold_signal` |

> `user_watchlist`의 `type`은 enum `['signal','news']`이지만 **앱은 `'news'`만 쓴다** — `watchlist.ts:20`에 `WATCH_TYPE = "news"`로 고정되어 있고 add/remove/list가 모두 이 값을 쓴다. 그래서 시그널 푸시도 `'news'`를 봐야 한다. 직관과 어긋나므로 코드에 주석으로 남긴다.

### 4-4. 관망(hold) — 알림 타입을 새로 추가한다

팀장님 문서가 **액션 3종과 알림 설정 3종이 1:1로 대응한다**고 정의한다:

> 시그널의 1차 분류는 **액션(매수/매도/관망)**이다. … 알림 설정
> (`buySignal`/`sellSignal`/`holdSignal`)과 **일치한다.**
> — `docs/native/api/signals.md:7-11`

그런데 `notification_type` enum에만 `hold_signal`이 빠져 있었다. `notification_history.type`이
이 enum이라 **관망 알림은 기록 자체가 불가능**했고, 그 결과 설정 화면의 "관망 시그널"
토글이 켜도 아무 일이 없는 무동작 상태였다.

설계상 3종이 일치해야 하므로 enum 누락은 의도가 아니라 빠뜨린 것으로 보고,
**마이그레이션 `0013_cheerful_ghost_rider.sql`로 값을 추가**한다:

```sql
ALTER TYPE "public"."notification_type" ADD VALUE 'hold_signal' BEFORE 'price_alert';
```

⚠️ **되돌리기 어렵다.** Postgres에는 `ALTER TYPE ... DROP VALUE`가 없어, 취소하려면 타입을
통째로 재생성해야 한다. → **D1**

#### 설정 행이 없는 사용자 — 액션별로 다르다

`user_notification_setting`의 컬럼 기본값이 관망만 다르다:

| 컬럼 | 기본값 |
|---|---|
| `buy_signal` | `true` |
| `sell_signal` | `true` |
| `hold_signal` | **`false`** |

속보 경로를 그대로 옮기면 "설정 행이 없으면 발송"이 되는데, 관망에 그대로 적용하면
**토글을 켠 적 없는 사용자에게 관망 알림이 간다.** 그래서 `ACTION_META`에 `defaultOn`을
두어 컬럼 기본값과 맞춘다 — 매수·매도 `true`, 관망 `false`.

### 4-5. 실패 처리

- `notifyRealtimeSignal`은 **fire-and-forget** — `await`하지 않고 실패를 로그만 남긴다. 푸시가 안 나가도 시그널 생성은 성공해야 한다(G4).
- realtime 쪽 개별 사용자 발송 실패는 `Promise.allSettled`로 격리한다(속보와 동일).
- **쿨다운**: `sendPushToUser`가 이미 5분 내 동일 `(user, type)` 상한을 적용한다. 관리자가 매수 시그널을 연달아 쓰면 상한 초과분은 조용히 skip된다 — 의도된 동작.

---

## 5. 변경 파일

| 파일 | 변경 |
|---|---|
| `apps/realtime/src/services/signal-push.ts` | **신규** — `notifySignal()` (§4-3) |
| `apps/realtime/src/plugins/internal.ts` | `POST /internal/notify-signal` 추가 |
| `packages/api/src/lib/realtime-trigger.ts` | `notifyRealtimeSignal()` 추가 |
| `packages/api/src/routers/signal.ts` | `create`에서 호출 1줄 |
| `docs/rfcs/0007-*.md`, `docs/rfcs/README.md` | 문서 |

**변경 없음**: DB 스키마(마이그레이션 불필요 — 매수·매도 타입이 이미 존재), native 앱(설정 UI·알림 화면 모두 이미 구현됨), `apps/server`, `apps/web`.

---

## 6. 권한 · 보안

- `/internal/notify-signal`은 기존 내부 라우트와 **동일한 `x-internal-secret` 상수시간 비교**. 실패 시 401.
- 시그널 생성 자체가 `adminProcedure`라 **관리자만** 이 경로를 촉발할 수 있다.
- 푸시 본문에 시그널 제목이 들어간다 — 관리자가 쓴 공개 콘텐츠이므로 민감정보 노출 없음.
- 수신자는 **본인이 관심종목에 등록하고 알림을 켠 사용자**로 한정된다. 임의 사용자에게 보낼 수 없다.

---

## 7. 배포 영향

| # | 항목 | 필요 |
|---|---|---|
| 1 | DB 마이그레이션 | **불필요** — 매수·매도 타입이 이미 enum에 있음 |
| 2 | server 재배포 | 필요 (`signal.create` + 트리거 함수) |
| 3 | realtime 재배포 | 필요 (새 내부 라우트 + 발송 로직) |
| 4 | 앱 재배포 | **불필요** — 설정 UI·알림 화면이 이미 있음 |
| 5 | env 추가 | **불필요** — 기존 `STREAM_TOKEN_SECRET`·`REALTIME_INTERNAL_URL` 재사용 |

> **푸시가 실제로 도달하려면** `user_push_token`에 행이 있어야 한다. 토큰 등록은 이미 구현돼 있으나(`use-push-registration.ts` → `notification.registerPushToken`), **에뮬레이터에서는 발급되지 않는다** — `push.ts:32`의 `if (!Device.isDevice) return null`. 검증은 **실기기 + development build**로 해야 한다(팀장님 문서 §테스트 제약과 동일).

---

## 8. 검증 계획

1. 실기기로 로그인 → `user_push_token`에 행이 생기는지 확인
2. 그 계정으로 종목 A를 관심종목 등록, 매수 시그널 알림 ON
3. 관리자 계정으로 종목 A **매수** 시그널 작성
4. 확인:
   - 단말에 알림 도착
   - `notification_history`에 `type='buy_signal'`, `delivery_status='sent'`
5. 매수 알림을 **끄고** 다시 작성 → 안 와야 하고 이력도 안 남아야 함
6. 관심종목에서 **빼고** 작성 → 안 와야 함
7. 시그널 **삭제** → 푸시 없어야 함(G5)

---

## 9. 결정 필요 사항

| # | 내용 | 추천 |
|---|---|---|
| **D1** | **관망(hold) 푸시를 지원할까?** `notification_type` enum에 `hold_signal` 추가 = **DB 마이그레이션**이 필요하고, Postgres 특성상 **되돌리기 어렵다**(`DROP VALUE` 없음) | **포함하기로 확정(2026-07-28).** 팀장님 문서 `docs/native/api/signals.md:7-11`이 "액션 3종과 알림 설정이 일치한다"고 정의하므로 enum 누락은 의도가 아니라 빠뜨린 것으로 판단. 마이그레이션 `0013`으로 추가. 되돌리기 어려운 점은 머지 전 확인 요청 |
| **D2** | 팀장님 문서는 **엔진이 생성한 시그널** 기준으로 쓰였다. **관리자 수동 작성**에도 같은 규칙을 적용하는 것을 승인하시는지 | 승인 요청. 지금은 수동 작성이 **유일한 경로**이고, 엔진이 생기기 전까지 알림 폭탄 위험도 없다 |
| **D3** | 엔진이 생긴 뒤 **자동 생성 시그널도 푸시할지** — 하루 수십 건이면 알림 폭탄이 된다. 엔진 착수 시점에 다시 결정할 사항 | 엔진 RFC로 미룸 |
| **D4** | 알림 문구 `"${종목명} 매수 시그널"` + 본문 = 시그널 제목. 속보(`"${종목명} 속보"`)와 같은 꼴 | 이대로 |

---

## 10. 작업 계획

이슈 **#31**·PR **#32**(시그널 목록 실시간 갱신)와 **같은 브랜치**에서 진행한다. 건드리는 파일(`signal.ts`, `realtime-trigger.ts`, `internal.ts`)이 겹쳐 별도 PR로 나누면 충돌이 나고 리뷰가 중복된다. PR 제목·본문을 "시그널 문제(추가·삭제·생성 시 알림)"로 확장한다.
