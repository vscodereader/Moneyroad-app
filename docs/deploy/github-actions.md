# GitHub Actions 자동 배포 (Cloud Run)

GitHub Actions가 **Workload Identity Federation(WIF)** 로 GCP에 키리스 인증한 뒤,
기존 Cloud Build로 이미지를 빌드하고 Cloud Run에 배포한다.

- 워크플로: `.github/workflows/cd.yml`(오케스트레이터) + `.github/workflows/deploy.yml`(재사용)
- 배포 분리:
  - **자동** — `main` push 시 변경된 앱만 배포(`apps/server` / `apps/realtime`, 공통 `packages/**`·lockfile 변경은 둘 다)
  - **수동** — Actions 탭 → `CD` → `Run workflow` → `server` / `realtime` / `both` 선택
- 빌드는 `cloudbuild.yaml`(linux/amd64) 재사용, 이미지 태그는 커밋 short SHA
- `server`는 배포 전 마이그레이션 Job(`moneyroad-migrate`)을 먼저 실행

> ⚠️ 전제: Cloud Run 서비스(`moneyroad-server`, `moneyroad-realtime`)와 마이그레이션
> Job(`moneyroad-migrate`)은 **최초 1회 수동 생성**되어 있어야 한다(시크릿·Cloud SQL·
> realtime 특수 플래그 포함). 워크플로는 `--image`만 갱신하므로 기존 설정을 보존한다.
> 최초 생성 절차는 `apps/server/deploy/README.md`, `apps/realtime/deploy/README.md` 참고.

---

## 1. WIF + 배포용 서비스 계정 설정 (최초 1회)

아래를 로컬에서 한 번 실행한다(소유자/IAM 권한 필요).

```bash
export PROJECT=moneyroad-app
export REPO=mkvista-work/moneyroad-app          # owner/repo
export POOL=github
export PROVIDER=github-provider
export DEPLOY_SA=github-deployer                 # 새로 만들 배포용 SA 이름

gcloud config set project "$PROJECT"
export PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')

# 1) 필요한 API 활성화
gcloud services enable \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com

# 2) 배포용 서비스 계정 생성 (이미 있으면 "already exists" 에러가 나는데 무시하고 진행)
export DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT}.iam.gserviceaccount.com"
gcloud iam service-accounts describe "$DEPLOY_SA_EMAIL" >/dev/null 2>&1 || \
gcloud iam service-accounts create "$DEPLOY_SA" \
  --display-name="GitHub Actions deployer"

# 3) 배포용 SA 권한
#    - run.admin            : Cloud Run 서비스/Job 배포
#    - cloudbuild.builds.editor : Cloud Build 제출
#    - artifactregistry.writer  : 이미지 푸시
#    - storage.admin        : Cloud Build 소스 업로드 버킷 (추후 버킷 단위로 축소 가능)
for ROLE in \
  roles/run.admin \
  roles/cloudbuild.builds.editor \
  roles/artifactregistry.writer \
  roles/storage.admin ; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${DEPLOY_SA_EMAIL}" --role="$ROLE" --condition=None
done

#    - Cloud Run이 런타임 SA(기본 compute SA)를 쓰므로 그 SA에 대한 actAs 권한 필요
export RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" --role="roles/iam.serviceAccountUser"

# 4) Workload Identity Pool + OIDC provider
gcloud iam workload-identity-pools create "$POOL" \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
  --location=global --workload-identity-pool="$POOL" \
  --display-name="GitHub provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == '${REPO%%/*}'"

# 5) 이 저장소에서만 배포용 SA를 가장(impersonate)하도록 바인딩
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}"

# 6) 워크플로에 넣을 값 출력
echo "GCP_WIF_PROVIDER = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "GCP_DEPLOY_SA    = ${DEPLOY_SA_EMAIL}"
```

## 2. GitHub Secrets 등록

위 6번 출력값을 저장소 **Settings → Secrets and variables → Actions → New repository secret** 에 등록한다.

| Secret 이름 | 값 |
|---|---|
| `GCP_WIF_PROVIDER` | `projects/<번호>/locations/global/workloadIdentityPools/github/providers/github-provider` |
| `GCP_DEPLOY_SA` | `github-deployer@moneyroad-app.iam.gserviceaccount.com` |

> GitHub Environment(`production`) 보호 규칙을 쓰려면 `deploy.yml`의 `environment:`
> 주석을 해제하고 Environment 단위로 시크릿을 옮기면 된다.

## 3. 동작 확인

1. `apps/realtime/**`만 수정 → `main` push → `CD` 실행에서 **realtime 잡만** 동작하는지 확인
2. Actions 탭 → `CD` → `Run workflow` → `server` 선택 → 마이그레이션 후 server 배포 확인
3. 실패 시 자주 보는 원인
   - 권한 부족: 1번 IAM 바인딩 누락 → 에러 메시지의 누락 role 추가
   - 서비스/Job 미존재: 최초 1회 수동 생성 필요(README 참고)
   - 토큰 만료/리전 불일치: `REGION=asia-northeast3` 확인
