# RFC 0006 — 뉴스 썸네일: 기본 이미지 + 관리자 업로드 (news-thumbnail-default-and-upload)

- 상태: **Draft — 대부분 확정.** Q1·Q2·Q5·Q13 확정됨(§10). 남은 확인은 **Q14** 하나.
- 작성일: 2026-07-27
- 범위:
  1. **썸네일이 없는 기사**에 머니로드 기본 이미지를 표시(현재는 단어 텍스트 박스).
  2. **관리자 뉴스 작성 폼**에 썸네일 사진 첨부 기능 추가(1장, 갤러리에서 선택). 미선택 시 1번의 기본 이미지.
  3. **머니로드 독점 기사 포인트** — 뉴스 카드의 보라색 알약 칩 글씨를 독점 기사에서만 `AI 요약` → `머니로드 독점`으로.
- 범위 밖: 자동수집 파이프라인(`syncNewsThumbnail`) 로직 변경, 뉴스 상세 화면 이미지 표시(현재 없음), 웹/company 앱, 오늘 할 일 2~5번.
- 검증: 이 문서의 모든 주장은 아래 `file:line` 실제 코드와 `gcloud run services describe` 실측에 근거한다.
- 관련 코드:
  - `apps/native/src/components/cards.tsx:531-573` (`NewsThumb` — **유일한** 썸네일 렌더 지점)
  - `packages/api/src/routers/news.ts:173-190` (`toFeedItem`), `:422-446` (`create`), `:449-472` (`update`)
  - `packages/db/src/schema/news.ts:47` (`newsThumbnail` 컬럼)
  - `apps/realtime/src/services/news/thumbnail.ts` (기존 썸네일 규격 — 240×240 JPEG q80)
  - `apps/native/src/screens/news-new/index.tsx` (관리자 작성 폼)
  - `apps/native/src/screens/discussion-room/components/photo-grid-picker.tsx` (사진 선택 UI 원형)
  - `apps/server/src/plugins/discussion-media.ts` (업로드 라우트 원형)
- 참조: **RFC 0002** §2 비목표에 *"썸네일 이미지 업로드(#2)"* 로 미뤄 둔 항목이 바로 이 문서다.

---

## 1. 배경 / 문제

### 1-1. 지금 화면에 보이는 것

`apps/native/src/components/cards.tsx:532-573`

```tsx
function NewsThumb({ news, t }: { news: NewsItem; t: MrTokens }) {
  // 실제 썸네일(GCS 재호스팅)이 있으면 이미지, 없으면 감성색 텍스트 박스 폴백.
  if (news.imageUrl) { return <Image … /> }      // ← 이미지
  …
  return <View …><Text>{news.thumbHint}</Text></View>;   // ← 단어 박스
}
```

`thumbHint`는 서버가 만든다 — `packages/api/src/routers/news.ts:152-157`:

```ts
function thumbHintOf(tags: string[] | null, label: string): string {
  const keyword = tags?.slice(1).find((tag) => tag.length >= 2 && tag.length <= THUMB_MAX);
  return (keyword ?? label).slice(0, THUMB_MAX);      // 최대 8자
}
```

즉 지금 보이는 "단어"는 **기사 태그에서 뽑은 키워드(없으면 카테고리 라벨)** 이고, 배경은 감성색(up=빨강/down=파랑)이다.

### 1-2. 썸네일이 없는 기사가 얼마나 되나 — 실측

썸네일 파이프라인은 realtime에만 있고, **버킷 env가 있어야만** 동작한다 — `apps/realtime/src/services/news/collector.ts:126-131`:

```ts
const thumbnailBucket = env.NEWS_THUMBNAIL_BUCKET;
if (thumbnailBucket && ogImage) {
  newsThumbnail = await syncNewsThumbnail(id, ogImage, thumbnailBucket);
}
```

두 조건이 **모두** 맞아야 썸네일이 생긴다: ① 버킷 env 설정 ② 기사에 `og:image` 존재.

**실측 A — 로컬 (2026-07-27)**

`apps/realtime/.env`에 `NEWS_THUMBNAIL_BUCKET=moneyroad-news-thumbnails`가 **설정돼 있다.** 즉 로컬 수집분은 조건 ①을 만족하고, 조건 ②(og:image)만 갈린다. 로컬 Docker Postgres 집계:

| source_type | 전체 | 썸네일 있음 | 썸네일 없음 |
|---|---|---|---|
| auto | 23,364 | **5,770 (24.7%)** | **17,594 (75.3%)** |

→ **4건 중 3건이 단어 박스.** 개발 화면에서 "나오는 것도 있고 안 나오는 것도 있다"고 보이는 이유가 이것이다. (og:image가 없는 비-네이버 원문·이미지 없는 기사)

**실측 B — prod (2026-07-27)**

`gcloud run revisions list --service=moneyroad-realtime` → 리비전 `00001`~`00004` **전부** `NEWS_THUMBNAIL_BUCKET`이 **없다.** 현재 서비스 env도 `STOCK_ICON_BUCKET`만 있다. 따라서 **prod가 수집한 기사는 조건 ①에서 이미 탈락**해 100% `null`이다. (RFC 0002 §9-3이 요구한 "버킷 생성 + env 설정 + 재배포"가 미수행.)

> 📌 **정정 기록**: 이 문서 초안은 "지금 배포된 뉴스는 전부 썸네일이 null"이라고만 적었다. prod에 대해서는 맞지만, 개발 중 실제로 보는 화면은 **로컬**이고 로컬은 24.7%가 썸네일을 갖는다. 초안의 서술이 화면과 어긋났으므로 위 표로 대체한다.

