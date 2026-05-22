# 마이 화면 — 필요 API

- 화면: `apps/native/src/screens/mypage/index.tsx`
- 구성: 프로필(아바타·이름·이메일) + 통계 3종 + 메뉴 그룹(알림 관리/투자 환경/
  계정) + 버전·로그아웃 + 면책 고지

대부분 정적 메뉴(네비게이션)이고, 동적 데이터는 **프로필·통계·미읽음 배지**뿐이다.

## 필요 API

| # | 용도 | 엔드포인트 | 반환 | 소스 |
|---|---|---|---|---|
| 1 | 프로필 | `user.me` | `{ name, email, avatar? }` | 🔑 Auth |
| 2 | 통계 3종 | `user.stats` | `{ watchedCount, activeSignals, unreadCount }` | 🔵 DB + ⚙️ |
| 3 | 미읽음 배지 | `notifications.unreadCount` | `{ count }` | 🔵 DB |
| 4 | 알림 설정 | `settings.get` / `settings.update` | `NotificationSettings` | 🔵 DB |
| 5 | 로그아웃 | `authClient.signOut()` | — | 🔑 Auth(구현됨) |

- 통계 항목(화면): 관심 종목 수 / 활성 시그널 수 / 안 읽은 알림 수.
  - `watchedCount` = 🔵 DB 관심종목 개수
  - `activeSignals` = ⚙️ 엔진 활성 시그널 건수
  - `unreadCount` = 🔵 DB 미읽음 알림 (배지와 동일 값)
- `notifications.unreadCount`는 홈 헤더 dot과 공유 → 동일 쿼리 키로 캐시 재사용.

## 메뉴 → 라우트 매핑 (대부분 네비게이션)

| 그룹 | 항목 | 이동 | 비고 |
|---|---|---|---|
| 알림 관리 | 알림함 | `alerts` | badge=unread |
| 알림 관리 | 시그널/뉴스·공시/가격 알림 설정 | `settings/[page]` | `settings.update` 토글 |
| 투자 환경 | 관심 종목 관리 | `watchlist` | value=관심종목 수 |
| 투자 환경 | AI 시그널 학습 데이터 / 화면 표시 설정 | `settings/[page]` | |
| 계정 | 내가 쓴 글·답글 | `settings/[page]` | `discuss.myPosts` 필요 |
| 계정 | 공유·초대 / 공지·고객지원 | `settings/[page]` | 정적/외부 |

> 알림 설정 화면(`screens/settings`)은 `settings.get`으로 현재 토글 상태를 읽고
> `settings.update`로 저장한다. 푸시 알림 토큰 등록(Expo Push)은 별도 검토.

## 상호작용
- 프로필 편집(`프로필` 버튼) → 편집 화면(미구현) + `user.update`.
- 로그아웃 → better-auth `signOut` 후 온보딩/로그인으로.

## 미정 / 결정 필요
- [ ] `user.stats` 단일 엔드포인트 vs 개별(`watchlist.count` 등) 조합.
- [ ] 알림 설정 스키마(`NotificationSettings`) 필드 정의 + 푸시 토큰 등록.
- [ ] "내가 쓴 글·답글"(`discuss.myPosts`) 제공 여부.
- [ ] 프로필 수정(`user.update`)·아바타 업로드 범위.
