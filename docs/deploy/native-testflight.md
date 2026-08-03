# native(Expo) → iOS TestFlight 자동 배포

`apps/native`를 EAS로 빌드하고 App Store Connect(TestFlight)에 업로드한다. Android(Play
internal)와 **동일한 워크플로**(`.github/workflows/native.yml`)를 쓰며, 실행 시
`platform: ios`만 고르면 된다. 워크플로 코드 변경은 없다.

> iOS는 "트랙" 개념이 없다. `eas submit`이 빌드를 App Store Connect에 올리면 자동으로
> **TestFlight**로 들어가고, Apple 처리(보통 5~30분) 후 내부 테스터가 설치할 수 있다.
> App Store 정식 출시는 ASC에서 별도 "심사 제출"을 해야 하며 이 자동화 범위가 아니다.

---

<!-- vscodereader 2026-07-30 수정: 기존 미완료였던 App Store Connect 앱 ID 입력과
암호화 선언이 저장소 설정에 반영되어, 코드로 확인 가능한 항목만 완료 처리. -->
## 현재 상태 (2026-07-30 저장소 코드 기준)

| 항목 | 상태 |
|---|---|
| Apple Developer Program 멤버십 | ✅ 가입됨 |
| App Store Connect 앱(`kr.ai.moneyroad`) 생성 | `ascAppId=6772923139` 설정 확인. 실제 ASC 상태는 외부 계정에서 확인 필요 |
| iOS 빌드 자격증명(인증서·프로비저닝) EAS 등록 | 외부 EAS 계정에서 확인 필요 |
| App Store Connect API 키(제출용) EAS 등록 | 외부 EAS 계정에서 확인 필요 |
| `eas.json`의 `ascAppId` 실제 값 입력 | ✅ production/internal/closed/open 모두 입력 |
| `ITSAppUsesNonExemptEncryption: false` | ✅ `app.json` 입력 |
| `EXPO_TOKEN` GitHub Secret | ✅ 완료(Android 때 등록) |

아래 절은 최초 설정 또는 자격증명 재생성이 필요할 때의 절차다. EAS 자격증명과 ASC API
키는 저장소 코드로 확인할 수 없으므로 실제 계정에서 상태를 확인한다.

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

## 2. App Store Connect 앱·`ascAppId` 확인(완료, 재설정 참고)

1. https://appstoreconnect.apple.com → **나의 앱 → ＋ → 새로운 앱**
2. 플랫폼 **iOS**, 이름, 기본 언어, **번들 ID = `kr.ai.moneyroad`**(1단계에서 등록됨), SKU(임의 고유값)
3. 생성 후 **앱 정보** 페이지에서 **Apple ID**(숫자) 확인 → 이게 `ascAppId`다.
   - (URL에서도 보임: `.../apps/<이 숫자>/...`)

## 3. eas.json의 ascAppId 확인(완료)

<!-- vscodereader 2026-07-30 수정: placeholder였던 ascAppId가 실제 값으로
입력되어 완료 상태와 적용 프로필을 기록. -->
`apps/native/eas.json`의 production/internal/closed/open iOS submit 프로필에
`ascAppId: "6772923139"`가 입력되어 있다.

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
- `ascAppId` 누락·오입력 → `6772923139`와 App Store Connect 앱을 대조
- "No App Store Connect API Key" (CI에서) → 4단계 미완료(키가 EAS에 없음)
- "Invalid Provisioning Profile" → 1단계 자격증명 재생성(`eas credentials -p ios`)
<!-- vscodereader 2026-07-30 수정: 기존 추가 예정이었던 암호화 선언이 app.json에
이미 반영되어 현재 설정을 명시. -->
- TestFlight에서 "Missing Compliance" 표시 → `app.json`에는 이미
  `infoPlist.ITSAppUsesNonExemptEncryption: false`가 있으므로 빌드 반영 여부와
  ASC 처리 상태를 확인
