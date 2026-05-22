# Realtime 시세 서비스 배포 (Cloud Run, Phase 1)

종목 시세를 SSE로 단방향 푸시하는 서비스. **API 서버(`moneyroad-server`)와 별도**의
Cloud Run 서비스로 배포한다.

Phase 1은 **단일 인스턴스**(min=max=1)에서 KIS 1연결 + 클라이언트 fan-out을 한
프로세스로 처리한다(Redis 불필요). 트래픽이 늘면 Phase 2에서 ingestion 분리 +
Memorystore(Redis) 백플레인을 추가한다.

## 엔드포인트
- `GET /` , `GET /healthz` — 헬스체크
- `GET /stream/quotes?symbols=005930,000660` — SSE 스트림 (`event: quote`)

## ⚠️ Cloud Run 필수 설정
| 설정 | 값 | 이유 |
|---|---|---|
| `--no-cpu-throttling` | (CPU 상시 할당) | 백그라운드 KIS 수신·push 루프 유지. 기본값은 요청 처리 중에만 CPU |
| `--min-instances=1 --max-instances=1` | 단일 인스턴스 | KIS 1연결 보장, 콜드스타트 방지 |
| `--timeout=3600` | 60분 | SSE 연결 최대 시간 → 클라이언트 자동 재연결 |
| `--concurrency=250` | 높게 | SSE 연결은 대부분 idle |

## 변수
```bash
export PROJECT=moneyroad-app
export REGION=asia-northeast3
export AR_REPO=moneyroad
export SERVICE=moneyroad-realtime
export IMAGE=$REGION-docker.pkg.dev/$PROJECT/$AR_REPO/realtime:$(git rev-parse --short HEAD)
```

## 1. 빌드 (Cloud Build, amd64) — 저장소 루트에서
```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_IMAGE=$IMAGE,_DOCKERFILE=apps/realtime/Dockerfile
```

## 2. 시크릿

```bash
# 스트림 토큰 검증용 — server의 stream-token-secret과 반드시 동일한 값
printf '%s' "<32자+ 시크릿>" | gcloud secrets create stream-token-secret --data-file=- --project=$PROJECT

# (FEED=kis 일 때만)
printf '%s' "<KIS_APP_KEY>"    | gcloud secrets create kis-app-key    --data-file=- --project=$PROJECT
printf '%s' "<KIS_APP_SECRET>" | gcloud secrets create kis-app-secret --data-file=- --project=$PROJECT
# 런타임 SA에 secretAccessor는 server 배포 때 이미 부여됨
```

## 3. 배포
```bash
# mock 피드로 먼저 배포해 SSE 동작 확인
gcloud run deploy $SERVICE \
  --image=$IMAGE --region=$REGION --project=$PROJECT \
  --allow-unauthenticated \
  --port=8080 \
  --no-cpu-throttling \
  --min-instances=1 --max-instances=1 \
  --timeout=3600 --concurrency=250 \
  --cpu=1 --memory=512Mi \
  --set-env-vars=FEED=mock \
  --set-secrets=STREAM_TOKEN_SECRET=stream-token-secret:latest

# KIS 연동 시 (위 --set-env-vars/--set-secrets에 추가)
#   --set-env-vars=FEED=kis,KIS_ENV=prod \
#   --set-secrets=...,KIS_APP_KEY=kis-app-key:latest,KIS_APP_SECRET=kis-app-secret:latest
```

> ⚠️ `--allow-unauthenticated`은 Cloud Run 인프라 레벨 인증을 끄는 것일 뿐, 앱은
> 스트림 토큰으로 사용자 인증을 강제한다(토큰 없으면 401).

## 4. 확인
```bash
URL=$(gcloud run services describe $SERVICE --region=$REGION --format='value(status.url)')
# 1) 토큰 없이 → 401
curl -s -o /dev/null -w '%{http_code}\n' -H "Accept: text/event-stream" "$URL/stream/quotes?symbols=005930"
# 2) server에서 토큰 발급 후 → 스트림 (server /stream-token 은 로그인 세션 필요)
#    TOKEN=$(curl -s -X POST <SERVER_URL>/stream-token -b "<세션 쿠키>" | jq -r .token)
#    curl -N -H "Accept: text/event-stream" "$URL/stream/quotes?symbols=005930,000660&token=$TOKEN"
```

## 참고
- ⚠️ min=max=1 + CPU 상시 할당이라 **항상 켜져 있어 지속 비용**이 발생한다(scale-to-zero 아님).
- 클라이언트(앱): React Native에는 EventSource가 없으므로 `react-native-sse` 폴리필 사용. 웹은 브라우저 내장 `EventSource`.
- KIS 어댑터(`src/feed/kis.ts`)는 스켈레톤이다. tr_id별 필드 파싱·PINGPONG·재연결은 KIS 문서로 검증 후 채운다.
