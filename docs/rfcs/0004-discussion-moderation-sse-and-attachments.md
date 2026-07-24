# RFC 0004 — 토론방 목록 SSE화 · 관리자 모더레이션 · 즐겨찾기/검색 · 첨부파일 (discussion-moderation-sse-and-attachments)

- 상태: **Draft — 설계 결정 전부 완료. 남은 건 사용자 수동 선행작업(버킷 생성·DB migrate·패키지 설치·재배포)뿐.**
- 작성일: 2026-07-24 (결정 반영 갱신: 2026-07-24, D11·D12·D13 팀장 결정문서 반영)
- 범위: (1) 토론 **목록** 폴링 → **SSE**, (2) 관리자 **메시지 숨김·삭제**(길게눌러 → 다중선택 → 일괄), (3) 좋아요 **하트化 + 별 즐겨찾기 + 즐겨찾기 탭 + 방 검색** + RFC 0003 편집·삭제 버튼 **위치·크기 개선**, (4) 관리자 **멤버 조회·mute·차단**, (5) **이미지·파일 첨부**. **이 문서는 설계서만 — 소스/DB/마이그레이션/패키지/env 변경 없음.**
- 검증: 실제 코드(`file:line`) 근거(2026-07-24 워킹트리) + 팀장 결정문서(`docs_vscodereader`의 D11-D13-attachment-decisions.md) + Expo 공식문서. 확정은 §19 표에 값으로 명시, 미결은 §18·§19에 질문으로 남김.
- 관련 코드:
  - `packages/db/src/schema/discussion.ts`, `packages/db/src/schema/auth.ts`, `packages/db/src/schema/stock-resource.ts`
  - `packages/api/src/routers/discussion.ts`, `packages/api/src/index.ts`, `packages/api/src/lib/realtime-trigger.ts`, `packages/api/src/lib/stock-resource.ts`
  - `apps/realtime/src/services/news-hub.ts`, `apps/realtime/src/services/news.ts`, `apps/realtime/src/plugins/news.ts`, `apps/realtime/src/plugins/internal.ts`, `apps/realtime/src/services/news/thumbnail.ts`, `apps/realtime/src/services/stock-icons.ts`
  - `apps/server/src/plugins/stream-token.ts`, `apps/native/src/hooks/use-news-stream.ts`, `apps/native/src/lib/stream-token.ts`
  - `apps/native/src/screens/discuss/index.tsx`, `apps/native/src/screens/discussion-room/index.tsx`, `apps/native/src/screens/stock-detail/index.tsx`, `apps/native/src/components/cards.tsx`, `apps/native/src/components/ui.tsx`, `apps/native/src/components/icons.tsx`, `apps/native/app.json`, `apps/native/package.json`
