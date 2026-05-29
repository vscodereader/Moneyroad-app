# native(Expo) → iOS TestFlight 자동 배포

`apps/native`를 EAS로 빌드하고 App Store Connect(TestFlight)에 업로드한다. Android(Play
internal)와 **동일한 워크플로**(`.github/workflows/native.yml`)를 쓰며, 실행 시
`platform: ios`만 고르면 된다. 워크플로 코드 변경은 없다.

> iOS는 "트랙" 개념이 없다. `eas submit`이 빌드를 App Store Connect에 올리면 자동으로
> **TestFlight**로 들어가고, Apple 처리(보통 5~30분) 후 내부 테스터가 설치할 수 있다.
> App Store 정식 출시는 ASC에서 별도 "심사 제출"을 해야 하며 이 자동화 범위가 아니다.

---

## 현재 상태 (2026-05-25 확인)

| 항목 | 상태 |
|---|---|
| Apple Developer Program 멤버십 | ✅ 가입됨 |
| App Store Connect 앱(`kr.ai.moneyroad`) 생성 | ⬜ 필요 (→ `ascAppId` 획득) |
| iOS 빌드 자격증명(인증서·프로비저닝) EAS 등록 | ⬜ 필요 |
| App Store Connect API 키(제출용) EAS 등록 | ⬜ 필요 |
| `eas.json`의 `ascAppId` 실제 값 입력 | ⬜ 필요 (현재 `REPLACE_WITH_ASC_APP_ID`) |
| `EXPO_TOKEN` GitHub Secret | ✅ 완료(Android 때 등록) |

iOS는 처음이라 아래 1~5를 한 번씩 하면 된다. 대부분 **로컬에서 Apple 로그인**이 필요한
대화식 작업이라(=EAS 서버에 자격증명을 적재) 직접 진행해야 한다.

---

## 1. iOS 빌드 자격증명 생성 (첫 iOS 빌드, 로컬·대화식)

EAS가 Apple에 로그인해 **번들 ID 등록 + 배포 인증서 + 프로비저닝 프로파일**을 자동
생성하고 EAS 서버에 보관하게 한다. 이게 끝나면 이후 CI(비대화식) 빌드가 그 자격증명을
재사용한다.

```bash
cd apps/native
eas build --platform ios --profile production
#   → Apple 계정 로그인(앱 암호/2FA)
#   → "Bundle Identifier kr.ai.moneyroad ... register?" → Yes
#   → Distribution Certificate / Provisioning Profile 생성 → EAS에 저장
```

빌드가 끝나면 `.ipa`가 나온다(아직 제출 안 함). 이 시점에 번들 ID가 Apple에 등록된다.

## 2. App Store Connect에 앱 생성 → `ascAppId` 확보

1. https://appstoreconnect.apple.com → **나의 앱 → ＋ → 새로운 앱**
2. 플랫폼 **iOS**, 이름, 기본 언어, **번들 ID = `kr.ai.moneyroad`**(1단계에서 등록됨), SKU(임의 고유값)
3. 생성 후 **앱 정보** 페이지에서 **Apple ID**(숫자) 확인 → 이게 `ascAppId`다.
   - (URL에서도 보임: `.../apps/<이 숫자>/...`)

## 3. eas.json에 ascAppId 입력

`apps/native/eas.json`의 `submit.internal.ios.ascAppId`와 `submit.production.ios.ascAppId`의
`REPLACE_WITH_ASC_APP_ID`를 2단계 숫자로 교체.

> 이 숫자만 알려주면 대신 채워 넣어줄 수 있다.

## 4. App Store Connect API 키 등록 (제출용, CI 비대화식 업로드의 핵심)

Android의 서비스계정 키에 해당. 가장 쉬운 방법은 첫 제출을 **로컬에서 대화식**으로 돌려
EAS가 API 키를 만들어 보관하게 하는 것:

```bash
cd apps/native
eas submit --platform ios --profile internal --latest
#   → API 키 없음 감지 → Apple 로그인 → ASC API Key 자동 생성·EAS 저장(동의)
#   → 1단계에서 만든 .ipa를 TestFlight에 업로드
```

> 수동 선호 시: ASC → 사용자 및 액세스 → 통합 → App Store Connect API → 키 생성
> (Issuer ID/Key ID/.p8) 후 `eas credentials -p ios`에서 "App Store Connect API Key"로 등록.

이 한 번으로 **첫 TestFlight 업로드 + API 키 EAS 등록**이 동시에 끝난다.

## 5. TestFlight 내부 테스터 추가

ASC → 해당 앱 → **TestFlight** → 내부 테스트 그룹에 팀원(ASC 사용자) 추가. 내부 테스트는
심사 없이 바로 설치 가능(최대 100명). 외부 테스터는 베타 앱 심사가 필요.

---

## 이후 자동 배포 (CI)

1~4가 끝나면 GitHub **Actions → `native build & submit` → Run workflow**:

| 입력 | iOS 배포 시 값 |
|---|---|
| `platform` | `ios` (또는 `all`로 android와 동시에) |
| `profile` | `production` |
| `submit` | `true` |

내부 실행 명령:
```bash
eas build --platform ios --profile production --non-interactive \
  --auto-submit-with-profile internal
```

빌드(EAS, 보통 15~25분) 후 자동으로 App Store Connect에 업로드 → TestFlight 반영.
빌드 번호는 `eas.json`의 `autoIncrement: true`로 매 빌드 자동 증가.

## 자주 보는 실패
- `ascAppId`가 placeholder → 3단계 미완료
- "No App Store Connect API Key" (CI에서) → 4단계 미완료(키가 EAS에 없음)
- "Invalid Provisioning Profile" → 1단계 자격증명 재생성(`eas credentials -p ios`)
- TestFlight에서 "Missing Compliance" 표시 → ASC에서 수출 규정(암호화) 질문에 1회 응답
  필요(앱 빌드 후 ASC에서 처리). 자동 응답하려면 app.json ios에
  `infoPlist.ITSAppUsesNonExemptEncryption: false` 추가 가능.
