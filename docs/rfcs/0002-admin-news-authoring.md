# RFC 0002 — 관리자 뉴스 작성 (admin-news-authoring)

- 상태: **Draft — 설계 제안. 리뷰/결정 대기.**
- 작성일: 2026-07-23
- 범위: 관리자(`role=admin`)가 **native 앱**에서 뉴스를 직접 **작성 · 수정 · 삭제**한다. 작성 기사는 **다중 카테고리** 노출 · **상단 고정(핀)** · **원문 링크**를 가지며, 네이버 자동수집 기사와 **같은 피드에 공존**한다.
  - 범위 밖: #2 뉴스 썸네일(별도 작업), 종목(stockCode) 연결, 관리자 웹앱(`apps/company`) 이관, 자동수집 기사의 멀티라벨화.
- 검증: 이 문서는 실제 코드(아래 `file:line`)를 근거로 작성됨. 스키마·API·UI 모두 기존 인프라 재사용을 우선함.
- 관련 코드:
  - `packages/db/src/schema/news.ts` (스키마)
  - `packages/api/src/routers/news.ts` (feed/detail → create/update/remove 추가)
  - `packages/api/src/routers/{notice,signal}.ts` (admin CRUD · 핀 정렬 **템플릿**)
  - `apps/native/src/screens/signals/index.tsx`, `apps/native/src/screens/signal-new/index.tsx` (FAB·작성폼 **재사용 원형**)
  - `apps/native/src/screens/news/index.tsx` (뉴스 화면 · 상세 시트)
- 참조: **RFC 0001**(뉴스 분류) — "다중 카테고리(멀티라벨)" `categories jsonb` 제안과 정합 필요.

---

## 1. 배경 / 문제

현재 뉴스는 **전량 네이버에서 자동수집**된다(`apps/realtime` 크론 → AI 분류 → DB). 머니로드가 **직접 작성한 "독점" 기사**를 노출할 방법이 없다. 관리자가 앱에서 기사를 써서, 원하는 카테고리(들)에 배치하고, 필요하면 상단에 고정하고, 원문 링크를 걸 수 있어야 한다.

이미 **관리자 콘텐츠 작성 패턴**(시그널·공지·토론방)이 native에 존재하므로 이를 재사용한다.

## 2. 목표 · 비목표

**목표**
- G1. 관리자만 보이는 **"+" FAB**(시그널과 동일 디자인·위치)를 뉴스 화면에 추가.
- G2. 작성 폼: **카테고리(다중) · 상단고정(체크박스) · 제목 · 내용 · 원문링크 · 저장/취소**.
- G3. 작성 기사가 선택한 **모든 카테고리 탭 + 전체 탭**에 노출. 자동수집 기사와 섞임.
- G4. **핀** 체크 시 해당 탭 **항상 최상단**.
- G5. 작성 내용이 **핵심요약 + 원문 미리보기**에 그대로. 출처 = **"머니로드 독점"**.
- G6. 원문링크 → **"원문 기사 보기"** 버튼 목적지.
- G7. 상세 시트에서 관리자에게 **[편집][삭제]** 제공(편집 = 프리필된 작성폼).

