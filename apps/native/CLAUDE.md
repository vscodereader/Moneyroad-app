# Native(Expo) 폴더 구조 규칙

이 앱(`apps/native`)의 디렉터리/배치 규칙. Expo 공식 권장
([expo.dev/blog/expo-app-folder-structure-best-practices](https://expo.dev/blog/expo-app-folder-structure-best-practices))을
이 프로젝트 컨벤션으로 구체화한 것이다. **native 코드 작성·이동·생성 시 반드시 지킨다.**

루트 규칙(`/.claude/CLAUDE.md`, Ultracite/Biome)은 그대로 적용되며, 이 문서는
그 위에 **구조(structure)** 규칙을 더한다.

---

## 디렉터리 역할 (모든 소스는 `src/` 아래)

| 디렉터리 | 용도 | 넣는 것 / 안 넣는 것 |
|---|---|---|
| `src/app` | **라우트 전용** (Expo Router) | 라우트 파일, `_layout.tsx`, 라우트 그룹만. 화면 마크업·비즈니스 로직 ❌ |
| `src/screens` | 화면 컴포넌트 | `src/screens/<name>/index.tsx` (1 화면 = 1 디렉터리) |
| `src/components` | 재사용 UI | 디자인 시스템 프리미티브(`ui`, `cards`, `icons`, `charts` 등) |
| `src/hooks` | 재사용 훅 | `use-*.ts` |
| `src/lib` | 외부 SDK/클라이언트 설정 | `auth-client`, `stream-token` 등 통합 코드 |
| `src/utils` | 순수 헬퍼 + 앱 데이터/설정 | `format`, `nav`, `theme`, `orpc`, `data` 등 |
| `src/contexts` | React Context 프로바이더 | `*-context.tsx` |

---

## 핵심 규칙

1. **`src/` 최상위 + `app/`는 그 안에 둔다.** 새 소스는 위 디렉터리 중 하나에만 만든다.

2. **라우트 파일은 얇게 (thin route).** `src/app`의 라우트 파일은 라우팅만 담당한다.
   화면은 `src/screens`에서 import해 렌더한다. UI 마크업/데이터 패칭을 라우트
   파일에 직접 쓰지 않는다.
   ```tsx
   // src/app/(moneyroad)/(tabs)/news.tsx
   import NewsScreen from "@/screens/news";
   export default function NewsRoute() {
     return <NewsScreen />;
   }
   ```

3. **화면은 `src/screens/<name>/index.tsx`** 디렉터리/인덱스 구조로 통일한다.
   default export 1개(화면 컴포넌트). 화면 전용 하위 컴포넌트는 같은 디렉터리에 둔다.

4. **네비게이터는 `_layout.tsx`** 로 정의한다(Stack/Tabs/Drawer). 라우트 그룹은
   괄호 디렉터리 `(group)` 로 URL에 영향 없이 묶는다.

5. **인증·온보딩 게이트는 라우트 파일(또는 `_layout`)에 둔다.** 화면 컴포넌트는
   "로그인된 사용자" 전제로 단순하게 유지한다.
   ```tsx
   // 게이트는 라우트에서: 세션 없으면 redirect, 있으면 화면 렌더
   if (!session?.user) return <Redirect href="/(moneyroad)/login" />;
   return <MyPageScreen />;
   ```

6. **라우트 이동은 `src/utils/nav.ts` 헬퍼로 한다.** 화면 곳곳에서
   `router.push("/..." as Href)`를 흩뿌리지 않는다. 새 경로가 필요하면 `nav`에 추가.

7. **import는 `@/` 별칭** 사용(`@/* → src/*`). `../../..` 깊은 상대경로 금지.

8. **네이밍**
   - 라우트 파일/그룹: kebab-case, 소문자 (`stock/[code].tsx`, `(tabs)`)
   - 컴포넌트: PascalCase export
   - 훅 파일: `use-*.ts`
   - 화면 디렉터리: kebab-case (`screens/stock-detail/index.tsx`)

---

## 하지 말 것 (Don't)

- ❌ `src/app` 안에 화면/비즈니스 로직/재사용 컴포넌트를 정의 (라우트만)
- ❌ 라우트 파일에서 직접 `useQuery`/`fetch` 등 데이터 패칭
- ❌ barrel 파일(`index.ts`에서 전부 re-export) — Biome `noBarrelFile` 위반
- ❌ 깊은 상대경로 import (`../../../components`)
- ❌ 화면 컴포넌트 안에 인증 리다이렉트 로직 (라우트/레이아웃에서 처리)
