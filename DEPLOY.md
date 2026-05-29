# 배포 흐름 (DEPLOY)

이 문서는 MoneyRoad 모노레포의 **전체 배포 흐름**을 한눈에 보기 위한 개요다.
앱별 최초 설정·세부 명령은 각 상세 문서를 참고한다(아래 "상세 문서" 참고).

## 배포 대상

| 앱 | 위치 | 배포처 | 트리거 |
|---|---|---|---|
| **server** (API, Fastify+oRPC) | `apps/server` | GCP Cloud Run (`moneyroad-server`) | `main` push 자동 / 수동 |
| **realtime** (시세·뉴스 SSE) | `apps/realtime` | GCP Cloud Run (`moneyroad-realtime`) | `main` push 자동 / 수동 |
| **native** (Expo 앱) | `apps/native` | EAS 빌드 → App Store / Google Play | 수동 전용 |
| web | `apps/web` | (현재 CI 배포 워크플로 없음) | — |

공통 인프라: Artifact Registry(`moneyroad`, 이미지), Cloud SQL(`moneyroad-prod`,
PostgreSQL 18), Secret Manager(시크릿), Cloud Run Job(`moneyroad-migrate`, 마이그레이션).
리전은 모두 `asia-northeast3`(서울).

## 워크플로 구성

```
.github/workflows/
├── cd.yml       # 오케스트레이터: 변경 감지 → 어떤 앱을 배포할지 결정
├── deploy.yml   # 재사용 워크플로: 단일 앱을 Cloud Run에 배포 (cd.yml이 호출)
└── native.yml   # Expo 앱 EAS 빌드 + 스토어 제출 (독립, 수동 전용)
```

---

## 1. 서버 / realtime 배포 (Cloud Run)

`cd.yml`(오케스트레이터)이 무엇을 배포할지 정하고, 실제 빌드·배포는
`deploy.yml`(재사용 워크플로)이 앱별로 수행한다.

```
[main push]                          [수동 실행 (Actions → CD → Run workflow)]
     │                                          │
     ▼                                          ▼
cd.yml: paths-filter로 변경 감지          cd.yml: server / realtime / both 선택
  apps/server/** → server                       │
  apps/realtime/** → realtime                    │
  packages/**, lockfile → 둘 다                   │
     └──────────────┬───────────────────────────┘
                    ▼
        deploy.yml (앱마다 1회)
                    │
   ① WIF로 GCP 키리스 인증 (GCP_WIF_PROVIDER / GCP_DEPLOY_SA)
   ② Cloud Build로 이미지 빌드·푸시 (cloudbuild.yaml, linux/amd64)
        - 태그 = 커밋 short SHA
        - realtime은 _DOCKERFILE=apps/realtime/Dockerfile 지정
   ③ (server 한정) 마이그레이션 Job 실행
        - moneyroad-migrate 이미지 갱신 → execute --wait
   ④ Cloud Run 배포 (gcloud run deploy moneyroad-<app> --image=...)
```

핵심 포인트:
- **인증은 Workload Identity Federation(WIF)** — GitHub에 GCP 키 JSON을 두지 않는다.
  필요한 시크릿은 `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA` 두 개뿐.
- **이미지 태그 = 커밋 short SHA** → 롤백·추적 용이.
- **server는 배포 전에 마이그레이션 Job을 먼저 1회 실행**(서비스 기동과 분리).
- 워크플로는 `--image`만 갱신한다. **Cloud Run 서비스/Job·시크릿·Cloud SQL 연결·
  realtime 특수 플래그(`--no-cpu-throttling`, `min=max=1` 등)는 최초 1회 수동 생성**되어
  있어야 한다(`deploy.yml`은 기존 설정을 보존).

### 최초 1회 수동 생성 (전제)

자동 배포가 동작하려면 아래가 먼저 준비돼 있어야 한다(상세 문서에 명령 있음):
1. WIF Pool/Provider + 배포용 서비스 계정 + GitHub Secrets → `docs/deploy/github-actions.md`
2. server 인프라(Cloud SQL, 시크릿, 서비스, 마이그레이션 Job) → `apps/server/deploy/README.md`
3. realtime 서비스(단일 인스턴스 + CPU 상시 할당 플래그) → `apps/realtime/deploy/README.md`

---

## 2. 네이티브 앱 배포 (EAS → 스토어)

`native.yml`은 **수동 실행 전용**(빌드마다 EAS 비용·스토어 버전이 생기므로 push 자동
트리거 없음). 빌드는 EAS 서버에서 수행되고, GitHub 러너는 `eas-cli`만 구동한다.

```
[Actions → native build & submit → Run workflow]
   입력: platform(android/ios/all), profile(production/staging/preview), submit(bool)
                    │
                    ▼
   ① pnpm install (app.json 플러그인 평가용 워크스페이스 의존성)
   ② EXPO_TOKEN으로 EAS 인증
   ③ eas build --platform <p> --profile <p> --non-interactive
        submit=true 이면 --auto-submit-with-profile internal
                    │
                    ▼
   EAS 서버 빌드(10~20분) → (submit 시) 스토어 internal 트랙 자동 제출
        - Android: track=internal (내부 테스트)
        - 버전 코드: eas.json autoIncrement
```

핵심 포인트:
- 키스토어·Google Play 서비스계정 키 등 **자격증명은 EAS가 보관** → GitHub엔
  `EXPO_TOKEN` 하나만 필요.
- 빌드 프로필·제출 트랙 정의는 `apps/native/eas.json`.
- 상세/최초 설정: `docs/deploy/native-google-play.md`(Android),
  `docs/deploy/native-testflight.md`(iOS).

---

## 상세 문서

| 주제 | 문서 |
|---|---|
| GitHub Actions + WIF 자동 배포 설정 | `docs/deploy/github-actions.md` |
| server 인프라 최초 구축 (Cloud Run + Cloud SQL) | `apps/server/deploy/README.md` |
| realtime 서비스 배포 (SSE, 단일 인스턴스) | `apps/realtime/deploy/README.md` |
| Android(Google Play) 배포 | `docs/deploy/native-google-play.md` |
| iOS(TestFlight) 배포 | `docs/deploy/native-testflight.md` |
| 커스텀 도메인 연결 | `docs/deploy/custom-domain.md` |
| 이미지 빌드 설정 | `cloudbuild.yaml` |
| EAS 빌드/제출 프로필 | `apps/native/eas.json` |