**설계상 의미**: 기본 이미지는 "예외적인 몇 건"이 아니라 **로컬 기준 75%, prod 기준 100%** 의 기사에 적용된다. → **Q12**

### 1-3. 관리자 작성 폼에 썸네일 입력이 없다

`apps/native/src/screens/news-new/index.tsx:366-391`이 "원문 링크 (선택)"이고, 그 다음은 바로 저장/취소 버튼(`:393`)이다. 폼 payload(`:158-164`)에도 썸네일 필드가 없고, API `create` 입력 스키마(`packages/api/src/routers/news.ts:50-56`)에도 없다. 그래서 **관리자가 쓴 "머니로드 독점" 기사는 썸네일을 가질 방법이 아예 없다.**

---

## 2. 목표 · 비목표

**목표**
- G1. `newsThumbnail`이 없는 기사는 단어 박스 대신 **머니로드 기본 썸네일 이미지**를 보여준다.
- G2. 썸네일이 **있는** 기사는 지금과 완전히 동일하게 동작한다(회귀 0).
- G3. 관리자 작성 폼 "원문 링크" **아래**에 썸네일 사진 추가 버튼을 둔다.
- G4. 버튼 → 토론방과 같은 사진 선택 화면. **정확히 1장만** 선택 가능.
- G5. 선택 후 폼에 **파일 이름**이 표시된다.
- G6. 폼 저장 시 선택한 사진이 **썸네일 규격으로 리사이즈**되어 기사에 붙는다.
- G7. 사진을 고르지 않으면 G1의 기본 이미지가 적용된다.
- G8. **머니로드 독점 기사**에서 보라색 알약 칩의 글씨가 `AI 요약` → `머니로드 독점`. **모양·폰트·색·아이콘은 그대로.**

**비목표**
- 자동수집 기사의 og:image 수집 로직 변경(그대로 둔다).
- 뉴스 상세 화면의 큰 이미지(현재 상세는 이미지를 렌더하지 않는다 — `imageUrl` 사용처는 `NewsThumb` 하나뿐, grep 검증).
- 썸네일 크롭 UI(자르기 편집기), 다중 이미지, 이미지 교체 이력.

---

## 3. 현재 구조 (코드 근거)

### 3-1. 썸네일 렌더 지점은 앱 전체에 **하나**

`imageUrl` / `thumbHint` grep 결과 (`apps/native/src`):

| 위치 | 용도 |
|---|---|
| `utils/data.ts:57,62` | `NewsItem` 타입 정의 |
| `utils/data.ts:301~356` | 더미 데이터 |
| `components/cards.tsx:532-573` | **`NewsThumb` — 유일한 렌더** |
| `components/cards.tsx:602` | `NewsCard`가 `NewsThumb` 호출 |

→ **G1은 함수 하나만 고치면 된다.**

### 3-2. 기존 썸네일 규격 (자동수집)

`apps/realtime/src/services/news/thumbnail.ts:5-19`

| 항목 | 값 |
|---|---|
| 크기 | **240 × 240 정사각** (`image.cover`) — 78px 표시칸의 3배 밀도 |
| 포맷 | `image/jpeg`, quality 80 |
| GCS 키 | `news-thumbnails/{newsId}.jpg` |
| 캐시 | `public, max-age=31536000, immutable` |
| URL | `https://storage.googleapis.com/{bucket}/{key}` — **공개 직접 URL** |

> 이 점이 토론방 첨부와 결정적으로 다르다. 토론방 첨부는 **비공개 버킷 + 서버 프록시**(RFC 0004 §203)지만, 뉴스 썸네일은 **공개 버킷 직접 URL**이다. 뉴스는 비로그인도 보는 공개 콘텐츠라 원래 그렇게 설계됐다.

### 3-3. 사진 선택 UI 원형 (토론방)

`photo-grid-picker.tsx` — `PhotoGridPicker`는 **다중 선택**(`MAX_IMAGES`, 선택 순번 배지, 총 용량 합산)이다. 뉴스 썸네일은 1장이므로 **단일 선택 모드**가 필요하다. → **Q8**

### 3-4. 업로드 라우트 원형

`apps/server/src/plugins/discussion-media.ts` — `POST /upload/discussion-image`가 multipart 수신 → 크기 검증 → `Jimp` 재인코딩 → GCS 저장 → `moneyroad_image` 행 생성. 뉴스 썸네일은 `moneyroad_image` 행이 필요 없고(뉴스는 `news.news_thumbnail` 텍스트 컬럼 하나로 끝) 공개 버킷을 쓴다 → **별도 라우트**가 필요하다. → **Q11**

---

## 4. 설계 — 기능 1: 썸네일 없는 기사에 기본 이미지

### 4-1. 이미지 파일

- 원본: `C:\Users\user\Pictures\chat source\moneyroad_thumbnail.png` — **PNG 1254 × 1254, 8bit truecolor(알파 없음), 880,804 bytes**
- 배치(완료): `apps/native/assets/images/news-thumbnail-default.png`
  - 사용자 예상대로 **앱 아이콘과 같은 폴더가 이미 존재**한다 (`icon.png`, `splash-icon.png`, `android-icon-foreground.png` 등). 새로 만들 필요 없었다.
  - 폴더의 기존 파일이 전부 kebab-case라 이름을 맞췄다. → **Q3**