- 참조: ADR 0001·0002·0003, RFC 0002·0003, CONTEXT.md, AGENTS.md, apps/native/CLAUDE.md, docs/internal/working-charter.md, [Expo — Installing Expo SDK Libraries](https://docs.expo.dev/workflow/using-libraries/#expo-sdk-libraries).

> ⚠️ 참고 이미지(`C:\Users\user\Pictures\chat source`)는 WSL에서 직접 열람 불가. 요청서·결정문서의 텍스트 명세 기준으로 설계.

> 📌 **요청서 대비 변경 2건**(사용자·팀장 결정, 2026-07-24):
> - **#3 좋아요 "제거" → "유지"**: 하트化 + 별 즐겨찾기 + 즐겨찾기 탭 + 방 검색. 이유: 인기 탭 정렬이 좋아요 기반(`discussion.ts:260-264`).
> - **#5 이미지 선택 "시스템 갤러리/Photo Picker" → "앱 내부 커스텀 그리드"**: `expo-media-library`로 기기 사진 조회 후 자체 그리드. **이미지 선택에 사진 접근 권한이 필요해짐**(파일은 여전히 시스템 문서 피커라 권한 불요). 원 요청서의 "시스템 피커·권한 최소화"는 **파일에만** 그대로 적용.
> **팀장님과 공유된 스펙이면 이 두 변경도 공유 필요.**

---

## 1. 배경과 문제

관리자가 토론방을 만들고 사용자가 대화하는 구조는 동작한다(Phase 4). RFC 0003으로 관리자 편집·삭제 + 카운트 실시간화(폴링)까지 설계됐다. 남은 문제:

1. **목록 카운트가 5초 폴링이라 즉시성이 낮고 상시 트래픽 발생**(`discuss/index.tsx:34,101`). → **목록 SSE 전환**. 방 메시지는 폴링 유지(ADR 0001).
2. **관리자가 부적절 메시지를 가리거나 지울 수단이 없다.** 현재 "작성자 또는 관리자"가 한 건씩 삭제만(`discussion.ts:128-134`); **숨김·다중선택 일괄** 없음.
3. **좋아요 아이콘 애매(엄지)** → **하트**化 + **개인 즐겨찾기(별)** + **즐겨찾기 탭** + **방 검색**. RFC 0003 편집·삭제 버튼 재배치·확대.
4. **관리자가 방 멤버를 관리(조회/mute/차단)할 수단이 없다.**
5. **메시지에 이미지·파일을 못 붙인다.** 메시지는 `content` 텍스트 한 컬럼(`discussion.ts:61`), 앱에 피커 패키지 0(`package.json:44-56`).

### 팀장님 규칙과의 관계
- 쓰기=server, 실시간 수신=realtime(규칙 #9). / DB=generate+migrate, push 금지(규칙 #1). / native 구조(`apps/native/CLAUDE.md`). / PR만(규칙 #6).
- **신규 패키지는 `pnpm expo install`로만**(규칙 #8/#6-4, Expo 공식문서) — `pnpm add` 금지(버전 충돌).
- ADR 0001: 기능 1(목록 SSE)은 SSE 유예를 **목록 한정** 재검토. 방 메시지 폴링 유지 → ADR 0001에 각주만(§19-D0).

---

## 2. 현재 구현 분석 (코드 근거)

### 2-1. 토론 스키마 (`packages/db/src/schema/discussion.ts`)
- enum 1개(`discussionSentiment` up/neutral/down, `:17-21`), 테이블 4개.
- `discussionMessage`(`:51-78`): `id(serial PK), roomId, userId, content(text notNull, :61), deletedAt(nullable, :62-64 소프트삭제), createdAt`. **`type`·첨부·가림 컬럼 없음.**
- `discussionRoomMember`(`:83-95`): `userId, roomId, joinedAt` — 복합 PK(`:94`). **mute/block 컬럼 없음.**
- `discussionRoomLike`(`:100-109`): `userId, roomId, likedAt`. **즐겨찾기 개념 없음**(신규).
- 자식 FK 전부 cascade.

### 2-2. 토론 API (`packages/api/src/routers/discussion.ts`)
- 읽기 `rooms`(`:194`, 3탭)/`room`(`:294`)/`messages`(`:353`). 카운트 `counts()`(`:38-52`): `likesCount`(`:41`), `membersCount`, `repliesCount`(`:43`, **deletedAt 미필터**), `lastMessageAt`(`:47-50`). `liked`=`likedExpr()`(`:54-58`).
- 탭 정렬(`:188-270`): **인기=`likesCount DESC, lastMessageAt DESC`**(`:260-264`) / 관심=관심종목 방(비로그인 `[]` `:210`) / 최신=`lastMessageAt DESC, createdAt DESC`. `rooms`가 `stockName`(`stockMaster.htsKorIsnm`)을 leftJoin(`:238`) → 검색 재사용.
- 삭제 `deleteMessage()`(`:105-139`) 소프트(`:135-138`), 멱등(`:125`), `isOwner||isAdmin`(`:128`), `protectedProcedure`(`:533`). 투영 `content:null`(`:396`).
- 송신 `sendMessage()`(`:67-103`) 방확인 → 멤버 `onConflictDoNothing()`(`:81-85`) → insert. **mute/block 게이트 없음.** input `content` 1..1000(`:518`).
- 좋아요 `toggleLike()`(`:144-182`)+절차(`:544`) — **유지**.
- adminProcedure: `createRoom`(`:571`)/`updateRoom`(`:597`)/`deleteRoom`(`:631` 하드+cascade). 도메인 재export(`:639-645`).

### 2-3. realtime SSE (`apps/realtime`)
- 허브 2종: QuoteHub(업스트림 ref-count) / **NewsHub(업스트림 없음)**. `broadcastRefresh()`(`news-hub.ts:64`)=전 클라 새로고침. SSE 라우트(`plugins/news.ts:64-120`), 제너레이터(`news.ts:22`). 트리거 루프: `refreshRealtimeNews()`(`realtime-trigger.ts:60`)→`/internal/refresh-news`(`internal.ts:51`)→`broadcastRefresh()`(`:76`)→클라 무효화(`use-news-stream.ts:120`). 토큰 HMAC(`stream-token`), `?token=`. 다중 인스턴스 한계(`hub.ts:9-13`), realtime `min=max=1` 수동 관례(`DEPLOY.md:62`).

### 2-4. native 토론 화면
- 목록 `discuss/index.tsx`: 탭 `hot/watch/recent`(`:23-28`), 기본 `watch`(`:72`), 렌더 `:160-163`. 폴링 `:34,101`. 좋아요 `:104-129,188`. RFC 0003 워킹트리 `deleteRoom`(`:115-121`)+admin `:181-186`.
- 행 `cards.tsx` `DiscussionRoomRow`(`:787-966`): 좋아요 `Icon.thumbsUp`+`likesCount`(`:915-927`, `filled`/`t.upStrong`), 댓글(`:930-935`), 사람수(`:936-941`). 편집/삭제(`:855-883`). **`discuss`+`stock-detail`(`:501`) 공유.**
- 방 안 `discussion-room/index.tsx`: `RoomHeader`(`:268-363`) 나가기 X(`:356-360`); `MessageBubble`(`:142-231`) 롱프레스→삭제 Alert(`:805-821`); `isDeleted`(`:157-159,214`); `Composer`(`:451-530`) pill만(`+` 없음). 폴링 `:39`.

### 2-5. 권한 / 업로드 / 아이콘 / 첨부 역량
- admin `adminProcedure`(`index.ts:41`, 비관리자 `FORBIDDEN` `:30-32`). `user.role`(`auth.ts:12`). 전역 ban(`auth.ts:13-15`) — 방별엔 부적합.
- GCS 업로드 **`apps/realtime`에만**(`stock-icons.ts:261-285`, `news/thumbnail.ts:35-72`, `new Storage()`=ADC). 버킷 env realtime만(`env/realtime.ts:41,45`). **전부 공개읽기(서명URL 0개)**. jimp(sharp 회피). server-import 가능 = URL 빌더(`api/lib/stock-resource.ts:7-22`). server엔 `@google-cloud/storage`·`jimp`·multipart 없음. 저장 객체 행 모델 = `stock-resource.ts:13-45`(bucket/key/mime/size...).
- 아이콘(`icons.tsx`): **`star`(`:39` filled)·`search`(`:48`) 존재**, `thumbsUp`(`:131`), **`heart` 없음(추가)**. plus/close/trash/pencil/check 존재.
- 첨부 역량: `expo-image-picker`·`expo-document-picker`·`expo-file-system`·`expo-media-library`·`expo-image` **전부 미설치**(`package.json:44-56`). `app.json`에 android.permissions·iOS 사진권한 문자열 없음(`:14,19-26,29-34`).

---

## 3. 목표
- **G1** 목록 SSE 갱신(방 메시지 폴링 불변).
- **G2** 관리자 메시지 롱프레스 → [숨김]/[삭제] → 다중선택 → 하단 pill 일괄. 삭제=소프트, 숨김=7사유+가림 문구. 서버 admin 검증.
- **G3** 좋아요 하트化(빨강) + 별 즐겨찾기(노랑) + 즐겨찾기 탭 + 돋보기 검색(전체·부분일치·이름/결합종목) + 편집·삭제 버튼 재배치·확대.
- **G4** 햄버거 → 멤버 목록 → mute/차단(서버 admin 검증, 방별).
- **G5** `+` → [파일] → [파일에서 선택]/[앨범에서 선택]. 이미지=앱 내부 커스텀 그리드(최대 8·합계 10MB), 파일=시스템 문서 피커(1개·20MB). 텍스트/이미지/파일=동일 `Message`, `type` 구분.

## 4. 범위
목록 SSE / 메시지 숨김·삭제(일괄, 7사유) / 좋아요 하트化·별 즐겨찾기·즐겨찾기 탭·검색 + 버튼 재배치 / 멤버 목록·mute·차단 / 이미지(다중)·파일(단일) 첨부.

## 5. 제외 범위
방 메시지 SSE/WS(ADR 0001 후속) / presence / 뉴스 독점·시그널 Admin / Expo 푸시 / 전역 밴 / 동영상 첨부(현 결정=이미지·파일) / 이 문서의 실제 코드·DB·패키지 변경.

## 6. 기존 코드·UI 재사용 대상

| 대상 | 위치 | 재사용 |
|---|---|---|
| NewsHub+`broadcastRefresh` / SSE 라우트·제너레이터 / 내부 트리거 / server 트리거 / native 구독훅 / 스트림토큰 | `news-hub.ts:64`, `news.ts:22`, `plugins/news.ts:64`, `internal.ts:51`, `realtime-trigger.ts:60`, `use-news-stream.ts`, `stream-token` | 복사 → 디스커션 SSE 3종 + `refreshRealtimeDiscussion` + `use-discussion-list-stream` |
| **좋아요 토글 기계** | `discussion.ts:144-182,544`, `likedExpr:54-58` | 복사 → `toggleFavorite`/`favoritedExpr` |
| 좋아요 junction | `schema/discussion.ts:100-109` | 복사 → `discussion_room_favorite`·`discussion_room_block` |
| 소프트삭제 / admin 게이트 / 멤버 테이블 | `discussion.ts:108-139,396`, `index.ts:41`, `schema:83-95` | 일괄삭제/숨김 마스킹 · 모더레이션 · mute=`mutedUntil` |
| **GCS 업로드 / fetch→jimp→save / 저장객체 행** | `stock-icons.ts:261-285`, `news/thumbnail.ts:35-72`, `stock-resource.ts:13-45` | server-측 이식(규칙 #9) → 첨부 업로드 + `moneyroad_image` 컬럼 모델 |
| URL 빌더(server-import) | `api/lib/stock-resource.ts:7-22` | 첨부 URL |
| **star·search 아이콘** | `icons.tsx:39,48` | 그대로(추가 불요) |
| thumbsUp+filled / IconButton / isDeleted / 원형버튼 / 트레일링행 / RN Modal 시트 / Alert / 숫자입력 / 탭 배열 | `cards.tsx:915-927,855-883`, `ui.tsx:40`, `discussion-room:157-159,509-526,813-834`, `price-alert-sheet.tsx:38-160`, `price-alert-controls.tsx:320-343`, `discuss:23-28` | 하트·햄버거·`+`·블라인드·확인창·mute시간·즐겨찾기탭 |

**신규 불가피**: DiscussionHub/SSE 3종, `discussion_room_favorite`·`discussion_room_block`·**`moneyroad_image`(공용)**·**`discussion_message_image`(연결)** 테이블, 멤버 목록·MemberRow, 롱프레스 액션시트, 다중선택+Checkbox+pill, 숨김 7사유 라디오, 검색창, **커스텀 이미지 그리드**, 공유 `<Sheet>`/`Button`/`Checkbox`, 이미지그리드/파일 말풍선, `heart` 아이콘, server 업로드·프록시 엔드포인트.

---

## 7. 기능별 상세 설계

### 7-1. 목록 폴링 → SSE (기능 1) — [D1 정해짐]
RFC 0002 뉴스 패턴 복제: `DiscussionHub`(NewsHub 복사)+`GET /stream/discussion-list?token=`(익명 허용)+`POST /internal/refresh-discussion-list`. server `refreshRealtimeDiscussion(reason)`를 목록 영향 mutation(createRoom/updateRoom/deleteRoom/send/deleteMessage/toggleLike/leaveRoom)에서 fire-and-forget. native `use-discussion-list-stream` → `invalidateQueries(discussion.rooms.key())`, **`discuss:34,101` 폴링 제거**. **payload 없는 refresh 핑**(+~1s coalescing). `toggleFavorite`는 개인상태라 목록 트리거 불요(본인만 무효화). 다중 인스턴스: `min=max=1`에서만 정확(기존 허브 동일).

### 7-2. 메시지 숨김·삭제 (기능 2) — [D2·D3 정해짐]
관리자 롱프레스 → 액션시트 [숨김][삭제] → 선택모드(체크박스, 다중) → 하단 파란 pill `숨김 (N)`/`삭제 (N)`(0개 비활성) → 삭제=즉시 / 숨김=7사유 단일선택+[저장][취소] → 가림 문구.
- **삭제 = 소프트삭제**(기존 `deletedAt` 재사용, 일괄 `UPDATE...WHERE id=ANY`, 멱등). 하드는 방 삭제만.
- **숨김 = 신규 `blindedAt/blindedBy/blindReason` + 원문 보존**(마스킹 `:396` 패턴). 컴플레인 시 원문+사유+처리자 조회 가능(감사). `deletedAt`과 별개 상태.
- 사유 7종(라디오 단일선택, `blind_reason.png` 실제 문구): ①혐오/차별적/생명경시/욕설 표현입니다 ②스팸홍보/도배입니다 ③음란물입니다 ④불법정보를 포함하고 있습니다 ⑤청소년에게 유해한 내용입니다 ⑥개인정보가 노출되었습니다 ⑦불쾌한 표현이 있습니다.
- 클라: admin 롱프레스면 커스텀 액션시트(본인 단건 삭제는 기존 Alert). 선택모드 + `MessageBubble` 체크박스(`:174-183`) + pill(`Composer` 자리 스왑 `:891-900`). 가림=`isDeleted` 패턴 복제.
- 서버 admin 검증 + 숨김 메시지의 첨부 접근 차단(§10).

### 7-3. 좋아요 하트化 + 별 즐겨찾기 + 즐겨찾기 탭 + 검색 (기능 3) — [D8 정해짐]
> 좋아요 **유지**(인기 정렬 기반). 원 요청서 "제거" 폐기.

- **(a) 하트**: `cards.tsx:915` `Icon.thumbsUp`→**`Icon.heart`(신규)**. 안 누르면 회색 빈 하트, 누르면 **빨간 채움**(`filled`+`t.upStrong`). 카운트 유지.
- **(b) 별 즐겨찾기(신규)**: 하트 **좌측**에 `Icon.star`(기존) 토글. 찍으면 **노란 채움**(노랑 토큰; 없으면 추가). 개인상태(로그인). 개수 없음. 줄 순서 **[별][하트+수][댓글][사람]**. 관심 종목 탭(자동)과 다른 개념(수동).
- **(c) 즐겨찾기 탭(신규)**: `discuss:23-28`에 `favorite`(즐겨찾기) 추가 → 인기/관심 종목/최신/**즐겨찾기**. 별 찍은 방만. 로그인 필요(비로그인 `[]`). 정렬 `lastMessageAt DESC`.
- **(d) 검색(신규)**: 탭 줄 **우측 `Icon.search`**(기존) → 검색창. 입력+엔터: **전체 방 대상**(탭 무시), **부분일치**(substring), 방 `name` 또는 결합종목명(`htsKorIsnm`, `rooms` 기존 leftJoin `:238`), **띄어쓰기 무시**("삼성전자"↔"삼성 전자", 양쪽 공백 제거 ILIKE).
- **(e) 편집·삭제 버튼**: 헤더 우측 시간 옆(`cards.tsx:855-883`) → **이름/설명 사이 높이 우측 끝, 더 크게, 텍스트와 분리**. 카드 `[텍스트 컬럼(flex:1)][버튼 컬럼(고정폭 중앙)]`. `IconButton`·`Icon.pencil`·`Icon.trash`, 터치영역 ≥44×44, admin 전용.

### 7-4. 멤버 조회·mute·차단 (기능 4) — [D4·D5·D6·D7 정해짐]
**멤버 목록**: `RoomHeader`(`:287-360`) 나가기 X 앞 햄버거 → `[메뉴][X]`. 멤버만(미디어/고정/설정 없이). admin 전용(라우트/UI+서버). 멤버=누적(ADR 0002). 목록 API 신규. MemberRow 신규.

**Mute**: 롱프레스 → [mute] → **[숫자 입력] + [시간][일] 토글 버튼**(예 `7`+시간=7시간, `1`+일=1일). 최대 **24시간(=1일)**.
- **방별** `discussionRoomMember.mutedUntil = now + N시간`. **정수 시간, 1~24h(최대 1일)**. 뮤트 중 그 방 **모든 전송(텍스트/이미지/파일) 차단, 열람 허용**. 서버 `sendMessage`가 타입 무관 검사. 자동만료 + 수동 unmute. **본인/타관리자 불가**.

**차단**: 롱프레스 → [차단하기] → "정말 이 {사용자명}님을 강퇴하시겠습니까?"(확인/취소, Alert).
- 확인 시: ① **멤버 자동 제거**, ② **신규 `discussion_room_block` 테이블** `blockedUntil = now + 7일`(멤버행 삭제돼도 유지).
- 방은 **목록엔 보이되 입장 시 "차단된 방입니다"**(`room`/`messages` 읽기 게이트).
- **7일 자동해제**(만료 후 재입장→첫 전송 시 멤버 재생성, ADR 0002) + 수동 unblock. **본인/타관리자 불가**.
- 차단 기간: mute와 동일 **[숫자 입력]+[시간][일] 토글**(예 `7`+일=7일). **최대 7일.** 만료 시 자동 재입장 허용.

### 7-5. 이미지·파일 첨부 (기능 5) — [D9·D10·D11·D12·D13 정해짐, 팀장 결정문서]
**모델**: 텍스트/이미지/파일=동일 `Message`, `type`만 구분. **한 메시지 = 하나의 type**. 이미지·파일 **혼합 금지**.
- `type` 후보(이름은 기존 규칙): `text` / `image`(이미지 1~8개) / `file`(파일 1개).

**(a) 이미지 — 다중(최대 8), 커스텀 그리드**
- **개수 ≤ 8, 원본 크기 합계 ≤ 10MB** (둘 다 동시 적용 — 독립 제한). 압축 후 기준 아님(원본 합계).
- **선택 UI = 시스템 갤러리가 아니라 앱 내부 커스텀 그리드**: `expo-media-library`로 기기 최근 사진 조회 → 자체 그리드. 다중 선택 + 선택 순번 표시 + 해제 시 순번 재정리 + 8개 상한 + 합계 실시간 계산 + 10MB 초과 선택 차단·안내 + 전송 전 개수/총용량 검증.
- **저장**: 이미지는 **공용 `moneyroad_image` 테이블**(신규, 채팅 전용 아님 — 배너/뉴스/게시글 재사용) + **`discussion_message_image` 연결테이블(다대다, `sort_order`)**. 메시지 조회 시 선택 순서대로 반환.
- **말풍선(그리드 규칙, 사용자 확정)**: 1~8개를 **가로 최대 3 · 세로 최대 3** 그리드로. **n×n(정사각) 가능하면 우선**(1→1×1, 4→**2×2**). 그 외엔 **가로 먼저 채우고(행당 최대 3) 위→아래**: 2→[2], 3→[3], 5→[3,2], 6→[3,3], 7→[3,3,1], 8→[3,3,2]. (세로 먼저 늘리지 않음.) 비율 달라도 셀 안 넘침, 입력창/다른 말풍선 레이아웃 불변.
- **부분 실패**: 이미지별 독립 업로드. 5개 중 3 성공/2 실패 시 → 성공 3개로 **새 `image` 메시지 즉시 전송**, 실패 2개만 재시도. 재시도 성공분은 **기존 메시지에 합치지 않고 별도 새 메시지**. 전부 실패면 메시지 미생성. 서버도 8개·10MB 재검증.

**(b) 파일 — 단일(1개)**
- 파일 메시지 = **1개**, **파일당 ≤ 20MB**. 초과는 업로드 시작 안 함(클라+서버 검증).
- **선택 UI = 시스템 문서 피커**(`expo-document-picker`, Android SAF / iOS 문서 브라우저). 선택 URI 접근 방식 → **광범위 저장소 권한 불요**, 실제 경로 하드코딩 금지.
- **저장**: 버킷 저장 + 메시지에 파일 키/경로 + 표시정보(파일명/MIME/크기). 성공 시 `file` 메시지 생성, 실패 시 미생성+재시도.

**(c) 권한 — 이미지와 파일이 다름**
- **이미지(커스텀 그리드)**: `expo-media-library` **사진 접근 권한 필요 — 확정(사용자·팀장님)**. 최초 진입 시 OS 권한 요청 → 허용 시 최근 이미지 조회, 거부 시 안내(설정에서 재허용), 제한적 접근 OS는 허용된 사진만. (초기에 "권한 불요" 방향을 검토했으나 커스텀 그리드로 확정 → 사진 권한 필요.)
- **파일(문서 피커)**: 광범위 저장소 권한 불요(선택 항목만 스코프 접근). — 원 요청서 핵심(불필요 권한 금지) 유지.

**(d) 업로드/서빙 — [D9·D10 정해짐]**: 규칙 #9 → 업로드는 **server**(현 GCS 코드 realtime→server 이식). **비공개 버킷 + 서버 프록시(방 사람만) — 확정.** `moneyroad_image`엔 **객체 키** 저장, 채팅 이미지·파일은 **프록시로 서빙**(공개 URL 아님). 공용 `moneyroad_image`가 배너 등 공개 맥락에도 쓰이면 그쪽만 공개 URL(키 저장은 공용, 서빙만 맥락별). 숨김·삭제 메시지 첨부는 프록시에서 차단.
  - **버킷 생성 = 사용자 직접(GCP Cloud Shell)**: 비공개 버킷 생성 + **server 서비스계정에 버킷 접근 권한(objectAdmin) 부여** + Cloud Run server에 `CHAT_ATTACHMENT_BUCKET` env 설정. (종목아이콘·뉴스썸네일 인프라 절차와 동일 — RFC 0002 §9-3.) 코드는 env로만 참조(이름에 안 묶임).

---

## 8. DB 변경 후보 (⚠️ 컬럼/enum 이름 CANDIDATE — 기존 규칙 확인 후 §19-D14 확정. 절차 generate→migrate)

| 대상 | 변경 | 결정 |
|---|---|---|
| `discussionMessage` 가림 | `blindedAt/blindedBy(→user set null)/blindReason` + 원문 보존 | **D3** |
| `discussionMessage` type | `type` pgEnum(`text`/`image`/`file`, default `text`) | **D11** |
| `discussionMessage` 파일(단일) | `fileBucket/fileKey/fileMime/fileSize/fileName`(파일 메시지 1개) | **D11** (파일은 1:1이라 메시지 컬럼. moneyroad_file 별도 테이블은 미정) |
| `moneyroad_image`(신규·공용) | `id, bucket/objectKey, fileName, mime, byteSize, width, height, uploaderId, createdAt` — **채팅 전용 아님(배너/뉴스/게시글 재사용)**. `stock-resource.ts:13-45` 모델 참고 | **D11** |
| `discussion_message_image`(신규·연결) | `messageId, imageId(→moneyroad_image), sortOrder`. 다대다, 순서 보존 | **D11** |
| `discussionRoomMember` mute | `mutedUntil timestamp nullable`(+선택 `mutedBy`) | **D4** |
| `discussion_room_block`(신규) | `userId, roomId, blockedBy, blockedAt, blockedUntil`, 복합 PK | **D6/D7** |
| `discussion_room_favorite`(신규) | `userId, roomId, createdAt` — `discussion_room_like` 복사 | **D8** |
| `discussionRoomLike` | **유지** | **D8** |
| `packages/env/src/server.ts` | 비공개 첨부 버킷 env(예 `CHAT_ATTACHMENT_BUCKET`) | **D10** |

- 카운트: `repliesCount`(`:43`)에서 삭제·숨김 제외 정정, `membersCount`는 차단 멤버가 멤버행 삭제로 자동 제외.
- 전부 nullable/default/신규 → **비파괴**(백필 불필요). 좋아요 유지라 파괴적 변경 없음. `moneyroad_image`는 공용이므로 discussion 스키마와 분리된 위치(예 별도 스키마 파일)에 둘지 §19-D14에서 확인.

## 9. API 변경 후보 (도메인 함수 + `discussionDomain` 재export)
- **즐겨찾기(D8)**: `toggleFavorite({roomId})`(`toggleLike` 복사) + `rooms` 출력 `favorited`(=`favoritedExpr`) + `favorite` 탭 + 검색 입력 `q?`(탭 무시, `name` OR `htsKorIsnm` 공백제거 ILIKE).
- **모더레이션(admin, D2/D3)**: `hideMessages({roomId, messageIds[], reason})`/`unhideMessages`/`deleteMessages`(일괄 소프트, 멱등).
- **멤버(admin, D4/D6)**: `roomMembers`/`muteMember(hours 1~24)`/`unmuteMember`/`blockMember(멤버 삭제+7일)`/`unblockMember`. self/타admin 거부.
- **첨부(D11/D12)**: 이미지 메시지 생성 = 성공한 이미지 id 배열(≤8, 합계≤10MB, **서버 재검증**) + `sortOrder`로 `discussion_message_image` insert + `moneyroad_image` insert(업로드 시). 파일 메시지 = 파일 1개(≤20MB, **서버 재검증**). `sendMessage`에 `type`+첨부 인자 + **mute/block 게이트**. 부분실패·재시도는 클라 주도(서버는 성공분만 메시지화).
- **읽기 게이트(차단)**: `room`/`messages`에 차단 사용자 → "차단된 방" 응답.
- **realtime 트리거**: `refreshRealtimeDiscussion(reason)`.

## 10. realtime/SSE 변경 후보
- **SSE(D1)**: `DiscussionHub`+`streamDiscussionList`+`GET /stream/discussion-list`+`POST /internal/refresh-discussion-list`+`server.ts` 등록 + server 트리거. payload 없는 refresh 핑. realtime 재배포.
- **첨부 업로드(D9/D10)**: **server**(규칙 #9, 현 GCS 코드 realtime→server 이식). 클라 multipart → `apps/server`(`@fastify/multipart`+`@google-cloud/storage`+`jimp` 추가) → **실제 타입(메타/매직바이트)+크기 검증**(§12) → 이미지 jimp 재인코딩(EXIF 제거)·`moneyroad_image` insert / 파일 그대로 → GCS(비공개) save → DB 키 저장. **서빙 = 프록시**(방 열람권 확인 후 스트림, 서명URL/새 IAM 불요).

## 11. Native UI 및 사용자 흐름
- 목록(1): 폴링→SSE 구독(UX 불변).
- 좋아요/즐겨찾기/검색(3): 행 `[별][하트+수][댓글][사람]`; 탭 `인기/관심 종목/최신/즐겨찾기`+우측 돋보기.
- 모더레이션(2): 롱프레스(admin)→[숨김][삭제]→선택모드→하단 pill→(숨김 시 7사유)→가림 말풍선.
- 멤버(4): `[햄버거][X]`→멤버 목록→롱프레스 [mute](1~24h 시트)/[차단하기](Alert).
- 첨부(5): `[+][입력][전송]`→`+` 시트 [파일]→[파일에서 선택](문서 피커, 파일 1개)/[앨범에서 선택](**커스텀 그리드**, 사진 권한, 최대 8·합계 10MB, 순번). 이미지 그리드 말풍선 / 파일 말풍선(파일명·크기·다운로드).

## 12. 권한·보안
- 이중 검증: 모더레이션/멤버 = native admin + 서버 adminProcedure. 송신 게이트: mute/block 서버 `sendMessage`(타입 무관). self/타admin 보호.
- **첨부 형식·크기(D12 팀장님)**: 서버가 **실제 타입(메타/매직바이트, 클라 content-type 불신)+크기 검증** 후 허용외·초과 **거부**. **이미지 합계 ≤10MB(≤8장)·파일 ≤20MB(1개)**. 허용 allowlist(제안: 이미지 jpeg/png/webp/gif; 문서 pdf/txt/md/doc/docx/xls/xlsx/ppt/pptx/hwp/hwpx(한글) — 조정 가능). 이미지 jimp 재인코딩(EXIF 제거). 파일명 안전화(경로/제어문자 제거, 저장키=UUID).
- **첨부 접근(D10 비공개)**: 서버 프록시로만(방 열람권 확인) → URL 유출·숨김 후 접근 차단.
- **사진 권한(D11 커스텀 그리드)**: `expo-media-library` 사진 접근 권한 요청/거부 처리(§7-5c). 파일은 문서 피커라 광범위 권한 불요. **광범위 저장소 권한(`READ/WRITE_EXTERNAL_STORAGE`) 추가 금지**(모던 타깃·Play 정책).
- SSE: 스트림 토큰 HMAC, 익명 허용 시 payload null.

## 13. 마이그레이션 및 기존 데이터 영향
- 가림/type/파일/mute 컬럼 + `moneyroad_image`·`discussion_message_image`·`discussion_room_favorite`·`discussion_room_block` 테이블 = **전부 비파괴 추가**. 기존 메시지 `type='text'`. 백필 불필요. 좋아요 유지=파괴 없음.
- 절차 `pnpm db:generate`→`pnpm db:migrate`(로컬 psql 직접, [[local-db-migration-drift]]). `migrations/**` 수기수정 금지.
- 패키지: `apps/native`에서 **`pnpm expo install expo-media-library expo-document-picker expo-image`**(+필요 시 `expo-file-system`). `pnpm add` 금지. 설치 후 **네이티브 재빌드**(새 네이티브 모듈).

## 14. 실패·복구·엣지케이스

| 상황 | 처리 |
|---|---|
| SSE 실패/백그라운드/realtime 다운 | 재연결/백오프/복귀 재사용, 최소 재포커스 refetch. min=max=1 위반 시 일부 누락(Redis 전 스케일아웃 금지). |
| 이미 삭제/가림 재처리 | 멱등(대상 상태 아닌 행만). |
| mute/차단 만료 | `mutedUntil`/`blockedUntil < now` 자동 해제(차단 만료 후 첫 전송 시 멤버 재생성). |
| 차단 재입장/재전송 | block EXISTS(`blockedUntil>now`) → "차단된 방입니다". |
| 이미지 부분 업로드 실패 | 성공분 새 메시지, 실패분만 재시도(재시도 성공=별도 새 메시지). 전부 실패=메시지 미생성. |
| 이미지 8개 초과 / 합계 10MB 초과 | 선택 단계 차단·안내 + 서버 재검증. |
| 이미지+파일 혼합 시도 | 금지(한 메시지 1 type). |
| 파일 20MB 초과 | 업로드 시작 안 함(클라+서버). |
| 사진 권한 거부 | 그리드 미표시 + 설정 재허용 안내. |
| 업로드 성공 후 메시지 insert 실패 | 고아 파일 → insert 성공 후 확정/실패 시 삭제. |
| 긴 이름/설명+버튼 | 텍스트/버튼 컬럼 분리로 불변. |
| stock-detail 공유 행 | 하트·별 자동 적용(즐겨찾기 탭·검색은 discuss 전용). |

## 15. 구현 예상 파일 목록 (승인·결정 후)
**realtime**: `services/discussion-hub.ts`·`services/discussion-list.ts`·`plugins/discussion.ts`(신규), `plugins/internal.ts`(+refresh), `server.ts`(+등록).
**server/api**: `realtime-trigger.ts`(+트리거), `routers/discussion.ts`(+즐겨찾기/검색/모더레이션/멤버/mute/block, `sendMessage` 게이트·첨부), `apps/server`(첨부 업로드+프록시 라우트 + GCS 이식 모듈), `env/src/server.ts`(+버킷).
**db**: `schema/discussion.ts`(가림·type·파일·mute + favorite·block 테이블) + **공용 `moneyroad_image` 스키마**(위치 §19-D14) + `discussion_message_image` → generate/migrate.
**native**: `hooks/use-discussion-list-stream.ts`(신규), `screens/discuss/index.tsx`(SSE·즐겨찾기 탭·검색·toggleFavorite), `stock-detail/index.tsx`(하트·별), `components/cards.tsx`(하트·별·버튼 재배치), `screens/discussion-room/index.tsx`(롱프레스 메뉴/선택모드/pill/가림/`+`/햄버거), `screens/discussion-room/components/*`(액션시트·사유picker·선택pill·멤버목록·mute시트·**커스텀 이미지 그리드**·이미지그리드/파일 말풍선 — 신규), `components/ui.tsx`(공유 `<Sheet>`/`Button`/`Checkbox`), `components/icons.tsx`(**heart** — star·search 기존), `utils/nav.ts`(멤버목록 라우트), `app.json`(사진 권한 문자열 — media-library, 광범위 저장소 권한 금지)/`package.json`(**`pnpm expo install`로** media-library·document-picker·expo-image[+file-system]). **`expo-image-picker`는 안 씀.**

## 16. 테스트 계획
- 타입/린트: `pnpm check-types`, native `npx tsc --noEmit`, `pnpm check`.
- 서버 단위: 일괄 숨김/삭제 멱등, mute/block 거부·만료(24h/7일), self/타admin, 검색(공백/종목명), toggleFavorite, **첨부 이미지 8개·합계 10MB·파일 20MB 서버 재검증**, 실제 타입 검사.
- SSE 수동(에뮬 2대): A 변경 → B 폴링 없이 갱신; 재연결.
- 첨부: 부분 업로드 실패→성공분 새 메시지, 커스텀 그리드 권한 흐름, 비공개 프록시 열람권, 숨김 후 첨부 차단, 문서 피커 권한 불요.
- 회귀: 방 메시지 폴링·본인 단건 삭제·하트/별 stock-detail.

## 17. 단계별 구현 순서 (권장)
1. **기능 3 UI**(하트化+별 즐겨찾기+탭+검색+버튼 재배치, favorite 테이블/`toggleFavorite`/검색).
2. **기능 1(목록 SSE)** — realtime 3종+트리거+native 훅. realtime 재배포.
3. **기능 2(숨김/삭제)** — 가림 스키마+admin 절차+선택모드.
4. **기능 4(멤버/mute/차단)** — mute·block 스키마+admin 절차+멤버 목록+게이트.
5. **기능 5(첨부)** — 패키지(`pnpm expo install`) → `moneyroad_image`·연결·type·파일 스키마 → server 업로드/프록시 → native 커스텀 그리드·문서 피커·말풍선. mute 전송차단이 첨부에도 적용되게 4 이후. 네이티브 재빌드.

각 단계 = 이슈 → 브랜치 → 커밋 → PR(규칙 #6).

## 18. Open Questions (내 몫 — 추천안대로, 다르면 알려줘)
- 비공개 프록시=서버 스트림(서명IAM 없음) 추천. / `repliesCount` 삭제·숨김 제외 추천. / 공유 `<Sheet>` 추출(gorhom 후속) 추천. / `Button`·`Checkbox`·`heart` 신설 추천. / 멤버목록 커서 페이지네이션. / 노랑 토큰 추가. / 개수별 이미지 그리드 셀 규칙=참고 화면+기존 디자인 우선(임의 금지). / 파일 저장을 메시지 컬럼 vs `moneyroad_file` 별도테이블 — 추천: 1:1이라 메시지 컬럼(간단). / `expo-file-system`은 실제 필요 확인 시만.

## 19. 결정 사항 (⚠️ = 확인 대기)

| # | 항목 | 결정 |
|---|---|---|
| D0 | ADR 0001 | **정해짐**: ADR 0001에 "목록 SSE 예외" 각주(정식 ADR 없음). |
| D1 | SSE 이벤트 | **정해짐**: payload 없는 refresh 핑(+coalescing). |
| D2 | 일괄 삭제 | **정해짐**: 소프트삭제 재사용. |
| D3 | 숨김 저장 | **정해짐**: `blindedAt/blindedBy/blindReason`+원문 보존. |
| D4 | mute | **정해짐**: 방별 `mutedUntil`, 정수 시간 **1~24h**, 자동만료+수동해제, 전송(텍/이미지/파일) 차단·열람 허용. |
| D5 | mute/차단 대상 | **정해짐**: 본인·타관리자 불가. |
| D6 | 차단 의미·기간 | **정해짐**: 멤버 자동제거 + 방 목록엔 보임 + 입장 시 "차단된 방입니다" + 자동해제 + 수동해제. **기간=[숫자]+[시간][일] 입력, 최대 7일.** |
| D7 | 차단 저장 | **정해짐**: 신규 `discussion_room_block`(`blockedUntil`). |
| D8 | 좋아요/즐겨찾기/검색 | **정해짐**: 좋아요 유지+하트 / 별 즐겨찾기+`discussion_room_favorite`+`toggleFavorite` / 즐겨찾기 탭 / 검색(전체·부분일치·이름+결합종목·공백무시). |
| D9 | 첨부 업로드 | **정해짐**: server 프록시 multipart(서버 이식). |
| D10 | 첨부 접근 | **정해짐**: **비공개 버킷 + 서버 프록시**(방 사람만). `moneyroad_image`는 키 저장·채팅은 프록시 서빙. **버킷 생성=사용자(Cloud Shell)** + server SA 권한 + env. |
| D11 | 첨부 개수·구조 | **정해짐(팀장)**: **이미지 ≤8(합계≤10MB), 파일 1(≤20MB), 혼합 금지**. 공용 `moneyroad_image`+`discussion_message_image`(순서). **이미지 선택=앱 내부 커스텀 그리드**. 부분실패=성공분 새 메시지+실패분 재시도. |
| D12 | 첨부 형식·크기 | **정해짐(팀장)**: 이미지+문서 둘 다, 이미지 합계≤10MB·파일≤20MB, 서버 실타입(메타/매직바이트)+크기 검증 후 거부, 이미지 jimp 재인코딩. |
| D13 | Expo 패키지 | **정해짐(팀장 승인+공식문서 확인)**: `expo-media-library`(커스텀 그리드)+`expo-document-picker`+`expo-image`(+필요 시 `expo-file-system`). **`expo-image-picker` 안 씀**. `apps/native`에서 **`pnpm expo install`**(버전 자동·`pnpm add` 금지), 설치 후 네이티브 재빌드. |
| D14 | 이름/위치 | **정해짐(내가 확정)**: 기존 규칙 따름(물리 snake_case·Drizzle camelCase·enum 소문자값). `moneyroad_image`=신규 파일 `packages/db/src/schema/image.ts`, `discussion_message_image`=`discussion.ts`. (팀장 별도 네이밍 규칙 문서 없음.) |

## 20. 승인 후 구현 체크리스트
- [ ] **확인 대기 없음(설계 결정 완료).** / **선행(사용자·수동)**: 비공개 버킷 생성(Cloud Shell)+server SA권한+env, DB migrate, `pnpm expo install`+네이티브 재빌드, realtime 재배포.
- [ ] (3) `cards.tsx` 하트·별·버튼 재배치, favorite/`toggleFavorite`/검색/즐겨찾기 탭, `discuss`·`stock-detail` 배선 → tsc/biome.
- [ ] (1) realtime SSE 3종+등록, server 트리거, native 훅+폴링 제거 → realtime 재배포.
- [ ] (2) 가림 스키마, admin `hide/unhide/deleteMessages`, native 선택모드/pill/가림.
- [ ] (4) mute·block 스키마, admin `roomMembers/mute/unmute/block/unblock`+`sendMessage` 게이트+읽기 차단, native 멤버목록/mute/차단.
- [ ] (5) `pnpm expo install`(media-library·document-picker·expo-image), `moneyroad_image`·연결·type·파일 스키마, server 업로드+프록시(실타입/크기 검증·jimp), native 커스텀 그리드·문서 피커·이미지그리드/파일 말풍선, app.json 사진 권한(광범위 저장소 권한 금지), 네이티브 재빌드.
- [ ] `docs/rfcs/README.md`에 0004 행 추가. `pnpm check`+`check-types`. **PR까지만(규칙 #6).**

---

## 요약
- **정해짐(13)**: 목록 SSE=핑(D1) / 삭제 소프트+숨김 별도칼럼·원문보존(D2·D3) / mute 방별 1~24h(D4) / 차단 멤버제거+별도테이블+7일자동해제(D6·D7) / self·타admin 불가(D5) / 좋아요 유지→하트+별 즐겨찾기+탭+검색(D8) / 첨부 비공개+서버프록시(D9·D10) / **이미지≤8·합계10MB·파일1·20MB·공용 moneyroad_image+연결·커스텀 그리드(n×n 우선·가로먼저·최대3×3)·부분실패 재시도(D11)** / 서버 실타입+크기검증(D12) / **패키지 media-library+document-picker+expo-image, `pnpm expo install`(D13)**.
- **확인 대기: 없음(설계 결정 전부 완료).** 남은 건 수동 선행작업(버킷·migrate·설치·재배포).
- **재사용**: 뉴스 SSE / 좋아요 토글→즐겨찾기 / 소프트삭제 / admin 게이트 / GCS 업로드(server 이식) / star·search 아이콘.
- 이 문서 단계는 **RFC 파일 갱신만**(소스/DB/패키지 무변경).
