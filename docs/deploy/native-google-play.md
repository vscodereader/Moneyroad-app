# native(Expo) → Google Play 내부 테스트 자동 배포

`apps/native`를 EAS로 빌드하고 Google Play **내부 테스트(internal)** 트랙에 제출한다.

- 워크플로: `.github/workflows/native.yml` (수동 실행 전용)
- 빌드는 EAS 서버에서 수행, GitHub 러너는 `eas-cli`만 구동
- 제출 대상: `eas.json`의 `submit.internal.android.track = "internal"`

> 빌드/제출 자체는 EAS가 키스토어·서비스계정 등 자격증명을 보관하므로, GitHub에는
> **`EXPO_TOKEN` 하나만** 있으면 된다. Google Play 서비스계정 키는 EAS에 등록한다.

---

## 현재 상태 (2026-05-25 확인)

| 항목 | 상태 |
|---|---|
| Google Play 서비스계정 키 EAS 등록·할당 | ✅ 완료 (`play-console-service-account@moneyroad-app...`, `kr.ai.moneyroad`에 assigned) |
| Play Console 앱 생성 + 첫 AAB 수동 업로드 | ✅ 사실상 완료 (과거 EAS로 Play 배포 이력 있음) |
| **`EXPO_TOKEN` GitHub Secret 등록** | ⬜ **남은 작업 — 이것만 하면 CI 자동 제출 작동** |

> 따라서 아래 "사전 준비"에서 **1번(EXPO_TOKEN)만** 하면 된다. 2~4번은 이미 끝났으니
> 참고/재설정용이다.

---

## 사전 준비 (최초 1회)

### 1. EXPO_TOKEN 발급 → GitHub Secret 등록 ⬜ (남은 작업)

1. https://expo.dev/accounts/mkvista/settings/access-tokens → **Create token**
2. 저장소 **Settings → Secrets and variables → Actions** 에 등록
   - `EXPO_TOKEN` = 발급받은 토큰

### 2. Google Play Console에 앱 생성 + 첫 AAB 수동 업로드 ✅ (완료, 참고용)

> Google Play는 **새 앱의 첫 번째 AAB는 콘솔에서 수동 업로드**해야 한다. 이게 끝나기
> 전에는 API(`eas submit`)로 어떤 트랙에도 올릴 수 없다. (가장 흔한 실패 원인)

1. Play Console에서 패키지명 `kr.ai.moneyroad` 로 앱 생성
2. AAB 1개를 로컬에서 빌드해 받는다(서비스계정 없이도 빌드는 됨):
   ```bash
   cd apps/native
   eas build --platform android --profile production
   ```
   완료되면 출력 링크에서 `.aab`를 다운로드.
3. Play Console → **테스트 → 내부 테스트 → 새 버전 만들기** 에서 그 `.aab`를 업로드해
   1회 릴리스. (내부 테스터 목록도 이때 추가)

### 3. Google Play 서비스계정 키 생성 + 권한 부여 ✅ (완료, 참고용)

1. **Play Console → 설정 → API 액세스** → 새 서비스계정 만들기(연결된 GCP 프로젝트로 이동)
2. GCP에서 해당 서비스계정의 **키(JSON)** 발급 → 다운로드
3. 다시 Play Console **API 액세스** 화면에서 그 서비스계정에 권한 부여:
   - 최소: **테스트 트랙에 출시 / 출시 관리** + 앱 정보 보기
   - 간단히 하려면 앱 단위 **관리자(모든 권한)** 도 가능

### 4. 서비스계정 키를 EAS에 등록 ✅ (완료, 참고용)

리포에 JSON을 커밋하지 말고 EAS 서버에 보관한다(워크플로는 path 불필요):

```bash
cd apps/native
eas credentials -p android
#   → (production/internal 등) 빌드 프로필 선택
#   → "Google Service Account"
#   → "Manage your Google Service Account Key for Play Store submissions"
#   → 다운받은 JSON 업로드
```

> 또는 `eas.json`의 `submit.internal.android`에 `serviceAccountKeyPath`로 로컬 경로를
> 줄 수도 있지만, CI에서는 EAS 보관 방식이 깔끔하다(시크릿이 리포에 안 남음).

---

## 실행 (자동 배포)

GitHub **Actions 탭 → `native build & submit` → Run workflow**:

| 입력 | 기본 | 설명 |
|---|---|---|
| `platform` | `android` | `android` / `ios` / `all` |
| `profile` | `production` | EAS 빌드 프로필(스토어 AAB) |
| `submit` | `true` | 빌드 후 internal 트랙 자동 제출 |

내부적으로 실행되는 명령:
```bash
eas build --platform android --profile production --non-interactive \
  --auto-submit-with-profile internal
```

빌드(EAS 서버, 보통 10~20분) 완료 후 자동으로 내부 테스트 트랙에 올라간다. 진행 상황은
워크플로 로그의 EAS 빌드 링크 또는 https://expo.dev/accounts/mkvista 에서 확인.

## 확인
1. Play Console → 테스트 → 내부 테스트 에 새 버전이 올라왔는지
2. 내부 테스터 링크로 기기에서 설치되는지
3. 버전 코드는 `eas.json`의 `autoIncrement: true`로 매 빌드 자동 증가

## 자주 보는 실패
- `EXPO_TOKEN` 누락/만료 → 1번 재발급
- "첫 릴리스를 수동으로 업로드해야 함" → 2번 미완료
- 서비스계정 권한 부족 → 3번에서 트랙 출시 권한 확인
- iOS 제출(`platform: ios/all`)은 `eas.json`의 `ascAppId`(`REPLACE_WITH_ASC_APP_ID`)를
  실제 App Store Connect 앱 ID로 채워야 동작
