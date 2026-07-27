# RFC 0005 — 첨부 저장·열기 (갤러리 저장 · 파일 다운로드 · 시스템 앱으로 열기) (attachment-save-and-open)

- 상태: **Draft — 팀장님 결정 필요 항목 §9 참조.**
- 작성일: 2026-07-27
- 범위: RFC 0004 기능5(이미지·파일 첨부)의 **후속**. 받은 첨부를 사용자가 (1) **이미지 → 갤러리 저장**, (2) **파일 → 기기에 다운로드 저장**, (3) **첨부 탭 → 폰에 설치된 앱으로 열기** 할 수 있게 한다. 추가로 RFC 0004 구현에서 발견된 **런타임 버그 2건**(§5)과 **iOS 미동작**(§4-4)을 함께 바로잡는다. **Android/iOS 기능 차이 없음이 요구사항.**
- 검증: 실제 코드(`file:line`) + **에뮬레이터 실측**(`adb`, §10). 추측한 부분은 §9에 질문으로 남김.
- **§11 용어 정정**: RFC 0004 기능5 + 본 RFC 구현이 CONTEXT.md `_Avoid_: Chat` 을 위반해
  `chat-*` 를 쓰고 있었다. 파일·함수·라우트·GCS prefix·env·SecureStore 키를 `discussion-*` 로
  전수 정정했다(**DB 마이그레이션 0건**, 기존 GCS 객체 **이동·삭제 없음**).
- 관련 코드:
  - `apps/server/src/plugins/discussion-media.ts` (업로드/프록시)
  - `packages/api/src/routers/discussion.ts` (메시지 첨부 payload)
  - `apps/native/src/lib/discussion-upload.ts`, `apps/native/src/lib/discussion-download.ts`(신규)
  - `apps/native/src/screens/discussion-room/index.tsx`, `.../components/{file-bubble,image-grid-bubble,image-viewer(신규),photo-grid-picker}.tsx`
  - `apps/native/src/components/icons.tsx`, `apps/native/app.json`(iOS 권한 문자열 — §4-4)