**비목표**
- 썸네일 이미지 업로드(#2), 종목 연결, 자동수집 기사 편집, 웹 관리자 앱.

## 3. 현재 동작 분석 (코드 근거)

### 3-1. 스키마 — 수동 뉴스 밑작업이 이미 있음
`packages/db/src/schema/news.ts:5-36`
```ts
originallink: text("originallink").unique(),   // "자동수집 중복 방지용, 수동 업로드 시 null"
link: text("link"),                            // 원문 링크 (nullable)
summary: text("summary"),                      // AI 요약 (nullable)
description: text("description").notNull().default(""),
category: text("category"),                     // ★ 단일값 (다중 아님)
content: text("content"),
sourceType: text("source_type",{enum:["auto","manual"]}).notNull().default("auto"), // ★ 수동 구분 존재
```
→ `sourceType='manual'`, `originallink=null`, `link`/`summary`/`content` 컬럼이 **이미 수동 작성을 상정**한다. **없는 것: 다중 카테고리 · 핀 · 작성자.**

### 3-2. 피드 필터 — `category IS NOT NULL` 함정
`packages/api/src/routers/news.ts:174`
```ts
filters.push(isNotNull(news.category));   // category 없는 기사는 피드에서 제외
```
`categoryFilter()`(`news.ts:57-74`)는 탭 → `eq(news.category, X)` **단일 등치**. 정렬은 `orderBy(desc(news.pubDate))`, 커서는 `lt(news.pubDate, cursor)` **키셋**(`news.ts:206-228`).
→ 수동 기사도 **category(또는 categories)가 반드시 있어야** 노출된다.

### 3-3. 표시 파생 — 작성내용을 요약·미리보기에 그대로 넣는 방법
`news.ts:141-142` (feed) / `news.ts:288-291` (detail)
```ts
ai: row.summary ?? row.description.slice(0, 160),   // 핵심요약 = summary 우선
aiGenerated: Boolean(row.summary),                  // summary 있으면 "머니로드가 요약함" 배지 노출
url: row.link ?? null,                               // 원문 기사 보기 = link
preview: row.description.slice(0, 280) || null,      // 원문 미리보기 = description
source: row.source ?? "뉴스",                         // 출처 표기
```
→ **`summary`와 `description`에 작성 본문을 넣으면** 핵심요약·원문미리보기 둘 다 그대로 나온다. `summary` 존재 → `aiGenerated=true` → 이미 복원된 **"머니로드가 요약함"** 캡션 노출(goal #1 연계).

### 3-4. 재사용 원형 — admin CRUD · 핀 · FAB
- **admin 게이트**: `packages/api/src/index.ts:41` `adminProcedure`(role!=='admin' → FORBIDDEN).
- **create 템플릿**: `signal.ts:159-187`(insert+returning+`refreshRealtimePins`), `notice.ts:74-98`.
- **핀 정렬 템플릿**: `notice.ts:59` `orderBy(desc(notice.pinned), desc(notice.createdAt))` + `notice.ts:101-109` `setPinned`.
- **삭제 템플릿**: `signal.ts:191-198`, `notice.ts:112-117`.
- **FAB(native)**: `signals/index.tsx`의 primary `+` 블록(우하단 52×52, `t.primary`, `Icon.plus`) + 라우트 게이트(`app/(moneyroad)/signal/new.tsx`) + 작성폼(`signal-new/index.tsx`).
- **관리자 판별(native)**: `const isAdmin = session?.user.role === "admin";`

## 4. 제안 설계

### 4-1. 데이터 모델 (스키마 변경) — `packages/db/src/schema/news.ts`
컬럼 **3개 추가**(자동수집 기사·기존 표시 로직에 **하위호환**):

| 컬럼 | 타입 | 용도 |
|---|---|---|
| `categories` | `jsonb $type<string[]>()` (nullable) | 다중 카테고리(수동). **RFC 0001 §6-5 제안과 동일** — 중복 설계 금지, 이 컬럼으로 확정 |
| `pinned` | `boolean notNull default false` | 상단 고정 |
| `authorId` | `text references user.id`(nullable, 감사용) | 작성 관리자 |

- `category`(기존 단일)는 **유지** = 수동 기사의 **대표 카테고리**(= `categories[0]`). 이유: `isNotNull(category)` 필터·자동수집 기사·`categoryFilter()`를 **안 건드리고** 하위호환.
- 인덱스 추가: `news_pinned_idx`(부분: `pinned=true`). `categories` 조회는 소량이라 초기엔 GIN 생략 가능(RFC 0001은 GIN 제안 — 규모 커지면 추가).
- **절차(팀장님 규칙 #1)**: 스키마 수정 → `pnpm db:generate` → `pnpm db:migrate`. **`db:push` 금지, 마이그레이션 SQL 수기수정 금지.**

### 4-2. API (oRPC `adminProcedure`) — `packages/api/src/routers/news.ts`
`signal.ts`/`notice.ts` 템플릿 복사. `newsRouter`에 3개 추가(라우터는 이미 `appRouter`에 등록됨).

```ts
// 입력 스키마(공통)
const authorInput = z.object({
  categories: z.array(z.enum(["market","sector","company","global","other"])).min(1),
  pinned: z.boolean().default(false),
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(4000),
  link: z.string().url().optional(),        // 링크 = 선택
});

create: adminProcedure.input(authorInput).handler(async ({ input, context }) => {
  const id = crypto.randomUUID();           // 수집기 id 생성과 동일 계열 확인(impl)
  await db.insert(news).values({
    id, sourceType: "manual", originallink: null,
    source: "머니로드 독점",
    category: input.categories[0],          // 대표(하위호환)
    categories: input.categories,           // 다중
    pinned: input.pinned,
    title: input.title.trim(),
    summary: input.content.trim(),          // 핵심요약 = 본문
    description: input.content.trim(),      // 원문미리보기 = 본문
    content: input.content.trim(),
    link: input.link ?? null,
    pubDate: new Date(),
    authorId: context.session.user.id,
  });
  // 실시간 반영: §4-6 참고. (refreshRealtimePins는 realtime '핀 스트림'용 — 뉴스 피드와 무관, 호출 금지)
  return { id };
});

update: adminProcedure.input(authorInput.extend({ id: z.string() }))...  // sourceType='manual' 가드 후 동일 필드 갱신
remove: adminProcedure.input(z.object({ id: z.string() }))...            // sourceType='manual' 가드 후 delete
```
- **`detail` 확장**(편집 프리필·버튼 노출용): `sourceType`, `pinned`, `categories`, `content`(또는 `summary`), `link`를 추가 반환. 비관리자에겐 무해(UI에서만 사용).

### 4-3. 피드 노출 (다중 카테고리 · 핀) — `news.ts` `feed`
**(a) 다중 카테고리 필터** — `categoryFilter(tab)`을 "대표 OR 배열 포함"으로:
```ts
// 예: market 탭
or(eq(news.category, "market"), sql`${news.categories} @> ${JSON.stringify(["market"])}`)
```
자동수집(categories=null)은 `category=X`로, 수동은 대표 또는 배열로 매칭. `industry`→`sector`, `policy`→`other` 매핑 유지. `전체`는 `isNotNull(category)`만(수동 기사 category=대표라 통과, **한 번만** 노출).

**(b) 핀 우선 + 키셋 페이지네이션 공존**
- **1페이지(커서 없음)**: ① 핀(`pinned=true` ∧ 탭매칭) `createdAt desc` 전량 + ② 비핀(`pinned=false` ∧ 탭매칭) `pubDate desc` 키셋 `limit+1`. 합쳐서 핀 먼저. `nextCursor`=마지막 **비핀** pubDate.
- **2페이지+(커서 있음)**: 비핀만 `pubDate < cursor`. (핀은 1페이지에서 소진 → 중복 방지)
- `watch` 탭은 종목 기반이라 핀 무관(수동 기사는 stockCode 없음) → 기존 로직 유지.
- **핀 단위 = 기사 전체**(선택한 모든 카테고리 + 전체 탭 최상단). 사용자 스펙="기사를 핀"이라 `pinned boolean` 하나로 충분. 카테고리별 선택적 핀은 조인테이블 필요 → 범위 밖.
- **보너스**: 분류기 `apps/realtime/src/services/news/naver.ts:489 classifyArticle`는 **이미 `categories[]`(최대 3라벨) 계산** 후 `pickPrimary`로 1개 붕괴 저장(주석 "for the current single-column schema"). `categories` 컬럼 추가 시 수집기도 전체 라벨 저장 가능 → 자동수집 기사도 다중 카테고리(RFC 0001 완성). 이번 범위는 수동 우선, 수집기 전환은 선택.

### 4-4. native UI — 작성/편집 화면 (재사용)
- `screens/news/index.tsx`: `isAdmin` 한 줄 추가 + **primary "+" FAB**(`signals/index.tsx` 블록 복사, `bottom`은 기존 `tabBarHeight` 고려) → `nav.openCreateNews()`.
- **신규 `screens/news-new/index.tsx`**(= `signal-new` 셸 복사): `MrScreen` + BackButton 헤더 + `KeyboardAwareScrollView` +
  1. **카테고리**(5개 토글 버튼: 시장/산업/기업/해외/정책, 다중선택, 최소 1개)
  2. **상단 고정**(`Switch`, notice-new 패턴)
  3. **제목** TextInput
  4. **내용** 멀티라인 TextInput
  5. **원문 링크** TextInput(선택)
  6. **[저장]** + **[취소]**
  - `newsId` 파라미터 있으면 **편집 모드**: `news.detail`로 프리필 → `news.update`. 없으면 `news.create`.
  - **저장** → `orpc.news.feed` invalidate → `router.replace(".../(tabs)/news")`.
  - **취소** → `Alert.alert("정말 취소하시겠습니까?", …, [확인/취소])` → 확인 시 작성내용 폐기 + 뉴스로 복귀.
- **신규 라우트** `app/(moneyroad)/news/new.tsx`(옵셔널 `?id` 파라미터로 작성·편집 겸용) — `signal/new.tsx` 게이트 복사(비관리자 리다이렉트).
- `utils/nav.ts`: `openCreateNews()`, `openEditNews(id)` 추가.

### 4-5. 편집 · 삭제 (상세 시트) — `screens/news/index.tsx` `NewsSheet`
관리자 + 수동기사(`detail.sourceType==="manual"`)일 때만 **[원문 기사 보기] 아래**에 순서대로:
- **[편집]** → `nav.openEditNews(id)` (4-4 화면 프리필)
- **[삭제]** → `Alert.alert("정말 삭제하시겠습니까?", …, [확인/취소])` → 확인 시 `news.remove` → 시트 닫고 `news.feed` invalidate(목록에서 제거).

### 4-6. 실시간 반영 (SSE) — 결정 필요
SSE 뉴스 스트림은 **수집기 insert만** `newsHub.broadcast` → 클라 `invalidateFeed()`(refetch) 유발(`apps/native/src/hooks/use-news-stream.ts:120`). 관리자 기사는 server가 DB에 직접 insert하므로 broadcast가 안 걸린다.
- **작성 관리자 본인**: mutation 성공 시 클라가 `news.feed` invalidate → **즉시 보임**(추가 작업 불필요).
- **다른 사용자**: (A) **다음 refetch**(포그라운드 복귀·탭 전환·당겨서 새로고침·SSE 재연결) — 서버 변경 0 / (B) **즉시(권장)** realtime에 **`/internal/refresh-news` 신설**(`/internal/refresh-pins` 패턴 복사) → `newsHub.broadcast` → 전 클라 즉시 refetch.
- ⚠️ **`refreshRealtimePins` 재사용 금지** — realtime '핀/시세 스트림'용이지 뉴스와 무관(`packages/api/src/lib/realtime-trigger.ts`).

## 5. 결정 사항 (확정) · 남은 확인

| # | 결정 | 값 |
|---|---|---|
| D1 | UI 위치 | **native**(시그널 재사용). 규칙상 강제되는 위치 없음, 기존 관리자 UI 전부 native |
| D2 | 원문 링크 | **선택**. 없으면 "원문 기사 보기" 버튼 숨김/비활성(기존 동작) |
| D3 | 기능 범위 | **작성 + 편집 + 삭제**(상세 시트 [편집][삭제] 버튼) |
| D4 | 출처 표기 | **"머니로드 독점"** |
| D5 | 작성내용 매핑 | 본문 → `summary` + `description`(핵심요약·원문미리보기 그대로), 라벨 "머니로드가 요약함" |
| D6 | 다중 카테고리 | `categories jsonb string[]` 신설(RFC 0001과 정합), `category`=대표 유지 |
| D7 | 카테고리 최소 | **1개 이상** 필수(0개면 `isNotNull` 때문에 노출 불가) |
| D8 | 삭제 확인 | **바로 삭제(확인창 없음)** — 토론방과 통일(사용자 결정 2026-07-23) |
| D9 | 핀 단위 | **기사 전체**(선택 카테고리 전부 + 전체 탭 최상단), `pinned boolean` 하나. 카테고리별 선택핀은 범위 밖 |

**남은 확인 → 확정 (2026-07-23, 사용자·코드 결정):**
- Q-a → **핀은 선택 카테고리 탭에서만** 최상단. `전체`·`watch` 탭은 시간순(핀 우선 없음).
- Q-b → 핀 다수 시 **최신순 `pubDate desc`**(수동 기사 pubDate=작성 시각).
- Q-c → 뉴스 id = **`crypto.randomUUID()`**(수집기 `collector.ts:120`과 동일, 코드 확인).
- Q-d → **`tsc` + `biome`(ultracite)로 검증**(레포에 `zone` 식별자 없음 — 특정 방식 아님).
- Q-e → **B: realtime `/internal/refresh-news` 신설**로 다른 사용자도 즉시 반영(⚠️ realtime 재배포 필요).

**구현 중 확인된 사실:**
- F1. `aiGenerated`는 UI에서 실제로 안 읽힘 — "AI 요약/머니로드가 요약함" 배지가 **모든 뉴스에 무조건** 표시(사용자가 복원한 UI). 관리자 기사도 자동 표시되어 D5 결과는 성립. **배지 게이팅은 이번 범위에서 건드리지 않음.**
- F7. `categories`는 **nullable**로 확정(RFC 0001의 `NOT NULL DEFAULT []`와 상충 → 이 구현 기준 nullable, 자동수집 기사=null). RFC 0001 진행 시 재정합.

## 6. 마이그레이션 / 백필
- `categories`/`pinned`/`authorId` 추가는 **비파괴**(기존 행: categories=null, pinned=false). 백필 불필요.
- 팀장님 규칙: `pnpm db:generate` → `pnpm db:migrate`. `packages/db/src/migrations/**` 수기수정 금지.

## 7. 엣지케이스

| 케이스 | 처리 |
|---|---|
| 카테고리 0개 저장 시도 | 클라 검증(`canSubmit=false`) + 서버 `.min(1)` 거부 |
| 링크 미입력 | `link=null` → 상세 "원문 기사 보기" 비활성(기존) |
| 수동기사인데 category 대표 누락 | 저장 시 `category=categories[0]` 강제 → `isNotNull` 통과 보장 |
| 자동수집이 수동기사 덮어씀? | 수집기는 **insert 전용**(UPDATE/DELETE 없음, 전수 확인) + dedup 키=`originallink`(수동 null, PG UNIQUE는 NULL 다중허용) → 충돌·삭제 **0** |
| 비관리자가 편집/삭제 API 호출 | `adminProcedure` FORBIDDEN + 라우트 리다이렉트(3중 방어) |
| 핀 다수로 1페이지가 너무 김 | 핀은 관리자 소량 전제. 필요 시 핀 상한 후속 논의 |

## 8. 구현 체크리스트 (파일별)

**`packages/db/src/schema/news.ts`**
- `categories jsonb string[]`(nullable), `pinned boolean notNull default false`, `authorId text references user`(nullable) 추가. `news_pinned_idx` 부분 인덱스. → `db:generate` → `db:migrate`.

**`packages/api/src/routers/news.ts`**
- `authorInput` zod + `create`/`update`/`remove` `adminProcedure`(insert/update/delete). `update`/`remove`는 `sourceType='manual'` 가드. **`refreshRealtimePins` 호출 금지**(핀용). id=`crypto.randomUUID()`, pubDate=`new Date()` 직접 채움(스키마 기본값 없음).
- `categoryFilter()`를 `or(eq(category,X), categories @> [X])`로 확장.
- `feed`에 **핀 우선 + 키셋** 로직(4-3-b). `detail`에 `sourceType/pinned/categories/content/link` 반환 추가.

**`apps/native/src/screens/news/index.tsx`**
- `isAdmin` + primary "+" FAB(시그널 블록 복사). `NewsSheet`에 [편집][삭제] 버튼(관리자·수동기사 한정) + 삭제 확인.

**신규**
- `apps/native/src/screens/news-new/index.tsx`(작성·편집 겸용 폼, `signal-new` 복사 기반).
- `apps/native/src/app/(moneyroad)/news/new.tsx`(라우트 게이트, `?id` 겸용).
- `apps/native/src/utils/nav.ts`: `openCreateNews`/`openEditNews`.
- (옵션 B, §4-6) `apps/realtime/src/plugins/internal.ts`에 `POST /internal/refresh-news`(→`newsHub.broadcast`) + `packages/api` 트리거 헬퍼(`realtime-trigger.ts` 패턴). server `news.create/update/remove`에서 호출.

**품질(팀장님 규칙)**
- 새 코드는 마커로 감쌈: `/* ----(관리자 뉴스 작성: 시작)---- */ … /* ----(끝)---- */` 또는 `// ----(추가: …)----`.
- 커밋 전 `pnpm check`(ultracite) + `pnpm check-types` 통과. `Alert`는 RN API(웹 `alert()` 아님). 링크 열 때 `rel`/`Linking` 기존 방식.
- **PR까지만**(머지·main 반영은 팀장님). 이슈 → 브랜치 → 커밋 → PR.

## 9. (확장) 자동 기사 썸네일 — GCS 재호스팅 (2026-07-23 추가)

원래 §범위 밖(#2)이던 뉴스 썸네일을 이 RFC로 흡수한다. 지금 썸네일 자리는 진짜 이미지가 아니라 **텍스트 플레이스홀더**(`components/cards.tsx` `NewsThumb` = 감성색 박스 + `thumbHint`)다. 자동수집(네이버) 기사에 **실제 대표 이미지**를 붙인다.

### 9-1. 결정 (사용자, 2026-07-23)
| # | 항목 | 값 |
|---|---|---|
| T1 | 이미지 방식 | **GCS 재호스팅**(핫링킹 X — 원본 삭제·referer 차단에도 안 깨지게). 종목아이콘과 동일 사상 |
| T2 | 대상 | **자동(네이버) 기사만.** 관리자 독점 기사 업로드는 범위 밖(후속) |
| T3 | 비-네이버 기사 | 썸네일 없음 → **텍스트 박스 폴백 유지** |
| T4 | 최적화 | 수집 시 **리사이즈**해서 저장(원본 그대로 X) |
| T5 | 저장 | news에 **`news_thumbnail`**(nullable text) = **완성된 공개 URL** |
| T6 | 백필 | **안 함(새 기사만).** 기존 로컬 뉴스 DB는 수집기 준비 후 **삭제 → 새 수집기로 재적재** |

### 9-2. 기술 결정 (구현자)
- **리사이즈 = `jimp`(순수 JS)**, 240×240 cover, JPEG q80. `sharp`(네이티브)는 realtime Docker(tsdown prune) 리스크 → 배포 안전한 순수 JS 선택. realtime `dependencies`에 추가(prod 포함).
- **버킷** = 코드는 env `NEWS_THUMBNAIL_BUCKET`로 읽음(코드가 이름에 안 묶임). 이름 제안 `moneyroad-news-thumbnails`(공개읽기). **미설정 시 썸네일 수집 skip**(opt-in).
- **best-effort**: og:image 없음/다운로드·리사이즈·업로드 실패 → `news_thumbnail=null` → 텍스트 폴백. **기사 insert 자체는 실패시키지 않음.**

### 9-3. 설계 (파일별)
- **DB** `packages/db/src/schema/news.ts`: `news_thumbnail text`(nullable) 추가 → generate → migrate(로컬은 psql 직접 적용, [[local-db-migration-drift]]).
- **env** `packages/env/src/realtime.ts`: `NEWS_THUMBNAIL_BUCKET: z.string().optional()`.
- **수집기** `apps/realtime/src/services/news/`:
  - `crawlNaverArticle`(이미 네이버 기사 HTML을 fetch 중)에 **og:image 추출** 추가.
  - 새 헬퍼: 이미지 URL → 다운로드 → jimp 리사이즈 → GCS 업로드(`new Storage()`, 종목아이콘 sync 재사용) → 공개 URL 반환.
  - `collector.ts` insert 값에 `newsThumbnail` 채움(버킷 env 있을 때만, best-effort).
- **API** `packages/api/src/routers/news.ts`: feed·detail SELECT에 `newsThumbnail` 추가 → `FeedItem`/detail에 `imageUrl`로 반환. `NewsRow`/`toFeedItem` 확장.
- **native** `apps/native/src/components/cards.tsx` `NewsThumb`: `news.imageUrl` 있으면 `<Image resizeMode="cover">`(78×78, radius 8), 없으면 기존 텍스트 박스. `utils/data.ts` `NewsItem`에 `imageUrl?` 추가.
- **인프라**(사용자, Cloud Shell): 새 버킷 생성+공개, realtime SA에 버킷 `objectAdmin`, Cloud Run realtime에 `NEWS_THUMBNAIL_BUCKET` env, realtime 재배포. (종목아이콘 절차 동일.)

### 9-4. 엣지케이스
| 케이스 | 처리 |
|---|---|
| og:image 없는 기사 | null → 텍스트 폴백 |
| 비-네이버 직링크(크롤 안 함) | null → 텍스트 폴백 |
| 이미지 다운로드/업로드 실패 | null(로그만) → 텍스트 폴백, 기사 insert 정상 |
| 버킷 env 미설정 | 썸네일 skip(전부 텍스트) |
| 기존 기사(백필 안 함) | 로컬은 삭제 후 재적재 / prod는 새 기사부터 |

### 9-5. 삭제(사용자 요청) — 타이밍 주의
삭제 대상 = **`news` 테이블의 기존 행(수집된 뉴스 데이터)만** (`DELETE FROM news` — 테이블 구조·컬럼은 유지). **수집기·마이그레이션·버킷 준비 완료 후 맨 마지막**에 로컬만 실행하고 새 수집기로 재적재한다(그래야 새로 받는 기사에 썸네일이 붙는지 확인 가능). 지금 지우면 옛 수집기가 텍스트 썸네일로 다시 채움. **prod는 별개(안 건드림).**

## 10. (확장) 뉴스 상세 실시세 패널 — `screens/news/index.tsx` (2026-07-23 추가)

종목이 매칭된 뉴스 상세의 종목 패널은 지금 실시세 미연동 **고정 placeholder**("시세 정보는 준비 중입니다.")다. 종목이 붙은 **모든** 기사에서 동일하게 뜬다(인투셀·삼성전자 등 — 시황류는 `stock_code`가 null이라 패널 자체가 없음). 여기에 **실시간 시세 + 등락**을 붙이고, 팀장님 관례대로 **탭 → 종목 상세**로 잇는다.

### 10-1. 결정 (사용자, 2026-07-23)
| # | 항목 | 값 |
|---|---|---|
| L1 | 시세 소스 | **`useLiveQuote(code)` 재사용**(전역 zustand `quotes-store`). 종목 상세와 동일 |
| L2 | 정상 표시 | 현재가 + 등락(±색상) — 종목 상세 헤더와 동일 포맷(`fmt.price`/`fmt.signedNum`/`fmt.pct`/`changeColor`) |
| L3 | 시세 못 받을 때(장 마감·tick 전) | **패널 유지 + 기존 문구 폴백**("시세 정보는 준비 중입니다.") |
| L4 | 탭 동작 | **`nav.openStock(code)`** 로 종목 상세 이동(모달 닫고 이동). code 없으면(=seed.stockName만) 비활성 |

### 10-2. 근거 (코드)
- **재사용 안전**: `useLiveQuote`(`hooks/use-live-quotes.ts`)는 심볼별 ref-count 전역 store. 실제 SSE는 루트 `app/_layout.tsx:28` `useQuotesManager()` **싱글턴**이 구동 → 뉴스 모달에서 register만 하면 tick이 들어오고, 닫으면 unregister(구독 최소 범위).
- **탭 관례**: 종목 표시+탭은 앱 전역이 `nav.openStock`으로 통일 — 검색(`search:15,206`)·홈(`home:124,267`)·관심종목(`watchlist:348`)·시그널(`signals:178`)·**토론방 헤더 종목칩(`discussion-room:305`)**·알림딥링크(`use-notification-response:28`). 뉴스 상세만 미연동이었을 뿐 → 동일 관례 적용.

### 10-3. 설계 (파일)
- `screens/news/index.tsx`: 모듈 레벨 `NewsStockPanel({code, stockName, dummyStock, onOpen})` 신설.
  - `useLiveQuote(code)` → `live` 있으면 시세+등락, 없으면 문구 폴백.
  - `code` 있으면 `Pressable`(onPress=모달 닫고 `nav.openStock`), 없으면 `View`(탭 비활성).
  - `NewsSheet`는 `{stockName ? <NewsStockPanel .../> : null}` 로 교체(기존 인라인 View 대체). 훅은 패널 컴포넌트 내부에서만 호출 → 종목 없는 기사엔 구독 안 붙음.
- **백엔드/스키마 변경 없음**(순수 native UI 배선). realtime/server 재배포 불필요.

### 10-4. 엣지케이스
| 케이스 | 처리 |
|---|---|
| 종목 매칭 없음(code null) | 패널 자체 미표시(현행 유지) — 시황류가 여기 해당 |
| stockName만 있고 code 없음 | 패널 표시하되 탭 비활성 + 문구 폴백 |
| 장 마감/첫 tick 전 | 문구 폴백 → tick 들어오면 시세로 전환 |
| 오매칭 코드(부분문자열 매칭 한계) | 잘못된 종목 시세가 뜰 수 있음 — 이름 노출과 동일한 기존 한계(별도 매칭 정확도 개선 과제) |

## 요약
- **§10 뉴스 상세 실시세**: 종목 패널에 `useLiveQuote` 실시세+등락, 탭→`nav.openStock`(팀장 관례). 백엔드/스키마 변경 없음.
- 스키마 **3컬럼 추가**(categories/pinned/authorId, 하위호환) + **`news_thumbnail` 1컬럼(§9 썸네일)** + `news.create/update/remove`(adminProcedure) + feed **다중카테고리·핀** 로직 + native **FAB·작성폼·상세 [편집][삭제]**.
- **재사용**: signal/notice의 admin CRUD·핀·삭제, signal FAB·작성폼, 기존 표시 파생(summary→핵심요약, description→미리보기, link→원문보기, source→출처).
- **신규 최소화**: news-new 화면/라우트/nav 3개 + 취소·삭제 확인 다이얼로그.
- 미결 4건(Q-a~d, 특히 "zone" 의미)만 확인되면 구현 착수 가능.