- **축소 완료 (Q2 확정에 따라)** — 자동수집 썸네일과 같은 `Jimp.cover(240, 240)`:

  | | 크기 | 용량 |
  |---|---|---|
  | 원본 | 1254 × 1254 | 880,804 B |
  | **번들본** | **240 × 240** | **50,253 B** (−94.3%) |

  정사각 원본이라 `cover`에서 **잘림이 발생하지 않았다**(§3-2 규격과 동일 비율). 표시칸 78px 기준 3배 밀도(234px)를 덮는다.
- 이미지 내용: 밝은 회색 배경 + 파란 원형 상승 화살표 + "머니로드" 워드마크. **배경이 밝은 색으로 고정**이라 다크 모드에서도 밝은 사각형으로 보인다(브랜드 자산 원본을 그대로 쓴 결과 — 의도된 것인지는 사용자 판단).

### 4-2. 어디서 폴백을 붙이나 — 두 가지 안

| | **A안 — 앱 번들 (추천)** | **B안 — 서버가 기본 URL 반환** |
|---|---|---|
| 코드 | `NewsThumb`에서 `imageUrl`이 null이면 번들 에셋을 `require` | `toFeedItem`에서 `imageUrl: row.newsThumbnail ?? DEFAULT_URL` |
| 서버 변경 | 없음 | `packages/api` 수정 |
| 인프라 | **없음** | 이미지를 공개 호스팅해야 함(GCS 버킷 생성·공개·업로드) |
| 네트워크 | 0 (번들 내장) | 기사마다 이미지 요청 1회 |
| 오프라인 | 동작 | 안 나옴 |
| 배포 | **EAS Update(OTA)만** | 서버 재배포 + 인프라 |
| 앱 용량 | +파일 크기 | +0 |
| 기본 이미지 교체 | 앱 업데이트 필요 | 버킷 파일만 교체 |

사용자 요청문에 두 안이 섞여 있다 — *"api로 가져올때 … 저 사진을 보여달라"*(B안) / *"이미지파일 모아두는 소스폴더에 복사해서 넣어줘"*(A안). → **Q1**

**✅ 확정 = A안 (사용자 확답 2026-07-27).** B안은 이미지 업로드 → 서버 코드 수정 → 서버 재배포가 **선행**돼야 하지만, A안은 앱만 고치면 오늘 바로 동작한다. 기본 이미지는 브랜드 자산이라 자주 교체될 물건이 아니므로 "번들이라 교체가 무겁다"는 A안의 단점이 거의 비용이 되지 않는다.

> 버킷 자체는 존재한다(§9-1). 초안은 "prod에 인프라가 하나도 없다"고 적었으나 **틀렸다** — 버킷과 공개 설정은 되어 있고 없는 건 **env 설정뿐**이다.

### 4-3. A안 구현 스케치

```tsx
/* ----(썸네일 없는 기사: 머니로드 기본 이미지)---- */
// 자동수집 기사는 og:image가 없거나 버킷 env 미설정이면 썸네일이 null이다.
// 예전엔 태그에서 뽑은 단어를 감성색 박스에 띄웠는데, 기사마다 글자수·색이
// 달라 목록이 산만했다. 브랜드 기본 이미지 한 장으로 통일한다.
// `@/`는 tsconfig paths에서 `./src/*`로만 매핑되는데 이미지는 src 밖(assets/)에
// 있다. 그래서 여기만 상대경로다 — 같은 형태의 선례가 `utils/app-version.ts`의
// `import appConfig from "../../app.json"`에 이미 있다.
const DEFAULT_NEWS_THUMBNAIL = require("../../assets/images/news-thumbnail-default.png");
/* ----(~썸네일 없는 기사 여기까지)---- */

function NewsThumb({ news, t }: { news: NewsItem; t: MrTokens }) {
  return (
    <Image
      resizeMode="cover"
      source={news.imageUrl ? { uri: news.imageUrl } : DEFAULT_NEWS_THUMBNAIL}
      style={{ width: 78, height: 78, borderRadius: 8, backgroundColor: t.bgSubtle }}
    />
  );
}
```

- 함수가 **단일 return**으로 줄어든다. 감성색 분기(`up`)·`thumbHint` 참조가 사라진다.
- ⚠️ 이 삭제되는 텍스트 박스(`cards.tsx:548-573`)는 **팀장님이 작성한 코드**다(`git blame`: 이미지 분기 533-547은 vscodereader, 폴백 박스는 jonghyeon.kim). 사용자가 명시적으로 교체를 요청한 부분이지만 **팀장님 코드 삭제**라는 점을 기록해 둔다. → **D1**
- `thumbHint` 필드 자체를 지울지는 → **Q4**

---

## 5. 설계 — 기능 2: 관리자 썸네일 업로드

### 5-1. 화면 흐름

```
[새 뉴스 / 뉴스 편집]
  카테고리 * ─ 최상단 고정 ─ 제목 * ─ 내용 * ─ 원문 링크 (선택)
  ┌────────────────────────────────────────┐  ← 여기 신규
  │ 썸네일 (선택)                            │
  │  [ 🖼 사진 선택 ]                         │
  │  선택 안 하면 머니로드 기본 이미지가 들어갑니다.│
  └────────────────────────────────────────┘
  [취소]  [저장]
```

선택 후:

```
  │ 썸네일 (선택)                            │
  │  [미리보기 56×56]  IMG_20260727_101.jpg  ✕ │
  │  [ 사진 변경 ]                            │
