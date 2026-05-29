# Server 배포 (GCP Cloud Run + Cloud SQL)

현재 아키텍처: Cloud Run(서버) + Cloud SQL for PostgreSQL + Artifact Registry(이미지) +
Secret Manager(시크릿) + Cloud Run Job(마이그레이션). 빌드는 Cloud Build에서
`linux/amd64`로 수행한다(로컬 arm64 크로스 빌드 회피).

> 마이그레이션은 서비스 기동과 분리되어 있다. 배포할 때마다 **Job을 먼저 1회 실행**한
> 뒤 서비스를 배포/갱신한다.

---

## 인스턴스 교체: moneyroad-db → moneyroad-prod (PostgreSQL 18)

기존 dev 인스턴스(`moneyroad-db`, PG16, db-f1-micro)에서 운영 인스턴스
(`moneyroad-prod`, **PG18**, **db-custom-1-3840**)로 **빈 스키마로 새로** 전환하는
런북. 기존 데이터는 옮기지 않는다(유저·세션·시그널·관심종목 전부 새로 시작 → 재가입
필요). `moneyroad-realtime`은 Cloud SQL 미연결이라 영향 없다.

> 바꾸는 곳은 **3군데뿐**: ① `database-url` 시크릿 ② `moneyroad-migrate` Job의 Cloud SQL
> 연결 ③ `moneyroad-server` 서비스의 Cloud SQL 연결. 런타임 SA 권한(`cloudsql.client`,
> `secretAccessor`)은 동일 프로젝트라 이미 부여돼 있어 추가 작업 없음.

```bash
export PROJECT=moneyroad-app
export REGION=asia-northeast3
export SQL_INSTANCE=moneyroad-prod
export DB_NAME=moneyroad
export DB_USER=moneyroad
# hex는 0-9a-f뿐이라 URL-safe → DATABASE_URL에 그대로 넣어도 안전 (256비트)
export DB_PASSWORD=$(openssl rand -hex 32)
export SERVICE=moneyroad-server
export JOB=moneyroad-migrate
gcloud config set project $PROJECT

# 1) 인스턴스 생성 (PG18, 운영 tier) — 약 5~10분
#    커스텀 tier(db-custom-*)는 Enterprise 에디션 전용. 생략 시 Enterprise Plus로 잡혀
#    db-perf-optimized-* 만 허용되며 db-custom-1-3840이 거부된다.
gcloud sql instances create $SQL_INSTANCE \
  --database-version=POSTGRES_18 \
  --edition=enterprise \
  --tier=db-custom-1-3840 \
  --region=$REGION \
  --storage-type=SSD --storage-size=10GB \
  --availability-type=zonal

# 2) DB + 유저 생성
gcloud sql databases create $DB_NAME --instance=$SQL_INSTANCE
gcloud sql users create $DB_USER --instance=$SQL_INSTANCE --password="$DB_PASSWORD"
export CONN_NAME=$(gcloud sql instances describe $SQL_INSTANCE --format='value(connectionName)')
echo "connection name: $CONN_NAME"   # moneyroad-app:asia-northeast3:moneyroad-prod

# 3) database-url 시크릿 새 버전 추가 (소켓 host = 새 connection name)
export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$CONN_NAME"
printf '%s' "$DATABASE_URL" | gcloud secrets versions add database-url --data-file=-

# 4) 마이그레이션 Job을 새 인스턴스로 재연결 후 실행 (빈 스키마 생성)
gcloud run jobs update $JOB --region=$REGION --set-cloudsql-instances=$CONN_NAME
gcloud run jobs execute $JOB --region=$REGION --wait

# 5) server 서비스를 새 인스턴스로 재연결 (새 리비전이 database-url:latest 재반영)
gcloud run services update $SERVICE --region=$REGION --set-cloudsql-instances=$CONN_NAME

# 6) 확인: URL 받아 헬스/로그에서 DB 연결 OK, 새 가입 동작 확인
gcloud run services describe $SERVICE --region=$REGION --format='value(status.url)'
```

> ⚠️ **순서 중요**: 마이그레이션(4) → server 재연결(5). 스키마가 없는 상태로 server가
> 먼저 붙으면 쿼리가 깨진다. `--set-cloudsql-instances`는 **교체**(기존 `moneyroad-db`
> 연결을 떼고 새 연결로 대체)다. `:latest` 시크릿은 Job 실행·서비스 리비전 생성 시점에
> 재해석되므로, 3번 이후의 4·5번이 자동으로 새 `DATABASE_URL`을 집는다.

전환·검증이 끝나면 기존 `moneyroad-db`는 롤백 여지를 위해 일정 기간 보존했다가 삭제한다:
`gcloud sql instances delete moneyroad-db`.

---

## 0. 변수

```bash
export PROJECT=moneyroad-app
export REGION=asia-northeast3            # 서울
export AR_REPO=moneyroad                 # Artifact Registry 저장소
export SQL_INSTANCE=moneyroad-prod       # 운영. (구 dev 인스턴스: moneyroad-db)
export SQL_TIER=db-custom-1-3840         # 운영 1 vCPU/3.75GB. dev는 db-f1-micro
export DB_NAME=moneyroad
export DB_USER=moneyroad
export DB_PASSWORD='<강력한-비밀번호>'
export SERVICE=moneyroad-server
export JOB=moneyroad-migrate

export IMAGE=$REGION-docker.pkg.dev/$PROJECT/$AR_REPO/server:$(git rev-parse --short HEAD)

gcloud config set project $PROJECT
```