- 참조: **RFC 0004 §151·§155·§158·§191·§198·§202·§203·§204**, `docs/internal/working-charter.md`(규칙 #5·#9, 6-4), `apps/native/CLAUDE.md`, CONTEXT.md, AGENTS.md.

---

## 1. 배경

RFC 0004 기능5로 첨부를 **보내는** 쪽은 만들었지만, **받은 뒤**에 할 수 있는 게 없다.
RFC 0004 §198은 파일 말풍선에 "파일명·크기·**다운로드**"를 명시했으나 다운로드 동작은
구현되지 않았고, 이미지도 말풍선 썸네일이 전부다.

사용자 요청(2026-07-27):

1. 보낸 사진을 탭 → 전체화면 → `⋮` → **갤러리에 저장**
2. 파일 말풍선에 **다운로드 버튼**(다른 사람이 보낸 파일은 내 기기에 없으므로)
3. 저장 전 파일명 탭 → **내용 보기**
4. 저장 후 파일명 탭 → **폰에 설치된 앱으로 실행**

## 2. RFC 0004와의 관계 — 지켜야 하는 제약

| 조항 | 내용 | 본 RFC의 준수 방식 |
|---|---|---|
| **§151** | 파일은 시스템 문서 피커, **실제 경로 하드코딩 금지** | 저장 위치를 절대경로로 박지 않고 **SAF 디렉터리 피커**로 사용자가 1회 선택(§4-2) |
| **§158·§191·§203** | 첨부 접근은 **서버 프록시로만**, **서명URL 불요**, 목적은 **URL 유출 차단** | 바이트는 **앱이 세션 쿠키로** 프록시에서 받는다. 외부 앱에는 **로컬 `content://`** 만 넘긴다(§4-3) |
| **§204** | **광범위 저장소 권한 추가 금지** | **Android 매니페스트 권한 0건 추가** — `READ/WRITE_EXTERNAL_STORAGE` 없음. SAF·MediaLibrary만 사용. ⚠️ `app.json` 자체는 **변경됐다**(iOS usage string + `expo-media-library`/`expo-sharing` 플러그인 — §12-2). 다만 `android` 블록은 무변경이고, prebuild 산출물의 `android.permissions` 가 변경 전/후 완전히 동일함을 확인했다 |
| **§155** | 이미지 = `expo-media-library` 사진 권한 (이미 승인됨) | 갤러리 저장도 같은 권한 재사용. 거부 시 저장 차단(§4-1) |
| **§202** | 파일명 안전화(경로·제어문자 제거) | 저장 파일명에 동일 규칙 적용 |
| 차터 #9 | 쓰기·비즈니스 로직은 `apps/server` | 서버 변경은 버그 수정뿐. 신규 엔드포인트 없음 |

> ⚠️ **본 RFC는 §203을 개정하지 않는다.** 초안 구현 과정에서 "브라우저로 열기"를 위해
> 서명 URL(`POST /media/token` + `?token=`)을 넣었다가 §203 위반으로 **되돌렸다**.
> 브라우저 열람이 필요하면 §9-D3 결정이 선행되어야 한다.

## 3. 설계 개요

```
[말풍선]
 ├ 이미지 탭 → 앱 내 전체화면 뷰어 → ⋮ → 갤러리에 저장 → moneyroad 앨범(§12)
 └ 파일
    ├ ↓ 버튼  → 프록시 다운로드 → Android=(SAF로 고른 폴더)/moneyroad/file/<파일명>
    │                             iOS=앱 문서함/moneyroad/file/<파일명>(§12)
    └ 이름 탭 → 저장돼 있으면 그 파일을, 아니면 캐시로 받아 → content:// → 시스템 앱
                                                      └ 열 앱 없음 → 안내 + [저장하기]
```

바이트는 **항상** `GET /media/discussion-*`(세션 인증 프록시)에서만 온다. 서버 신규 API 없음.

## 4. 상세

### 4-1. 이미지 → 갤러리 저장

- 전체화면 뷰어(신규 `components/image-viewer.tsx`): 보낸사람·시각·`n/총`, 좌우 스와이프, 우상단 `⋮`.
- `⋮` → **[갤러리에 저장]** 하나만 (사용자 확정: 참고 화면의 나머지 항목은 범위 밖).
- 절차: `MediaLibrary.requestPermissionsAsync()` → 거부 시 **저장 차단**(사용자 확정) →
  프록시에서 앱 **캐시**로 받음 → `createAssetAsync` → **`getAlbumAsync("moneyroad")` 선행** →
  있으면 `addAssetsToAlbumAsync`, 없으면 `createAlbumAsync("moneyroad", asset, false)` → 캐시 삭제(§12).
- **경로 하드코딩 없음**: 앨범 *이름*만 넘기고 실제 경로는 OS가 정한다(Android 실측 `Pictures/<앨범명>`, §10).
- 확장자 판단을 위해 메시지 payload의 이미지 항목에 **`mime` 추가**(§6).

### 4-2. 파일 → 다운로드 저장 (SAF)

- 최초 1회 `Directory.pickDirectoryAsync()`로 **사용자가 폴더 선택** → 그 `content://` 트리 아래
  `moneyroad/file/` 생성 → 파일 저장.
- 선택한 트리 URI는 `expo-secure-store`에 보관해 재사용. Android가
  `takePersistableUriPermission`을 걸어주므로 앱 재시작 후에도 유효
  (`FilePickerContract.kt:44` 확인).
- SAF는 문서 ID가 불투명해 **경로 조합이 불가**하다. 하위 폴더/파일은 `list()`로 이름 대조 후
  없을 때만 `createDirectory()`/`createFile()`로 만든다(중복 생성 방지).
- **왜 표준 폴더 자동 저장이 아닌가**: (a) §151이 절대경로 하드코딩을 금지하고,
  (b) expo-file-system은 대상 경로에 `java.io.File.canWrite()`를 묻는데 **아직 없는 경로는 항상 false**라
  샌드박스 밖 신규 폴더 생성이 거부된다(`FileSystemPath.kt:110-127`, `FilePermissionService.kt:29-39`).
  content URI는 이 검사를 통과한다(`FileSystemPath.kt:117-120`).

> ⚠️ **함정 1 — SAF 목적지로는 `downloadFileAsync` 가 안 된다. 그런데 권한 검사는 통과한다.**
> `File.downloadFileAsync(url, dest)` 는 먼저 `dest.validatePermission(WRITE)` 를 부르는데
> (`FileSystemModule.kt:58-59`), 그 안의 `checkPermission()` 이 **content URI면 검사 없이 `true`**
> 를 돌려준다(`FileSystemPath.kt:127-130`). 그래서 여기까진 멀쩡히 통과한다. 그리고 응답을 받은
> 직후 목적지를 `to.javaFile` 로 읽는데(`FileSystemModule.kt:78-81`), 이 게터가 content URI면
> `Exception("This method cannot be used with content URIs: …")` 로 **던진다**
> (`FileSystemPath.kt:67-72`). 즉 **권한은 통과하고 바이트를 다 받은 뒤 쓰기 직전에 죽으며,
> 메시지가 권한 문제처럼 보이지 않아 원인을 찾기 어렵다.**
>
> → 그래서 Android 구현은 **캐시(`file://`)로 먼저 받은 뒤 바이트를 옮긴다**:
> `downloadToCache()` → `temp.bytes()` → `dir.createFile()` → `target.write()`
> (`apps/native/src/lib/discussion-download.ts:442-456`). 첨부 상한이 20MB이므로
> (서버 `FILE_MAX_BYTES`, `apps/server/src/plugins/discussion-media.ts:22`) 한 번 메모리에 올려도
> 안전하다. **iOS는 이 우회가 필요 없다** — 앱 문서함은 일반 파일 시스템이라 목적지로 바로 받는다
> (`discussion-download.ts:412-424`).
>
> ⚠️ **함정 2 — 순서가 `createFile()` → `write()` 여야 한다.** `write()` 는 대상이 없으면
> 내부적으로 `create()` 를 부르는데 SAF에서는 그게 던진다. 또 `createFile()` 은
> `createDirectory()` 와 마찬가지로 **중복을 검사하지 않아** 같은 이름이 있으면
> `"report (1).pdf"` 가 계속 늘어난다 → 쓰기 전에 `list()` 로 찾아 지운다
> (`discussion-download.ts:444-451`).

### 4-3. 첨부 열기 (§203 준수)

- 저장돼 있으면 그 파일, 아니면 **앱 캐시**로 프록시 다운로드(저장 폴더에 남기지 않음 = "저장 안 한 상태" 유지).
- `File.contentUri`(expo-file-system **modern API의 동기 프로퍼티**) → `content://` 획득
  (`apps/native/src/lib/discussion-download.ts:538`). 캐시 파일(`file://`)이면 Expo FileProvider URI를,
  SAF 저장본이면 그 `content://` 를 그대로 돌려준다(`FileSystemFile.kt:127-131` → 어댑터의 `getContentUri`).
- **왜 legacy `getContentUriAsync()` 가 아닌가**: 그 함수는 `scheme == "file"` 일 때만 변환하고
  그 밖(= SAF 저장본의 `content://`)은 `FileSystemUnreadableDirectoryException` 으로 **던진다**
  (`FileSystemLegacyModule.kt:412-424`). "저장본이 있으면 그걸 연다"가 이 경로를 그대로 타므로
  legacy 함수로는 구현이 성립하지 않는다.
- `IntentLauncher.startActivityAsync(ACTION_VIEW, { data, type, flags: FLAG_GRANT_READ_URI_PERMISSION })`.
- **서버로 나가는 요청은 앱이 세션 쿠키로 한 것뿐이고, 외부 앱에는 로컬 참조만 넘어간다.**
  URL이 밖으로 나가지 않으므로 §203의 "URL 유출" 위험이 없다.
- `text/markdown`은 처리 앱이 없어 `text/plain`으로 낮춰 넘긴다(§10 실측).

### 4-4. 크로스 플랫폼 패리티 (Android ↔ iOS)

**RFC 0004 기능5는 현재 iOS에서 전혀 동작하지 않는다.** 본 RFC에서 함께 바로잡는다.

| 항목 | Android | iOS 현재 | iOS 해결 |
|---|---|---|---|
| 앨범 그리드(RFC 0004 §144) | 동작 | 권한 문구가 **영문 기본값**("Allow $(PRODUCT_NAME) to access your photos") — 종료되지는 않지만 심사·UX상 부적절 (§12에서 정정) | `app.json`에 **한국어** usage string. **RFC 0004 §233이 이미 지시한 항목("`app.json`(사진 권한 문자열 — media-library)")의 구현 누락** |
| 갤러리 저장 | MediaLibrary 앨범 | 위와 같음(`NSPhotoLibraryAddUsageDescription` 영문 기본값) | `savePhotosPermission`으로 한국어 문구 지정 |
| 앨범 이름 | 중첩 디렉터리 가능(`moneyroad/image`) | **iOS 앨범은 중첩 불가** — 슬래시가 이름에 그대로 박힌다 | **양쪽 모두 평면 `moneyroad`로 통일**(Android도 중첩이면 조회가 깨진다 — §12) |
| 파일 저장 | SAF, 권한 영속 | 피커는 뜨지만 **권한이 앱 세션 한정**(`FileSystem.d.ts` `pickDirectoryAsync` 주석) | 앱 Documents에 저장 + `UIFileSharingEnabled`·`LSSupportsOpeningDocumentsInPlace` → **파일 앱에 앱 표시 이름(`머니로드`) 폴더로 노출**. 재시작해도 유지 |
| 파일 열기 | `expo-intent-launcher` | **동작 없음** — 해당 패키지는 `"platforms": ["android"]` | `expo-sharing`(Quick Look / 공유 시트) |

> §204가 금지하는 것은 **Android의 `READ/WRITE_EXTERNAL_STORAGE`**다. iOS usage string과
> `UIFileSharingEnabled`는 해당하지 않으며, 오히려 RFC 0004 §233이 app.json에 사진 권한
> 문자열을 넣도록 지시하고 있다. Android 매니페스트 권한은 **0건 추가**를 유지한다.

구현은 `Platform.OS` 분기로 하되, **호출부(화면)는 플랫폼을 몰라야 한다** — 분기는
`src/lib/discussion-download.ts` 안에 가둔다.

### 4-5. 열 수 있는 앱이 없을 때

`startActivityForResult` 실패 시 promise가 reject된다(`IntentLauncherModule.kt:84-89`).
잡아서 **"이 파일을 열 수 있는 앱이 없어요" + [취소][저장하기]** 안내 → 저장하면 나중에 열 수 있다.
hwp/hwpx·오피스가 여기 해당한다(§10).

## 5. 함께 고치는 RFC 0004 런타임 버그 2건

두 건 모두 **첨부 기능이 한 번도 동작한 적 없게** 만들던 결함이다.

1. **업로드 전건 500** — `evlog`가 매 요청 `request.log`를 자체 로거로 교체하는데
   (`evlog/fastify/index.mjs:13-15`) 그 로거엔 `debug`가 없다. `@fastify/multipart`는
   `request.file()` 첫 줄에서 `this.log.debug(...)`를 호출한다(`index.js:219`) → `TypeError` → 500.
   → discussion-media 플러그인 컨텍스트 한정 `onRequest` 훅으로 진단용 레벨만 채운다.
   공용 `apps/server/src/server.ts`(팀장님 파일)는 건드리지 않는다.
2. **이미지 프록시가 빈 본문 200** — async 라우트 핸들러가 `undefined`를 반환하면 Fastify가
   `reply.send(undefined)`를 한 번 더 호출해(`wrap-thenable.js:31-42`) `content-length`를 `0`으로
   덮고 빈 본문을 보낸다(`reply.js:619-628`). → `streamObject`가 reply를 반환하고 라우트가 `return` 한다.

추가로 **앨범 그리드에서 사진 선택 실패**(`getAssetInfoAsync`가 Android에서 항상 full-info로
EXIF GPS를 읽어 `ACCESS_MEDIA_LOCATION` 없이 reject, `AssetUtils.kt:166-190`)를
**권한 추가 없이**(§204) 해당 호출 제거로 해결한다. Android는 `asset.uri`가 이미 `file://`다.

### 5-1. 버그는 아니지만 반드시 알아야 할 함정 2건 (expo-file-system SAF)

아래는 우리 코드의 결함이 아니라 **플랫폼/라이브러리 제약**이다. 모르면 §4-2 구현을 "더 단순하게"
되돌렸다가 그대로 깨진다. 다음 사람을 위해 근거와 함께 남긴다.

| # | 함정 | 근거(`file:line`) | 구현이 피해 간 방법 |
|---|---|---|---|
| **T1** | `File.downloadFileAsync` 의 **목적지가 SAF `content://` 이면 죽는다.** 권한 검사(`checkPermission`)는 content URI를 **무조건 통과**시켜 놓고, 바이트를 다 받은 뒤 `to.javaFile` 게터가 `"This method cannot be used with content URIs"` 로 던진다 → **권한 오류처럼 보이지만 권한 문제가 아니다** | `FileSystemModule.kt:58-59`(권한) · `FileSystemPath.kt:127-130`(무조건 true) · `FileSystemModule.kt:78-81`(javaFile 접근) · `FileSystemPath.kt:67-72`(throw) | 캐시(`file://`)로 받은 뒤 `bytes()` → `createFile()` → `write()` — `apps/native/src/lib/discussion-download.ts:442-456`. iOS(앱 문서함)는 우회 불필요 — `:412-424` |
| **T2** | SAF에서 `write()` 는 대상이 없으면 `create()` 를 부르는데 그게 던지고, `createFile()`·`createDirectory()` 는 **중복 검사를 하지 않아** `"report (1).pdf"`·`"moneyroad (1)"` 이 늘어난다 | `discussion-download.ts:247-252`(디렉터리) · `:444-451`(파일) 주석 | 쓰기 전에 `list()` 로 같은 이름을 찾아 재사용(디렉터리)하거나 삭제(파일)한 뒤 `createFile()` 로 만든 문서에만 `write()` |

관련해서 열기 쪽에도 같은 성격의 제약이 있다 → **legacy `getContentUriAsync()` 는 `file://` 전용,
SAF 저장본에는 던진다**(§4-3, `FileSystemLegacyModule.kt:412-424`).

## 6. 변경 파일

| 파일 | 변경 |
|---|---|
| `apps/server/src/plugins/discussion-media.ts` | 버그 2건 수정 (§5) + 용어 정정 리네임(§11). **신규 엔드포인트 없음** |
| `packages/api/src/routers/discussion.ts` | 이미지 payload에 `mime` 추가(갤러리 저장 확장자 판단) + 첨부 URL 경로 정정(§11) |
| `apps/native/src/lib/discussion-download.ts` | **신규** — 갤러리 저장 / SAF 저장 / 캐시 열기 |
| `apps/native/src/lib/discussion-upload.ts` | `authHeaders` export (프록시 다운로드에 재사용) + 용어 정정 리네임(§11) |
| `.../components/image-viewer.tsx` | **신규** — 전체화면 뷰어 + `⋮` 저장 |
| `.../components/file-bubble.tsx` | 다운로드 버튼 + 상태(대기/진행/저장됨) |
| `.../components/image-grid-bubble.tsx` | 셀 탭 → 뷰어. payload `mime` 반영 |
| `.../components/photo-grid-picker.tsx` | `getAssetInfoAsync` 제거(§5) |
| `.../discussion-room/index.tsx` | 배선 |
| `apps/native/src/components/icons.tsx` | `download`·`moreVertical` 추가 (RFC 0004 §233과 동일 패턴) |
| `apps/native/package.json` | `expo-intent-launcher`(Android) · `expo-sharing`(iOS) (§8) |
| `apps/native/app.json` | iOS usage string 4종 + `expo-media-library`·`expo-sharing` 플러그인 (§4-4·§7·§12-2). **`android` 블록 무변경 = Android 권한 0건 추가** |
| `packages/env/src/server.ts` | env 키 **이름만** 정정 `CHAT_ATTACHMENT_BUCKET` → `DISCUSSION_ATTACHMENT_BUCKET`(§11). 타입·필수여부 그대로(`z.string().optional()`), 주석도 `chat attachments` → `DiscussionRoom attachments` |
| `apps/server/.env.example` | 새 키를 **주석 문서화 1블록 추가**(`# DISCUSSION_ATTACHMENT_BUCKET=`). 기존에 이 키 항목 자체가 없었으므로 리네임이 아니라 **신규 기재**다 |
| `apps/server/src/server.ts` | **팀장님 파일 — 내 blame 2줄만.** `import { registerDiscussionMediaPlugin } …`(`:13`) · `app.register(registerDiscussionMediaPlugin)`(`:52`). 함수명 정정(§11)에 따른 기계적 변경 |

### 6-1. 변경 없음 / 변경 있음 — 정확히

- **DB 변경 0건.** 마이그레이션·스키마 모두 손대지 않았다(§11-3).
- **Android 매니페스트 권한 0건 추가.** §204 준수, prebuild 전/후 `android.permissions` 동일로 검증(§12-2).
- **⚠️ env 는 변경됐다.** 초안의 "env 변경 없음"은 **틀렸다.** 항목 *개수*는 그대로지만
  (신규 env 항목 0건 · 삭제 0건) **키 이름이 바뀌었다**:
  `CHAT_ATTACHMENT_BUCKET` → `DISCUSSION_ATTACHMENT_BUCKET`.
- **⚠️ `app.json` 도 변경됐다.** iOS usage string 때문이다(§2 §204 행·§12-2). "무변경"이 아니라
  "**`android` 블록 무변경 / Android 권한 0건 추가**"가 정확한 표현이다.

> **왜 바꿨나 — 팀장님 문서가 내 RFC보다 우선하기 때문이다.**
> CONTEXT.md **Language › DiscussionRoom** 이 `_Avoid_: … Chat` 을 명시하는데, env 키
> (`CHAT_ATTACHMENT_BUCKET`)와 플러그인 함수명(`registerChatMediaPlugin`)이 `Chat` 이었다.
> **CONTEXT.md 는 팀장님이 직접 작성한 1순위 기준 문서이고, 본 RFC(= 내가 쓴 문서)의 "env 변경
> 없음" 같은 자기 약속은 그보다 아래다.** 그래서 초안의 약속을 깨고 이름을 고쳤다.
> 그 결과 변경된 곳은 아래 4곳뿐이다(§11-2):
>
> | 파일 | 변경량 | 비고 |
> |---|---|---|
> | `packages/env/src/server.ts` | 키 선언 1곳 + 주석 | 내 파일 범위 |
> | `apps/server/.env.example` | 주석 블록 1개 추가 | 값은 비워 둠 |
> | `apps/server/src/server.ts` | **2줄**(import·register) | **팀장님 파일** → **§9-D7 승인 항목** |
> | `apps/server/.env` | 키 이름 1줄 | 로컬 전용, `.gitignore` 대상이라 커밋 없음 |
>
> 반대로 **바꾸지 않은 것**: 버킷 *값* `moneyroad-chat-attachments` — GCP 리소스 이름이라
> 코드 범위 밖이다(§11-6).

## 7. 권한·보안

- **Android 신규 매니페스트 권한 0건** (§204 준수). `READ/WRITE_EXTERNAL_STORAGE` 추가 없음.
- iOS는 `app.json`에 usage string 추가가 **불가피**하다(없으면 OS가 앱을 종료시킴):
  `NSPhotoLibraryUsageDescription`(사진 조회 — RFC 0004 §233 누락분),
  `NSPhotoLibraryAddUsageDescription`(갤러리 저장),
  `UIFileSharingEnabled`·`LSSupportsOpeningDocumentsInPlace`(저장 파일을 파일 앱에 노출).
  `expo-media-library` 플러그인도 `plugins`에 등록한다.
- 이미지 저장: `expo-media-library` 사진 권한(§155에서 이미 승인) 재사용. 거부 시 저장 차단.
- 파일 저장: SAF — 사용자가 고른 트리에만 접근. 광범위 권한 불요(§151 정신).
- 첨부 바이트: 프록시(세션+방 열람권)로만. 숨김·삭제 첨부는 기존대로 프록시가 차단.
- 외부 앱에는 `content://` + 1회성 읽기 권한만. **서버 URL·토큰이 앱 밖으로 나가지 않는다.**
- 저장 파일명은 §202와 같은 안전화 규칙 적용.

## 8. 신규 의존성

| 패키지 | 플랫폼 | 용도 | 설치 |
|---|---|---|---|
| `expo-intent-launcher ~55.0.14` | Android 전용 | 저장/캐시 파일을 시스템 앱으로 열기(ACTION_VIEW + 읽기 권한 부여) | `pnpm expo install` (차터 6-4) |
| `expo-sharing ~55.0.22` | iOS(공용 API) | iOS에서 파일 열기 = Quick Look / 공유 시트 | `pnpm expo install` **(설치 완료 — §12)** |

- RN 기본 `Linking.openURL`은 인텐트에 `FLAG_GRANT_READ_URI_PERMISSION`을 붙이지 않아
  `content://`를 받은 앱이 읽지 못한다 → Android는 `expo-intent-launcher` 대체 불가.
- `expo-intent-launcher`는 `expo-module.config.json`이 `"platforms": ["android"]`이라
  iOS에서 쓸 수 없다 → iOS는 `expo-sharing` 필요.
- → **양 플랫폼 네이티브 재빌드 필요.**

## 9. 결정 필요 사항 (팀장님)

| # | 항목 | 제안 / 상태 |
|---|---|---|
| **D1** | `expo-intent-launcher`(Android) + `expo-sharing`(iOS) 추가 승인 — RFC 0004 §233 목록 밖 | 승인 요청. 각각 대체 수단 없음(§8) |
| **D2** | 파일 저장 위치 = Android **SAF 사용자 선택**(최초 1회) / iOS **앱 Documents + 파일 앱 노출** | 승인 요청. §151 때문에 절대경로 자동 저장은 불가. **사용자 선택 완료(2026-07-27): 이 안으로 진행** |
| **D3** | "저장 전 탭 → **브라우저**로 보기"를 지원할 것인가 | **비권장.** 서명 URL이 필요해 §203과 충돌. 대신 캐시+시스템앱으로 동일 목적 달성(§4-3). 지원한다면 최소 조건: 토큰을 messageId 1건에 바인딩 · 만료 1분 이내 · 1회용 |
| **D4** | 이미지 갤러리 앨범명 | **`moneyroad` 평면**으로 통일 제안 — iOS 앨범은 중첩 불가라 `moneyroad/image`는 슬래시가 이름에 박힌다(§4-4). **구현 반영 완료(§12). 상수 1곳(`GALLERY_ALBUM`)만 바꾸면 되게 해 두었으니 다른 이름을 원하시면 말씀만 주세요** |
| **D5** | 오피스·hwp를 열 앱이 없을 때 "저장 유도"로 끝낼지 | 제안대로. 브라우저도 렌더 못 하므로 우리가 더 할 수 있는 게 없음 |
| **D6** | `app.json`의 `ios.infoPlist`에 usage string 4종 추가 | **필요.** RFC 0004 §233이 지시했으나 구현 누락분. 다만 초안이 말한 "없으면 iOS가 앱을 종료시킨다"는 **사실이 아니었다**(§12-1) — 자동 적용 플러그인이 영문 기본 문구를 이미 넣고 있었다. 실제 필요는 (a) 한국어 문구, (b) 파일 앱 노출 키 2종. **`plugins` 배열은 건드리지 않았다**(§12-2). Android 권한 0건 추가 |
| **D7** | **CONTEXT.md 용어 규칙(`_Avoid_: Chat`)을 지키느라 불가피했던 두 변경을 승인하시는지** — (a) `apps/server/src/server.ts`(**팀장님 파일**) import·register **2줄**, (b) env 키 리네임 `CHAT_ATTACHMENT_BUCKET` → `DISCUSSION_ATTACHMENT_BUCKET`(`packages/env/src/server.ts` + `.env.example`) | 승인 요청. 초안은 "env·팀장님 파일 무변경"을 약속했으나, **CONTEXT.md 가 내 RFC보다 우선**이라 약속을 깼다(§6-1·§11-2). **되돌릴 경우**: 옛 env 키를 유지하면 env 변경은 0건이 되고 팀장님 파일도 1줄만 남지만 **env 키에 `Chat` 이 그대로 남는다.** 지금은 prod Cloud Run 에 이 키가 **아직 설정돼 있지 않아 리네임 비용이 0**이다(§11-4) — 나중에 붙인 뒤에 바꾸면 재배포가 필요해진다 |
| **D8** | **RFC 0004 §155와 §204가 서로 모순인 것을 어떻게 정리할지** — §155는 `expo-media-library` 채택을 "확정(사용자·팀장님)"이라 했고, §204는 "`READ/WRITE_EXTERNAL_STORAGE` 추가 금지"라고 했다. 그런데 이 라이브러리의 config plugin은 `legacyExpoPlugins`로 **자동 적용**되어 그 두 권한을 반드시 넣는다(`plugins` 배열과 무관). **두 조항은 동시에 만족할 수 없다.** | 문구 정정 제안. 실제 매니페스트는 안전하다 — 라이브러리 매니페스트가 두 권한에 **`maxSdkVersion="32"` 캡**을 걸어 Android 13+(앱 targetSdk 35+)에선 요청되지 않고, 실제로 쓰이는 건 §155가 요구한 모던 권한 `READ_MEDIA_IMAGES`다. 그래서 §204를 "**레거시 저장소 권한은 `maxSdkVersion` 캡이 걸린 상태만 허용, 사진 접근은 `READ_MEDIA_*` 모던 권한만 사용, `ACCESS_MEDIA_LOCATION`·`MANAGE_EXTERNAL_STORAGE`는 금지**"로 좁히는 것을 제안한다. **이 작업으로 추가된 Android 권한은 0건**이며, 위반은 RFC 0004 기능5(2026-07-24) 시점부터 존재했다 |
| **D9** | `.omc/**`를 biome 대상에서 제외한 위치 | `biome.json`의 **`overrides[]`에 항목 1개 추가**로 처리했다(차터 규칙 #4가 허용하는 유일한 수정 방식). 다만 팀장님은 같은 성격의 에이전트 도구 디렉터리(`!**/.claude`·`!**/.agents`·`!**/.codex`·`!**/.gemini`)를 **`files.includes`에서** 제외하고 있어, 관행대로면 `!**/.omc` 한 줄이 그쪽에 들어가는 게 일관된다. 규칙 #4를 지키려고 다른 자리에 넣었으니, **`files.includes`로 옮기라고 하시면 옮기겠다.** (`.omc`는 gitignore 대상이라 저장소엔 올라가지 않는다) |

## 10. 실측 기록 (2026-07-27, Android 16 / API 36 에뮬레이터)

- `Pictures/moneyroad/image/moneyroad-6.png` 앱 uid로 생성 확인 → **MediaLibrary 중첩 앨범명 동작**.
- `Download/moneyroad/file` 생성은 `Missing 'WRITE' permission`으로 실패 → §4-2 근거.
- `ACTION_VIEW` + `content://` 처리 앱 조회(`cmd package query-activities`):

| MIME | 처리 앱 |
|---|---|
| `image/jpeg` | Google Photos |
| `text/plain` | **Chrome**, htmlviewer |
| `text/markdown` | 없음 → `text/plain`으로 낮춤 |
| `application/pdf` | Google Drive |
| `xlsx` / `msword` / `x-hwp` | **없음** → §4-4 |

- Chrome은 `content://`도 처리한다(로컬 파일 뷰어로 동작). 단 **오피스는 렌더하지 못한다** —
  브라우저로 열어도 다운로드로 떨어지므로 §4-5의 한계는 방식과 무관하다.

> ⚠️ **iOS는 실측하지 못했다.** WSL 개발 환경에 iOS 시뮬레이터가 없다. §4-4의 iOS 항목은
> Expo/Apple 공식 동작 기준의 설계이며, **실기기 또는 시뮬레이터 검증이 필요하다.**
> 특히 (a) `NSPhotoLibrary*` 누락 시 종료, (b) `pickDirectoryAsync`의 세션 한정 권한,
> (c) `UIFileSharingEnabled`로 파일 앱 노출 — 이 3가지는 반드시 확인 후 상태를 갱신할 것.

---

## 11. 용어 정정 — `Chat` → `Discussion` (2026-07-27)

### 11-1. 무엇을 위반했나

CONTEXT.md **Language › DiscussionRoom** 은 이 도메인의 정본 용어를 `DiscussionRoom`으로
정하고 다음을 명시적으로 금지한다:

> `_Avoid_: Thread, Topic, Forum, Channel, **Chat**`

RFC 0004 기능5(첨부, 커밋 `a93c24d6`)와 그 후속인 본 RFC의 초기 구현이 파일명·함수명·
라우트·GCS 객체키 prefix·env 키·SecureStore 키 전반에 `chat` 을 썼다. **CONTEXT.md 위반이며,
CONTEXT.md는 팀장님이 직접 작성한 1순위 기준 문서다.** 아래와 같이 전수 정정했다.

### 11-2. 조치 내역

| 종류 | 이전 | 정정 |
|---|---|---|
| 파일 | `apps/server/src/plugins/chat-media.ts` | `discussion-media.ts` (`git mv` — 히스토리 보존) |
| 파일 | `apps/native/src/lib/chat-upload.ts` | `discussion-upload.ts` (`git mv`) |
| 파일 | `apps/native/src/lib/chat-download.ts` | `discussion-download.ts` (미커밋 신규라 `mv`) |
| 함수 | `registerChatMediaPlugin` | `registerDiscussionMediaPlugin` |
| 함수 | `uploadChatImage` / `uploadChatFile` | `uploadDiscussionImage` / `uploadDiscussionFile` |
| 함수 | `downloadChatFile` | `downloadDiscussionFile` |
| 라우트 | `POST /upload/chat-image` · `/upload/chat-file` | `/upload/discussion-image` · `/upload/discussion-file` |
| 라우트 | `GET /media/chat-image/:imageId` · `/media/chat-file/:messageId` | `/media/discussion-image/:imageId` · `/media/discussion-file/:messageId` |
| GCS 객체키 prefix | `chat/images` · `chat/files` | `discussion/images` · `discussion/files` |
| env 키 | `CHAT_ATTACHMENT_BUCKET` | `DISCUSSION_ATTACHMENT_BUCKET` |
| SecureStore 키 | `mr.chat-save-tree.v1` · `mr.chat-save-dir.v1` | `mr.discussion-save-tree.v1` · `mr.discussion-save-dir.v1` |
| 주석·로그 문자열 | `"chat media stream failed"` 등 | `discussion` 표현으로 교체 |

접두사는 기존 `discussion.ts` / `discussion-room/` 명명 관례에 맞춰 `discussion-*` 로 통일했다
(더 엄격히는 `discussionRoom-*` 이 정확하나 라우트·파일명이 길어져 실용성을 택했다 — **팀장님
확인 항목**).

### 11-3. 마이그레이션·데이터 영향

- **DB 마이그레이션 0건.** `/media/chat-*` URL을 저장하는 컬럼이 없다. `discussionMessage` 는
  `fileBucket/fileKey/fileMime/fileSize/fileName` 만, `moneyroadImage` 는 `bucket/objectKey` 만
  가지며, 첨부 URL은 `packages/api/src/routers/discussion.ts` 에서 **매 응답 런타임 생성**된다.
  `packages/db/src/migrations/**` 의 `chat` 문자열도 0건 → 차터의 migrations 수정 금지와 충돌 없음.
- **⚠️ 기존 GCS 객체를 옮기거나 지우지 않는다.** prefix 상수는 **업로드에서만** 쓰이고 읽기는
  DB에 저장된 `objectKey`/`fileKey` 를 그대로 쓴다. 따라서 옛 `chat/*` 객체는 계속 열리고,
  신규 업로드만 `discussion/*` 로 간다. **버킷에 두 prefix가 공존하는 것이 정상 상태이며,
  옛 객체를 이동·삭제하면 기존 첨부가 즉시 깨진다.**
- **SecureStore 키 변경**: 기기에 영속되는 값이라 키가 바뀌면 사용자가 고른 SAF 트리 URI 참조를
  잃고 저장 폴더를 1회 다시 고르게 된다. 해당 파일이 아직 미커밋·미배포라 **내 에뮬레이터 외
  영향이 없어 지금이 바꿀 수 있는 마지막 시점**이었다.

### 11-4. 배포 결합 — 세 가지를 같이 움직여야 한다

리네임이 **배포 단위를 묶어 버렸다.** 아래 3개는 따로 배포하면 깨진다.

| # | 대상 | 왜 묶이나 | 따로 하면 |
|---|---|---|---|
| 1 | **서버** | `/upload/discussion-image` · `/upload/discussion-file` 로 경로가 바뀜 | — |
| 2 | **앱(native)** | `/upload/*` **두 경로만 앱에 하드코딩**돼 있다(`apps/native/src/lib/discussion-upload.ts:73, 85`) | **서버만 먼저 배포하면 구버전 앱의 업로드가 404.** 반대로 앱만 먼저 배포해도 404 |
| 3 | **Cloud Run env** | env 키 이름이 `DISCUSSION_ATTACHMENT_BUCKET` 로 바뀜(§6-1) | 옛 키 `CHAT_ATTACHMENT_BUCKET` 만 남아 있으면 새 서버가 버킷을 못 읽어 첨부가 **503으로 꺼진다** |

- `/media/*` 는 **서버가 응답에 실어 준 path 를 앱이 그대로 쓰므로** 구버전 앱도 정상이다
  (`packages/api/src/routers/discussion.ts` 에서 매 응답 런타임 생성). 결합은 `/upload/*` 때문이다.
- **결론: 서버 + 앱 + Cloud Run env 를 한 배로 배포한다.** 앱은 `runtimeVersion.policy = "fingerprint"`
  에 네이티브 의존성이 늘어 **OTA 불가 · 스토어 빌드 필요**(§8·§12-2)라는 점도 같이 계획해야 한다.

> ✅ **지금은 실사용자 영향이 0이다.** prod Cloud Run `moneyroad-server` 에는 버킷 env 가
> **애초에 설정돼 있지 않아** 첨부 라우트가 `requireBucket()` 의 503으로 꺼져 있다. 즉 위 3번은
> "기존 값을 옮기는 작업"이 아니라 "**처음 설정할 때 새 키 이름으로 넣기만 하면 되는**" 상태다 —
> **리네임 비용이 0인 마지막 시점**(§9-D7). prod에 버킷을 붙일 때 키 이름을
> `DISCUSSION_ATTACHMENT_BUCKET` 으로 넣으면 끝이고, 값은 기존 버킷 이름
> `moneyroad-chat-attachments` 그대로다(§11-6).

### 11-5. 손대지 않은 것 — 팀장님 판단 사항

아래는 **팀장님(jonghyeon.kim)이 작성한 코드·문서**라 `git blame` 확인 후 **의도적으로 손대지
않았다.** CONTEXT.md 의 `_Avoid_: Thread, Topic, Forum, Channel, Chat` 위반이 남아 있지만,
**팀장님 코드를 내 용어 정리로 건드리는 것 자체가 월권**이므로 **정리 여부를 팀장님 판단 사항으로
올린다.** (내가 손댄 팀장님 파일은 `apps/server/src/server.ts` 2줄뿐이고 그것도 §9-D7로 올렸다.)

| 위치(`file:line`) | 잔여 금지 용어 | 손대지 않은 이유 |
|---|---|---|
| `apps/native/src/screens/discussion-room/index.tsx:661, 1643` | `function PinnedTopic` / `<PinnedTopic />` | 팀장님 컴포넌트(blame `1474ebba`). `Topic` 은 `_Avoid_` 대상이지만 팀장님 코드라 제외 |
| 같은 파일 `:163` | UI 문구 **"토픽 작성자"** | 위 `PinnedTopic` 내부 문구. **사용자에게 보이는 라벨**이라 바꾸면 UX 결정이 된다 |
| `apps/native/src/utils/data.ts:80, 510` | `interface ChatMessage` / `discussionRoomMessages: Record<string, ChatMessage[]>` | mockup 데이터 타입(팀장님 작성). 리네임하면 팀장님 파일이 광범위하게 바뀐다 |
| `packages/db/src/schema/discussion.ts:16` | 주석 `… default "neutral" → ThreadRow hides the pill.` | 팀장님 주석(blame `9078e3d8`) |
| `packages/api/src/routers/discussion.ts:789` | 주석 `chat screen can append without re-sort` | 팀장님 주석 |
| `packages/api/src/routers/discussion.ts:914` | 주석 `… means the threads they participate in` | 팀장님 주석 |
| `docs/native/api/discuss.md`, `docs/native/plan.md` | `ChatMessage` / `threadId` | 팀장님 설계 문서 |

> 위 표의 항목은 **전부 "고칠 수 있는데 일부러 안 고친 것"**이다. 기술적 장애물은 없고
> **소유권 문제**다. 팀장님이 "정리해라" 하시면 별도 커밋으로 한 번에 처리할 수 있다.

**도메인 용어가 아니라서 제외한 것**(정리 대상 아님):

- `apps/native/src/app/_(drawer)/ai.tsx`, `apps/web/src/app/ai/page.tsx` 의 `useChat` /
  `DefaultChatTransport` — `@ai-sdk/react`·`ai` **패키지 API 이름**이고 AI 어시스턴트 도메인이지
  DiscussionRoom이 아니다. `"AI Chat"` 라벨도 같은 이유.
- `name="chatbubble-ellipses-outline"` — **Ionicons 아이콘 이름**.
- `Notifications.setNotificationChannelAsync("default", …)` — expo-notifications API
  (`Channel` 은 RN/Expo 플랫폼 용어).

### 11-6. 범위 밖 — 남겨 둔 부채: GCS 버킷 *이름*

GCS 버킷 **이름** `moneyroad-chat-attachments`(= `DISCUSSION_ATTACHMENT_BUCKET` 의 **값**)에는
`chat` 이 그대로 남아 있다. **코드 범위 밖이라 이번에 못 고쳤다.**

- **왜 코드로 못 바꾸나**: GCS 버킷 이름은 **전역 유일한 GCP 리소스 식별자**이고 **생성 후 변경이
  불가능**하다. 코드는 env로만 참조하므로(§6 표) 소스 어디에도 이 문자열이 박혀 있지 않다 —
  즉 **고칠 코드가 없다.**
- **바꾸려면 필요한 작업(인프라)**: ① 새 이름으로 **신규 버킷 생성** → ② 기존 객체
  **전량 복사**(`gcloud storage cp -r`, `chat/*` prefix 포함) → ③ 서비스 계정 **IAM 재부여** →
  ④ Cloud Run env 값 교체 → ⑤ 옛 버킷 정리. **데이터 이동을 동반하는 운영 작업**이라
  코드 리뷰가 아니라 배포 창구에서 다뤄야 한다.
- **부채로 남기는 근거**: 코드가 이름에 묶여 있지 않아(RFC 0004 §159와 동일 취지) **기능상 손해가
  없고**, 지금 prod 에는 이 버킷이 서버에 연결조차 되어 있지 않다(§11-4). 급하지 않다.
- **다만 지금이 제일 싸다**: prod 에 아직 객체가 없으므로 ②번 복사 비용이 0이다.
  → **버킷 리네임 여부는 팀장님 결정 사항**(코드 변경 0건, 인프라 작업만 발생).

> 따라서 저장소 전체에서 `Chat` **0건**은 달성되지 않는다. 남은 것은 (a) 팀장님 코드,
> (b) 외부 SDK API 이름, (c) GCP 리소스 이름 셋뿐이며, **내가 작성한 코드에는 0건**이다.

---

## 12. iOS 패리티 구현 (2026-07-27)

§4-4를 실제로 구현했다. **Android 매니페스트 권한은 0건 추가**(§204)이며 아래 §12-2에
그 검증을 남긴다.

### 12-1. 초안이 틀렸던 부분 2가지

1. **"usage string이 없어 iOS가 앱을 종료시킨다"는 사실이 아니다.** `expo-media-library`는
   `@expo/prebuild-config`의 `legacyExpoPlugins` 목록에 있어 `plugins` 배열에 적지 않아도
   prebuild에서 **자동 적용**된다. 그래서 `NSPhotoLibrary(Add)UsageDescription`은 이미
   들어가되 **영문 기본값**("Allow $(PRODUCT_NAME) to access your photos")이었다.
   진짜 문제는 (a) 문구가 영어, (b) `UIFileSharingEnabled`·`LSSupportsOpeningDocumentsInPlace`
   부재였다.
2. **평면 앨범명은 iOS 때문만이 아니다.** Android도 앨범 조회가
   `MediaColumns.BUCKET_DISPLAY_NAME` 단일 비교라 `moneyroad/image`로는 `getAlbumAsync`가
   **항상 null** → 저장할 때마다 앨범을 새로 만들려 한다. §10의 "중첩 앨범명 동작" 실측은
   **생성만** 맞고 조회는 깨진다. → `moneyroad` 평면이 양 플랫폼 모두에 필요하다(D4).

### 12-2. `app.json` 변경과 §204 검증

- `ios.infoPlist` += `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`(한국어),
  `UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`.
- **`plugins` 배열은 무변경**(`expo-font`·`expo-notifications`·`expo-image` 그대로).
  초안 구현에서 `["expo-media-library", {…}]`와 `"expo-sharing"`을 넣었다가 **되돌렸다**:
  - `expo-media-library`는 `legacyExpoPlugins`로 **자동 적용**되므로 등록이 중복이다.
    `expo config --type prebuild --json`을 등록 **없이** 떠도 `android.permissions` 7개와
    한국어 `NSPhotoLibrary(Add)UsageDescription`이 그대로 나온다(한국어 문구는 아래
    `ios.infoPlist` 직접 지정에서 온다). 등록해도 얻는 게 없고, 플러그인 옵션을 잘못 건드리면
    (`isAccessMediaLocationEnabled` 등) §204를 깰 표면만 늘어난다.
  - `expo-sharing`의 플러그인은 share-extension용(`ios.enabled ?? false`,
    `android.enabled ?? false`)이라 옵션 없이 등록하면 **아무 것도 하지 않는다**. 게다가
    그 기능은 "남이 우리 앱으로 공유해 오기"라 우리가 쓰는 `shareAsync`와 무관하다.
    JS API는 네이티브 모듈 autolinking만으로 동작한다.
- **`android` 블록 무변경.** `git diff apps/native/app.json`에 `android` 문자열이 **0건**이고,
  `expo config --type prebuild --json`의 `android.permissions`도 작업 전과 동일하다
  (`READ_EXTERNAL_STORAGE`·`WRITE_EXTERNAL_STORAGE`는 라이브러리 매니페스트가 거는
  `maxSdkVersion="32"` 캡이 그대로 유지 — §9-D8 참조).
- 절대 넣지 않은 옵션: `isAccessMediaLocationEnabled`(→ `ACCESS_MEDIA_LOCATION` 신규 추가,
  §204 위반이자 §5의 `getAssetInfoAsync` 제거와 배치), `granularPermissions`(기본값에서 줄이면
  매니페스트가 *변경*된다).
- `runtimeVersion.policy = "fingerprint"` → **양 플랫폼 네이티브 재빌드 필요**(OTA 불가).

### 12-3. 분기는 `discussion-download.ts` 한 파일에만

**저장·열기의 플랫폼 분기는 `discussion-download.ts` 안에만 있다.** 화면은 lib의 반환값·에러
코드만 보고 동작하며, Android/iOS를 구분하는 코드가 없다.

> 정확히 하면 화면 폴더에 `Platform` 참조가 **2건** 있다 —
> `photo-grid-picker.tsx:11`(import), `:71`(`Platform.OS === "android"`). 이건 저장·열기 분기가
> 아니라 §5의 `getAssetInfoAsync` 우회(Android에선 그 호출로 절대 가지 않게 하는 가드)다.
> 그 파일은 RFC 0004 때부터 `expo-media-library`를 직접 다루던 화면이라 여기 남겨 두었다.

| 기능 | Android | iOS | 화면이 보는 것 |
|---|---|---|---|
| 파일 저장 위치 | SAF 트리(사용자 선택) 아래 `moneyroad/file` | 앱 문서함 아래 `moneyroad/file` | `downloadDiscussionFile()`이 돌려주는 `label` 문구뿐 |
| 폴더 선택 안내 | 아직 안 골랐으면 필요 | **불필요**(고를 것이 없음) | `needsSaveFolderChoice()` 불리언 하나 |
| 파일 열기 | `expo-intent-launcher` ACTION_VIEW + `content://` | `expo-sharing` 공유 시트/Quick Look(로컬 `file://`) | `openAttachment()` 성공/실패 |
| 열 앱 없음 | ActivityNotFoundException | 공유 불가(`isAvailableAsync() === false`) | **같은 `NO_VIEWER_APP` 코드** → 동일한 "저장하기" 유도(§4-5) |
| 갤러리 저장 | `moneyroad` 앨범 | `moneyroad` 앨범, 접근이 '선택한 사진만'이면 앨범 API가 거부돼 사진 보관함에 직접 저장 | `saveImageToGallery()`가 돌려주는 `label` 문구뿐 |

- 저장 위치는 여전히 하드코딩이 아니다: iOS도 `Paths.document`(OS가 주는 샌드박스 상수) +
  폴더 *이름*만 쓴다(§151).
- iOS 열기에서 외부로 나가는 것은 **로컬 `file://`뿐**이다 — 서버 URL·토큰은 앱 밖으로
  나가지 않는다(§203).
- `expo-intent-launcher`는 `"platforms": ["android"]`라 iOS 코드 경로에서 호출되지 않게 격리했다.

### 12-4. 남은 검증

`expo config --type prebuild`와 소스 확인까지가 이 환경(WSL, iOS 시뮬레이터 없음)의 한계다.
**실기기/시뮬레이터에서 확인할 것**: (a) 한국어 권한 문구 노출, (b) 파일 앱에 `머니로드`
폴더가 보이는지, (c) 공유 시트로 pdf/hwp가 열리는지, (d) '선택한 사진만' 허용에서 갤러리
저장이 실패로 보이지 않는지.