```

- **사진 선택** 탭 → 토론방과 동일한 갤러리 그리드가 전체화면으로 열림
- **1장만** 선택 가능(다른 사진을 탭하면 선택이 이동)
- 확인 → 폼으로 복귀, **파일 이름 + 미리보기** 표시
- **✕** → 선택 해제(= 기본 이미지로 되돌림)

### 5-2. 데이터 흐름

```
[native] 갤러리에서 1장 선택 (로컬 uri만 보관, 아직 업로드 X)
   │
   ▼  폼 [저장] 탭
[native] POST /upload/news-thumbnail   (multipart, admin 세션)
   │
   ▼
[server] 크기·MIME 검증 → Jimp cover 240×240 JPEG q80
         → GCS 공개 버킷 news-thumbnails/{uuid}.jpg
         → { url } 반환
   │
   ▼
[native] orpc news.create({ …, thumbnailUrl: url })
   │
   ▼
[api] news.news_thumbnail = url  (사진 미선택이면 null)
```

- 사진을 안 고르면 업로드 단계를 **건너뛰고** `thumbnailUrl` 없이 create → 컬럼 `null` → §4의 기본 이미지가 화면에 나옴. → **Q6**
- 업로드를 "선택 즉시"가 아니라 "폼 저장 시"에 하는 이유: 관리자가 작성을 취소하면 GCS에 **고아 객체가 남지 않는다.** 대신 저장 버튼이 1~3초 걸린다. → **Q7**
- GCS 키에 `newsId`가 아니라 **새 UUID**를 쓰는 이유: 업로드 시점에는 아직 기사 id가 없다(`create` 안에서 `randomUUID()`). 자동수집 파이프라인의 `news-thumbnails/{newsId}.jpg`와 **키가 겹치지 않는다**(UUID 공간이 같아 충돌 확률 0에 수렴).

### 5-3. 서버 라우트

```
POST /upload/news-thumbnail
  인증: 세션 필수 + role === 'admin'      ← 토론방 첨부보다 강한 조건
  본문: multipart, 파일 1개
  제한: 10MB, image/* 만
  처리: Jimp.read → cover(240,240) → jpeg q80
  저장: {NEWS_THUMBNAIL_BUCKET}/news-thumbnails/{uuid}.jpg  (public-read, immutable)
  응답: { url: "https://storage.googleapis.com/…" }
  버킷 env 미설정 시: 503 + "썸네일 버킷이 설정되지 않았습니다"
```

- `NEWS_THUMBNAIL_BUCKET`은 현재 **`packages/env/src/realtime.ts:45`에만** 있다. server에서 쓰려면 `packages/env/src/server.ts`에도 같은 키를 추가해야 한다. → **Q5**
- 리사이즈 규격은 자동수집분과 **똑같이** 240×240 정사각 JPEG q80으로 맞춰 목록에서 섞였을 때 화질·비율이 어긋나지 않게 한다. → **Q10**

### 5-4. API 스키마 변경

`packages/api/src/routers/news.ts`

```ts
const authorInput = z.object({
  categories: …, pinned: …, title: …, content: …, link: …,
  thumbnailUrl: z.string().url().optional(),   // ← 신규
});
```

- `create`: `newsThumbnail: input.thumbnailUrl ?? null`
- `update`: 같은 필드 반영 (편집에서 교체·해제 가능하게) → **Q9**
- `detail`은 이미 `imageUrl`을 반환하므로(`:410`) 편집 프리필에 그대로 쓸 수 있다.

---

## 6. 설계 — 기능 3: 머니로드 독점 칩

### 6-1. 지금 있는 것

뉴스 카드 우측의 **보라색 알약 칩**(`✨ AI 요약`). 스타일은 `sigAi` 보라(`#6A4DD6` / dark `#9B82E8`), 높이 22, `borderRadius: 999`, `sparkles` 아이콘 11px + 11px/700 흰 글씨.

**같은 칩이 세 군데에 따로 적혀 있다:**

| 위치 | 형태 | 사용 여부 |
|---|---|---|
| `apps/native/src/components/ui.tsx:511` `AiChip` | **재사용 컴포넌트. `label` prop까지 이미 있음**(`label = "AI 요약"`) | ❌ **아무 데서도 안 씀 (죽은 코드)** |
| `apps/native/src/components/cards.tsx:652-670` | 인라인 손복사 | ✅ 뉴스 목록 카드 |
| `apps/native/src/screens/news/index.tsx:203-218` | 인라인 손복사 | ✅ 뉴스 상세 시트 |

→ 글씨를 바꾸려면 **두 군데를 따로 고쳐야 하는** 상태다. 이미 `label` prop을 가진 `AiChip`이 있으므로, 이번에 두 인라인 복사본을 `AiChip` **하나로 합친다**(§6-3).

### 6-2. 독점 기사를 어떻게 판별하나

DB에서 독점 기사는 `source_type = 'manual'`이고 `source = '머니로드 독점'`이다 (`packages/api/src/routers/news.ts:429-431`).

로컬 DB 집계 — 현재 **manual 기사가 0건**이다(전량 `auto`, 출처는 `newsis.com`·`news1.kr`·`yna.co.kr` 등 언론사 도메인). 즉 이 칩은 **아직 화면에서 확인할 수 없고**, 검증하려면 관리자로 기사를 하나 써 봐야 한다.

**판별 방법 두 가지:**

| | 방법 | 평가 |
|---|---|---|
| (a) | 목록에서 `news.source === "머니로드 독점"` 문자열 비교 | API 변경 0건. 하지만 **표시용 문자열에 로직을 의존**하게 된다 — 나중에 출처 문구를 "머니로드 단독" 등으로 바꾸면 칩이 조용히 사라진다 |
| (b) | `FeedItem`에 **`exclusive: boolean`** 추가 (`sourceType === "manual"`에서 계산) | API 필드 1개 추가. 표시 문구와 무관하게 안전 |

**채택 = (b).** 이유: (a)는 한국어 표시 문구를 사실상 상수로 굳혀 버린다. `toFeedItem`은 이미 `row.sourceType`을 SELECT하지 않으므로 `feedColumns`에 한 줄만 더하면 된다.

### 6-3. 구현

**1) 두 인라인 복사본을 `AiChip`으로 교체**

```tsx
// cards.tsx — 인라인 <View>…</View> 19줄을 지우고
{showAiChip ? (
  <View style={{ marginLeft: "auto" }}>
    <AiChip label={news.exclusive ? "머니로드 독점" : "AI 요약"} />
  </View>
) : null}
```

`news/index.tsx` 상세 시트도 동일하게 교체한다. **칩의 모양·폰트·색·아이콘은 한 글자도 바뀌지 않는다** — `AiChip`이 인라인 복사본과 스타일이 완전히 동일하기 때문이다(`ui.tsx:513-531` vs `cards.tsx:653-669` 대조 확인).

**2) API에 `exclusive` 추가** — `packages/api/src/routers/news.ts`

```ts
const feedColumns = { …, sourceType: news.sourceType };   // SELECT 1컬럼 추가
// toFeedItem
exclusive: row.sourceType === "manual",
```

`detail`은 이미 `sourceType`을 반환하므로(`:412`) 상세 시트는 그대로 쓸 수 있다.

### 6-4. 알아 두어야 할 것 — 지금 칩이 **모든 기사**에 뜬다

`showAiChip`은 호출부에서 **무조건 true**로 넘어간다 (`news/index.tsx:579`, `stock-detail/index.tsx:492`). `news.aiGenerated` 필드가 있는데도 **칩은 그 값을 보지 않는다.**

그런데 뉴스 파이프라인은 이제 **요약을 생성하지 않는다**(분류만 수행 — `collector.ts`의 `summary: null`). 즉 지금 자동수집 기사는 AI 요약이 없는데도 `AI 요약` 칩이 붙어 있다.

이번 변경으로 **독점 기사만** 글씨가 정확해지고, 자동수집 기사에는 `AI 요약` 칩이 그대로 남는다.

> ✅ **사용자 결정 (2026-07-27)**: *"3번은 건드리지마. 무조건 true로 할꺼야."* — `showAiChip`은 지금처럼 **항상 true**로 두고, `aiGenerated`와 연결하지 않는다. 자동수집 기사의 `AI 요약` 칩도 **그대로 유지**한다. 이 항목은 더 이상 미결이 아니다.

---

## 7. 변경 파일

| 파일 | 변경 | 소유 |
|---|---|---|
| `apps/native/assets/images/news-thumbnail-default.png` | **신규** — 240×240으로 축소해 배치 | 신규 |
| `apps/native/src/components/cards.tsx` | ① `NewsThumb` 폴백 교체 (§4-3) ② 인라인 칩 19줄 → `AiChip` (§6-3) | 팀장님 파일 — **D1·D6** |
| `apps/native/src/screens/news/index.tsx` | 상세 시트 인라인 칩 → `AiChip` (§6-3) | 팀장님 파일 — **D6** |
| `apps/native/src/components/ui.tsx` | 변경 없음 — 기존 `AiChip`을 그대로 쓴다 | — |
| `apps/native/src/screens/news-new/index.tsx` | 썸네일 섹션 + 폼 상태 + 업로드 호출 | 내 파일 |
| `apps/native/src/screens/news-new/components/thumbnail-field.tsx` | **신규** — 선택 버튼·미리보기·파일명 | 신규 |
| `apps/native/src/screens/discussion-room/components/photo-grid-picker.tsx` | 단일 선택 모드 지원(`maxCount` prop) — **Q8** | 내 파일 |
| `apps/native/src/lib/news-thumbnail-upload.ts` | **신규** — multipart 업로드 클라이언트 | 신규 |
| `apps/server/src/plugins/news-media.ts` | **신규** — 업로드 라우트 (§5-3) — **Q11** | 신규 |
| `apps/server/src/server.ts` | 플러그인 register **1줄** | 팀장님 파일 — **D2** |
| `packages/env/src/server.ts` | `NEWS_THUMBNAIL_BUCKET` 추가 — **Q5** | 공용 |
| `packages/api/src/routers/news.ts` | ① `thumbnailUrl` 입력 + create/update 반영 ② `FeedItem.exclusive` 추가 (§6-2) | 공용(내 섹션) |
| `docs/rfcs/0006-*.md`, `docs/rfcs/README.md` | 문서 | 신규 |

**변경 없음**: `packages/db/src/schema/news.ts`(컬럼 `newsThumbnail` 이미 존재 → **마이그레이션 불필요**), `apps/realtime/**`(자동수집 로직 그대로), `apps/web`, `apps/company`, `biome.json`, `bts.jsonc`, `.github/workflows/**`.

---

## 8. 권한 · 보안

- 업로드 라우트는 **admin 전용**. 세션만 확인하는 토론방 첨부와 다르다 — 뉴스 작성 자체가 `adminProcedure`이므로 업로드도 같은 문턱이어야 한다. 세션 없음 → 401, admin 아님 → 403.
- 업로드된 이미지는 **공개 버킷**에 들어간다(§3-2). 관리자가 개인 사진을 잘못 올리면 URL을 아는 누구나 볼 수 있다. 뉴스 썸네일의 성격상 공개가 맞지만 **RFC 0004 §203(비공개+프록시)과는 다른 정책**이라는 점을 명시해 둔다.
- 서버는 원본을 저장하지 않고 **Jimp로 재인코딩**한다 → EXIF(GPS 등) 메타데이터가 제거된다. 토론방 이미지와 동일한 처리.
- 파일명은 GCS 키에 쓰지 않는다(UUID). 사용자에게 보이는 파일명은 앱 화면 표시용일 뿐이다.

---

## 9. 배포 영향

| # | 항목 | 필요 조건 |
|---|---|---|
| 1 | **기능 1(기본 이미지)** — A안이면 | EAS Update(OTA)만. 서버·인프라 무관 |
| 2 | **기능 1** — B안이면 | 공개 버킷 + 이미지 업로드 + 서버 재배포 |
| 3 | **기능 2(관리자 업로드)** | ① GCS 공개 버킷 존재 ② server SA에 `objectAdmin` ③ Cloud Run **server**에 `NEWS_THUMBNAIL_BUCKET` env ④ server 재배포 ⑤ 앱 OTA |

### 9-1. GCS 인프라 실측 (2026-07-27) — Q5 해결

`gcloud storage buckets list --project=moneyroad-ai-kr-app`:

```
moneyroad-chat-attachments   ASIA-NORTHEAST3
moneyroad-news-thumbnails    ASIA-NORTHEAST3   ← 존재함
moneyroad-stock-icons        ASIA-NORTHEAST3
```

`gcloud storage buckets get-iam-policy gs://moneyroad-news-thumbnails`:

```
roles/storage.objectViewer → ['allUsers']      ← 공개 읽기 설정 완료
```

| 조건 | 상태 |
|---|---|
| ① 버킷 존재 | ✅ `moneyroad-news-thumbnails` |
| ② 공개 읽기 | ✅ `allUsers` → `objectViewer` |
| ③ server SA에 `objectAdmin` | ❔ 미확인 — 업로드 구현 시 부여 필요 |
| ④ Cloud Run **server**에 `NEWS_THUMBNAIL_BUCKET` env | ❌ 없음 (server env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `DATABASE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `STREAM_TOKEN_SECRET`) |
| ⑤ Cloud Run **realtime**에 `NEWS_THUMBNAIL_BUCKET` env | ❌ 없음 — 리비전 00001~00004 전부. **prod 자동수집 썸네일이 꺼져 있는 원인**(§1-2 실측 B) |

> 버킷과 공개 설정은 **이미 되어 있다.** RFC 0002 §9-3 절차 중 남은 건 **env 설정 + 재배포**뿐이다.
>
> ⑤는 이번 RFC 범위 밖이지만 **한 줄 설정으로 prod 자동수집 썸네일이 살아난다.** 오늘 할 일 4번(server·realtime 수동배포)과 함께 처리하는 것을 권한다.
>
> 기능 1(A안)과 기능 2는 **배포가 완전히 분리**된다. 기능 1은 오늘 바로, 기능 2는 ③④가 끝난 뒤 나갈 수 있다.

---

## 10. ❓ 확인 필요 — 답을 받아야 착수한다

> 아래는 내가 **임의로 정하면 안 되는 것**만 추렸다. 각 항목에 내 추천을 붙였다.

| # | 질문 | 내 추천 |
|---|---|---|
| ~~Q1~~ | ~~기본 이미지를 앱에 번들할까, 서버가 URL로 내려줄까?~~ | ✅ **확정: A안(앱 번들).** 사용자 확답 2026-07-27 |
| ~~Q2~~ | ~~원본 그대로? 축소?~~ | ✅ **확정: 240×240으로 축소.** 사용자 확답 2026-07-27 — "화면에 표시되는 대로 넣어줘야지" |
| **Q3** | 파일명 `moneyroad_thumbnail.png` 그대로? 아니면 폴더 관례(kebab-case)에 맞춘 `news-thumbnail-default.png`? *(현재 후자로 복사해 둠)* | **`news-thumbnail-default.png`** |
| **Q4** | 이제 안 쓰이는 `thumbHint`(단어) 코드를 **지울까 남길까**? API `FeedItem.thumbHint`·`thumbHintOf()`·native `NewsItem.thumbHint` | **남긴다.** 이번 PR 범위를 줄이고 되돌리기 쉽게 |
| ~~Q5~~ | ~~관리자 업로드를 어느 버킷에?~~ → **해결됨. §9-1 참조.** 버킷은 이미 존재하고 공개 읽기 설정도 끝나 있다. `NEWS_THUMBNAIL_BUCKET` 재사용으로 확정 | — |
| **Q6** | "사진 안 고르면 기본 적용"을 **(i) DB를 null로 두고 앱이 기본 이미지 렌더** / **(ii) DB에 기본 이미지 URL을 실제로 기록** 중 어느 쪽으로? | **(i).** 나중에 기본 이미지를 바꾸면 과거 기사까지 자동 반영 |
| **Q7** | 업로드 시점: **(α) 사진 고르는 즉시** / **(β) 폼 저장 버튼 누를 때** | **(β).** 작성 취소 시 GCS 고아 객체가 안 남음. 대신 저장이 1~3초 |
| **Q8** | 사진 선택 UI를 **갤러리 그리드만**? 토론방처럼 **파일 선택도** 함께? | **갤러리만.** 썸네일은 사진이면 충분 |
| **Q9** | **뉴스 편집** 화면에서도 썸네일 교체·해제가 되어야 하나? (요청문은 "새 뉴스"만 언급) | **된다.** 안 되면 한 번 잘못 올린 썸네일을 영영 못 바꿈 |
| **Q10** | 리사이즈를 자동수집분과 동일한 **240×240 정사각 JPEG q80**으로? *가로로 긴 사진은 좌우가 잘린다* | **동일 규격.** 목록에서 섞였을 때 어긋나지 않음 |
| **Q11** | 업로드 라우트를 **새 `news-media.ts` 플러그인**으로 뺄까, 기존 `discussion-media.ts`에 얹을까? *(후자는 CONTEXT.md 용어상 뉴스가 discussion에 들어가는 셈)* | **새 플러그인.** 뉴스는 DiscussionRoom이 아니다 |
| **Q12** | §1-2 실측대로 **로컬 75% / prod 100%** 의 기사가 썸네일이 없다. 이 기능을 켜면 목록의 상당수가 **같은 기본 이미지**로 반복된다. 그래도 진행? *(prod 썸네일을 살리려면 realtime 인프라 작업이 별도로 필요 — 오늘 할 일 4번과 함께 처리 가능)* | **진행.** 지금의 단어 박스보다는 낫다. prod realtime 버킷 env는 별건으로 잡자 |
| ~~Q13~~ | ~~"머니로드 독점 기사 포인트"가 뭘 뜻하나?~~ | ✅ **확정: 보라색 알약 칩의 글씨만 교체.** 사용자 확답 2026-07-27 — "그 UI 그 폰트 그대로 쓰되 글씨만 '머니로드 독점'". 상세는 **§6** |
| ~~Q14~~ | ~~목록 카드 + 상세 시트 둘 다? 비독점은 `AI 요약` 유지?~~ | ✅ **확정: 둘 다 적용. 비독점은 `AI 요약` 유지.** 사용자 확답 2026-07-27 — "밖과 안 둘 다 바꿔줘" |

> **모든 확인 항목이 닫혔다. 구현 착수 가능.**

---

## 11. 팀장님 결정 사항

| # | 내용 |
|---|---|
| **D1** | `cards.tsx`의 **팀장님 작성 폴백 코드**(감성색 단어 박스, `:548-573`)를 삭제하고 기본 이미지로 교체하는 것을 승인하시는지. 사용자 요청이지만 팀장님 코드다 |
| **D2** | `apps/server/src/server.ts`(팀장님 파일)에 플러그인 register **1줄** 추가 승인 (RFC 0005 D7과 동일 성격) |
| **D3** | 뉴스 썸네일이 **공개 버킷 직접 URL**을 쓰는 현행 정책 유지 승인. 토론방 첨부의 §203(비공개+프록시)과 다르다 |
| **D4** | `NEWS_THUMBNAIL_BUCKET`을 realtime·server **양쪽에서** 참조하게 되는 구조 승인 |
| **D5** | §6-1 — 죽은 코드였던 `AiChip`(`ui.tsx:511`)을 살려 인라인 복사본 2곳을 통합하는 것. **`cards.tsx`(팀장님 파일)의 칩 코드 19줄 삭제**를 포함한다 |
| **D6** | §12-3 — iOS HEIC 사진이 **토론방 첨부·뉴스 썸네일 양쪽에서** 415로 거절된다(선재 결함). `expo-image-manipulator` 도입해 클라이언트에서 JPEG 변환하는 별건 작업을 승인하시는지 |

> §6-4(자동수집 기사의 `AI 요약` 칩 부정확)는 **사용자가 유지하기로 결정**해 결정 목록에서 뺐다.

---

## 12. 구현 결과 (2026-07-27)

### 12-1. 게이트 — 통과

내가 워크플로와 **별도로** 다시 돌린 결과다(에이전트 보고를 그대로 믿지 않음):

```
npx ultracite@latest check .    → Checked 320 files. No fixes applied.
apps/native    tsc --noEmit → OK      packages/api   tsc --noEmit → OK
apps/server    tsc --noEmit → OK      packages/env   tsc --noEmit → OK
apps/realtime  tsc --noEmit → OK
```

`FeedItem`에 **필수** 필드 `exclusive`를 추가했는데 깨지는 소비자가 없다(realtime·web·company 포함 전 워크스페이스 확인).

### 12-2. 리뷰 결과 — 5건 중 3건 기각, 2건 확정

리뷰 렌즈 3개(설계서 준수 / 규칙 위반 / 런타임 결함)가 낸 지적을 건마다 독립 검증자가 **반증 시도**했다.

**기각된 3건** — 검증자가 근거를 무너뜨렸다:

| 지적 | 기각 사유 |
|---|---|
| `news-new/index.tsx` 신규 블록 일부에 마커 없음 | 해당 로직은 이미 `resolveThumbnailUrl`의 마커 제목이 저장 흐름을 명시하고 있고, 같은 기준을 적용하면 신규 import·state까지 전부 마커를 붙여야 해 리뷰어 기준이 자기모순 |
| `thumbnail-field.tsx`가 화면 간 import (구조 규칙 위반) | 리뷰어가 제시한 완화책(공용임을 알리는 헤더 주석)이 이미 `photo-grid-picker.tsx:24`에 들어가 있었음. 다만 **구조 부채는 실재** — §12-4 |
| `cards.tsx`의 `../../assets/…` 상대경로 (규칙 위반) | "src 밖으로 나가는 상대경로는 이 한 줄뿐"이라는 근거가 거짓. `utils/app-version.ts:2`의 `import appConfig from "../../app.json"`이 **완전히 같은 형태**의 선례 |

**확정 2건:**

| # | 내용 | 조치 |
|---|---|---|
| **C1** | 설계서 §4-2·§4-3이 `require("@/assets/…")`로 적혀 있는데 실제 코드는 `require("../../assets/…")`. `@/`는 `./src/*`로만 매핑돼 해석 불가 | ✅ **설계서를 코드에 맞춰 정정**(코드가 옳다 — 위 기각 사유 참조) |
| **C2** | iOS 기본 촬영 포맷 **HEIC**가 415로 거절돼 기사 저장이 중단됨 | ⚠️ **§12-3** — 0006이 만든 문제가 아님. 별건 |

### 12-3. C2 — HEIC는 이번 작업이 만든 문제가 아니다

| | `discussion-media.ts:34` (토론방 첨부, RFC 0004) | `news-media.ts:35` (이번 작업) |
|---|---|---|
| 허용 MIME | `jpeg` `png` `webp` `gif` | `jpeg` `png` `webp` `gif` |

**두 화이트리스트가 동일하다.** 즉 아이폰 관리자는 지금도 **토론방에 카메라 사진을 첨부할 수 없다.** 이번 작업은 기존 규칙을 그대로 따랐을 뿐이고, HEIC 거절은 RFC 0004/0005 시절부터 있던 **선재 결함**이다.

근거 사슬(검증자가 의존 패키지 소스까지 확인):
1. `photo-grid-picker.tsx`의 `readableUriOf`가 iOS에서 `getAssetInfoAsync().localUri`를 반환 → HEIC 사진이면 `.HEIC` 파일
2. `file-type@22.0.1`이 ftyp 브랜드로 HEIC를 감지해 `image/heic`를 돌려줌
3. 화이트리스트에 없으므로 415 `BAD_IMAGE_TYPE`
4. Jimp v1은 HEIC를 **디코드하지 못하므로** 화이트리스트에 넣어도 그 다음 단계에서 실패한다 → 조기 거절 자체는 옳다

**진짜 해법은 클라이언트에서 JPEG로 변환하는 것**이며 `expo-image-manipulator`가 필요하다(현재 미설치). 새 native 패키지 도입은 사용자 승인 사항이므로 **이 RFC 범위 밖으로 남긴다.** → **D6**

> 사용자의 상시 요구사항인 "Android/iOS 기능 차이 없어야 한다"에 걸리는 항목이다. 다만 **토론방 첨부와 뉴스 썸네일을 한 번에** 고치는 것이 맞으므로 별도 작업으로 잡는다.

### 12-4. 후속으로 남긴 것 (코드 에러 아님)

| # | 내용 |
|---|---|
| F1 | `PhotoGridPicker`가 이제 토론방·뉴스 두 화면에서 쓰인다. `apps/native/CLAUDE.md` 규칙상 `src/components/`로 승격이 맞으나, 옮기면 범위 밖인 `discussion-room/index.tsx`의 import를 건드려야 해 현행 유지 |
| F2 | `NewsThumb`가 더 이상 `thumbHint`·`sentiment`를 읽지 않아 **native 전체에서 `NewsItem.thumbHint` 참조가 0건**이 됐다. Q4 확정("남긴다")대로 타입·더미데이터·API의 `thumbHintOf()`는 그대로 살아 있다 |
| F3 | 업로드 에러 `code`는 `discussion-media`와 같은 영문 상수(`NO_SESSION`/`FORBIDDEN`/`NO_BUCKET`/`NO_FILE`/`IMAGE_TOO_LARGE`/`BAD_IMAGE_TYPE`/`BAD_IMAGE`), 사용자 노출 문구는 한국어로 통일 |
| F4 | `apps/server/src/server.ts`는 register 1줄만 허용이었으나 **import 1줄도 불가피**하게 추가됐다(총 2줄, 그 외 무변경) |

### 12-5. 검증하지 못한 것

- **기능 2(관리자 업로드)를 실제로 실행해 보지 못했다.** `NEWS_THUMBNAIL_BUCKET`이 로컬 server `.env`에도 없어 라우트가 503으로 꺼져 있다. Fastify 부팅 프로브로 **라우트 등록과 multipart 이중등록 없음**까지만 확인됐다.
- 아이폰 실기기·시뮬레이터 검증 없음(맥 없음).
- 독점 칩은 로컬 DB에 `sourceType='manual'` 기사가 **0건**이라 화면에서 확인하지 못했다. 관리자로 기사를 하나 써 봐야 한다.

---

## 13. 작업 계획 (승인 후)

1. 새 이슈 생성 — "뉴스 썸네일: 기본 이미지 + 관리자 업로드"
2. 새 브랜치 `feat/rfc-0006-news-thumbnail` (base = `main`)
3. 커밋 순서: ① RFC 문서 ② 기능 1(기본 이미지) ③ 기능 2(관리자 업로드)
4. 새 PR 생성 — **main 머지는 하지 않는다**(PR 생성까지)