## 1. API 활성화 (최초 1회)

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
```

## 2. Artifact Registry 저장소 (최초 1회)

```bash
gcloud artifacts repositories create $AR_REPO \
  --repository-format=docker --location=$REGION
```

## 3. 이미지 빌드 & 푸시 (Cloud Build, amd64)

```bash
# 저장소 루트에서 실행
gcloud builds submit --config cloudbuild.yaml --substitutions=_IMAGE=$IMAGE
```

## 4. Cloud SQL (최초 1회)

```bash
gcloud sql instances create $SQL_INSTANCE \
  --database-version=POSTGRES_18 \
  --edition=enterprise \
  --tier=$SQL_TIER \
  --region=$REGION \
  --storage-type=SSD --storage-size=10GB \
  --availability-type=zonal

gcloud sql databases create $DB_NAME --instance=$SQL_INSTANCE
gcloud sql users create $DB_USER --instance=$SQL_INSTANCE --password="$DB_PASSWORD"

export CONN_NAME=$(gcloud sql instances describe $SQL_INSTANCE --format='value(connectionName)')
echo "connection name: $CONN_NAME"   # PROJECT:REGION:INSTANCE
```

## 5. 시크릿 (Secret Manager)

Cloud SQL은 유닉스 소켓으로 붙으므로 `DATABASE_URL`의 host에 소켓 경로를 넣는다.

```bash
export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$CONN_NAME"

printf '%s' "$DATABASE_URL"                 | gcloud secrets create database-url            --data-file=-
printf '%s' "$(openssl rand -base64 32)"    | gcloud secrets create better-auth-secret      --data-file=-
printf '%s' "https://PLACEHOLDER"           | gcloud secrets create better-auth-url         --data-file=-   # 8단계에서 실제 URL로 갱신
printf '%s' "https://<앱-도메인>"            | gcloud secrets create cors-origin             --data-file=-
printf '%s' "<GOOGLE_GENERATIVE_AI_API_KEY>"| gcloud secrets create google-ai-key           --data-file=-
# realtime SSE 스트림 토큰 서명/검증 공유 시크릿 (realtime 배포에서 동일 시크릿 사용)
printf '%s' "$(openssl rand -base64 32)"    | gcloud secrets create stream-token-secret     --data-file=-
```

값 갱신은 `gcloud secrets versions add <name> --data-file=-`.

## 6. 런타임 서비스 계정 권한 (최초 1회)

```bash
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
export RUNTIME_SA=$PROJECT_NUMBER-compute@developer.gserviceaccount.com

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$RUNTIME_SA" --role="roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$RUNTIME_SA" --role="roles/cloudsql.client"
```

## 7. 마이그레이션 (Cloud Run Job) — 배포 때마다 먼저 실행

```bash
# 최초 1회: Job 생성 (migrate.mjs는 DATABASE_URL만 필요)
gcloud run jobs create $JOB \
  --image=$IMAGE --region=$REGION \
  --set-cloudsql-instances=$CONN_NAME \
  --set-secrets=DATABASE_URL=database-url:latest \
  --command=node --args=dist/migrate.mjs \
  --max-retries=1 --task-timeout=600

# 이후: 이미지 갱신 + 실행
gcloud run jobs update $JOB --image=$IMAGE --region=$REGION
gcloud run jobs execute $JOB --region=$REGION --wait
```

## 8. 서비스 배포 (Cloud Run)

```bash
gcloud run deploy $SERVICE \
  --image=$IMAGE --region=$REGION \
  --allow-unauthenticated \
  --port=8080 \
  --set-cloudsql-instances=$CONN_NAME \
  --set-secrets=DATABASE_URL=database-url:latest,BETTER_AUTH_SECRET=better-auth-secret:latest,BETTER_AUTH_URL=better-auth-url:latest,CORS_ORIGIN=cors-origin:latest,GOOGLE_GENERATIVE_AI_API_KEY=google-ai-key:latest,STREAM_TOKEN_SECRET=stream-token-secret:latest \
  --min-instances=0 --max-instances=4 \
  --cpu=1 --memory=512Mi

# 배포 후 실제 URL 확인 → BETTER_AUTH_URL 갱신 → 재배포
export SERVICE_URL=$(gcloud run services describe $SERVICE --region=$REGION --format='value(status.url)')
printf '%s' "$SERVICE_URL" | gcloud secrets versions add better-auth-url --data-file=-
gcloud run services update $SERVICE --region=$REGION   # 새 시크릿 버전 반영
```

## 매 배포 요약

```bash
export IMAGE=$REGION-docker.pkg.dev/$PROJECT/$AR_REPO/server:$(git rev-parse --short HEAD)
gcloud builds submit --config cloudbuild.yaml --substitutions=_IMAGE=$IMAGE   # 빌드
gcloud run jobs update $JOB --image=$IMAGE --region=$REGION && \
  gcloud run jobs execute $JOB --region=$REGION --wait                        # 마이그레이션
gcloud run deploy $SERVICE --image=$IMAGE --region=$REGION                    # 배포
```

## 참고
- `PORT`: Cloud Run이 자동 주입(기본 8080). 서버는 `process.env.PORT`를 읽어 `0.0.0.0`에 바인딩한다.
- 시세 실시간(WebSocket)은 별도 단일 인스턴스 서비스로 분리 예정(KIS 업스트림 1연결 유지 + 필요 시 Memorystore 백플레인).
