# 커스텀 도메인 연결 (Cloud Run + 외부 ALB)

Cloud Run 서비스를 커스텀 도메인(`api.moneyroad.ai.kr` 등)에 연결한다.

> **왜 도메인 매핑이 아니라 부하 분산기?**
> Cloud Run 기본 "도메인 매핑"은 일부 리전만 지원하며 **`asia-northeast3`(서울)은
> 미지원**이다(콘솔에서 "이 리전에는 도메인 매핑이 제공되지 않습니다" 경고). 서울
> 리전을 유지하려면 **Global External Application Load Balancer** 앞에 Cloud Run을
> 두는 방식이 정석이다. 관리형 SSL·SSE/스트리밍·다중 서비스(server/realtime) 호스트
> 분기까지 한 번에 해결된다.

- 구성: 글로벌 고정 IP → HTTPS 프록시(인증서) → URL 맵 → 백엔드 서비스 → Serverless NEG → Cloud Run
- 비용: 포워딩 규칙 + 처리량으로 **월 ~$20** 고정 비용 발생(트래픽 별도)

## Cloudflare 두 방식 (먼저 하나 고르기)

도메인을 **Cloudflare**로 관리하므로, 시작 전에 방식을 정한다. 아래 단계는 **0~4 공통 →
5~8은 방식별(A/B) → 9 공통** 순서다.

| | **방식 A — DNS only (회색 구름)** · 권장 | **방식 B — 프록시 (주황 구름)** |
|---|---|---|
| Cloudflare 역할 | DNS만 (트래픽은 GCP LB로 직행) | 엣지에서 SSL·CDN·WAF, origin IP 숨김 |
| SSL 인증서 | **GCP 관리형**(자동 갱신) | **Cloudflare Origin 인증서**를 LB에 적재 |
| 장점 | 간단, **SSE 안전** | DDoS/WAF, origin 숨김, 엣지 캐시 |
| 단점 | origin IP 노출 | 설정 복잡, **SSE 버퍼링/타임아웃 위험** |

> ⚠️ **핵심**: 주황 구름(프록시) 상태에서는 **GCP 관리형 인증서가 발급되지 않는다**
> (Google이 도메인을 LB IP로 직접 검증해야 하는데 Cloudflare가 가로챔 →
> `FAILED_NOT_VISIBLE`). 그래서 방식 B는 Cloudflare Origin 인증서를 쓴다.
>
> realtime(SSE)까지 둘 다 붙일 거면 **api는 A 또는 B, realtime은 항상 A(회색 구름)** 권장.

---

## 0. 변수 〔공통〕

```bash
export PROJECT=moneyroad-app
export REGION=asia-northeast3
export SERVICE=moneyroad-server
export DOMAIN=api.moneyroad.ai.kr
gcloud config set project "$PROJECT"

# LB 리소스는 Compute Engine API가 필요(최초 1회). 활성화 후 1~2분 전파 대기.
gcloud services enable compute.googleapis.com
```

## 1. 글로벌 고정 IP 〔공통〕

```bash
gcloud compute addresses create moneyroad-lb-ip --global
# DNS에 등록할 IP 확인(기록해 둘 것) 8.233.239.200
gcloud compute addresses describe moneyroad-lb-ip --global --format='value(address)'
```

## 2. Serverless NEG (Cloud Run 연결) 〔공통〕

```bash
gcloud compute network-endpoint-groups create moneyroad-server-neg \
  --region="$REGION" --network-endpoint-type=serverless \
  --cloud-run-service="$SERVICE"
```

## 3. 백엔드 서비스 + NEG 연결 〔공통〕

```bash
gcloud compute backend-services create moneyroad-server-backend \
  --global --load-balancing-scheme=EXTERNAL_MANAGED

gcloud compute backend-services add-backend moneyroad-server-backend \
  --global --network-endpoint-group=moneyroad-server-neg \
  --network-endpoint-group-region="$REGION"
```

## 4. URL 맵 〔공통〕

```bash
gcloud compute url-maps create moneyroad-lb \
  --default-service=moneyroad-server-backend
```

## 5. SSL 인증서 〔방식별〕

#### ▶ 방식 A — GCP 관리형 인증서

```bash
gcloud compute ssl-certificates create moneyroad-cert \
  --domains="$DOMAIN" --global
```

#### ▶ 방식 B — Cloudflare Origin 인증서

1. Cloudflare → **SSL/TLS → Origin Server → Create Certificate**
   - 호스트: `api.moneyroad.ai.kr` (또는 와일드카드 `*.moneyroad.ai.kr` — realtime까지 커버)
   - 키 형식 기본(RSA) → **인증서(PEM)** 와 **개인키(PEM)** 를 각각 `cert.pem`, `key.pem`로 저장
2. GCP에 self-managed 인증서로 등록:
   ```bash
   gcloud compute ssl-certificates create moneyroad-cf-origin-cert \
     --certificate=cert.pem --private-key=key.pem --global
   ```

## 6. HTTPS 프록시 + 포워딩 규칙(443) 〔프록시만 방식별〕

#### ▶ 방식 A

```bash
gcloud compute target-https-proxies create moneyroad-https-proxy \
  --url-map=moneyroad-lb --ssl-certificates=moneyroad-cert
```

#### ▶ 방식 B

```bash
gcloud compute target-https-proxies create moneyroad-https-proxy \
  --url-map=moneyroad-lb --ssl-certificates=moneyroad-cf-origin-cert
```

#### ▶ 포워딩 규칙 〔공통〕

```bash
gcloud compute forwarding-rules create moneyroad-https-fr \
  --global --target-https-proxy=moneyroad-https-proxy \
  --address=moneyroad-lb-ip --ports=443
```

## 7. Cloudflare DNS 레코드 〔방식별〕

Cloudflare 대시보드 → **DNS → Records → Add record**.

#### ▶ 방식 A — DNS only (회색 구름)

| 필드 | 값 |
|---|---|
| Type | **A** (CNAME 아님) |
| Name | `api` (→ `api.moneyroad.ai.kr`) |
| IPv4 address | 1번에서 받은 LB 고정 IP |
| Proxy status | **DNS only (회색 구름)** ← 핵심 |
| TTL | Auto |

회색 구름이라 Cloudflare SSL/TLS 모드 설정은 이 도메인에 영향 없음(경로에 Cloudflare 없음).

#### ▶ 방식 B — 프록시 (주황 구름)

| 필드 | 값 |
|---|---|
| Type | **A** |
| Name | `api` |
| IPv4 address | LB 고정 IP |
| Proxy status | **Proxied (주황 구름)** |

추가로 Cloudflare → **SSL/TLS → Overview → 모드 `Full (strict)`** 로 설정.
(origin이 유효한 Origin 인증서를 제시하므로 strict 가능. **Flexible 금지** — 리다이렉트 루프.)

## 8. 마무리 — 인증서 활성화 확인 〔방식별〕

#### ▶ 방식 A — 관리형 인증서 발급 대기 (DNS 전파 후 15~60분)

관리형 인증서는 **A 레코드가 LB IP를 가리켜야**(=회색 구름) 발급된다.

```bash
gcloud compute ssl-certificates describe moneyroad-cert --global \
  --format='value(managed.status, managed.domainStatus)'
# PROVISIONING → ACTIVE 가 되면 완료
```

#### ▶ 방식 B — 즉시 유효 (대기 없음)

Origin 인증서는 등록 즉시 유효하고, 방문자가 보는 엣지 인증서는 Cloudflare가 자동
처리(Universal SSL)한다. DNS 전파 후 바로 확인:

```bash
dig +short api.moneyroad.ai.kr        # 프록시 ON이면 Cloudflare IP(104.x/172.x)가 나옴(정상)
curl -I https://api.moneyroad.ai.kr   # 200/리다이렉트 응답 확인
```

→ 두 방식 모두 `https://api.moneyroad.ai.kr` 접속이 되면 성공.

## 9. 앱 설정을 커스텀 도메인으로 갱신 〔공통〕

도메인이 살아나면 server 시크릿을 교체한다.

```bash
printf '%s' "https://api.moneyroad.ai.kr" | gcloud secrets versions add better-auth-url --data-file=-
# cors-origin은 "웹 프론트(브라우저) 출처"여야 함(API 자신의 도메인 아님). 웹이 없으면 생략.
# printf '%s' "https://<웹-도메인>" | gcloud secrets versions add cors-origin --data-file=-

# ⚠️ 시크릿에 새 버전만 추가하면 Cloud Run은 자동 반영 안 함. :latest를 다시 지정해
#    새 리비전을 강제해야 갱신값이 적용된다(플래그 없는 update는 "변경 없음"으로 거부됨).
gcloud run services update moneyroad-server --region="$REGION" \
  --update-secrets=BETTER_AUTH_URL=better-auth-url:latest
```

네이티브 앱은 EAS `production` 환경의 `EXPO_PUBLIC_SERVER_URL`이 이미
`https://api.moneyroad.ai.kr`이면 그대로 두면 된다.

---

## (선택) HTTP→HTTPS 리다이렉트 (80포트)

- **방식 B(프록시)**: Cloudflare → SSL/TLS → Edge Certificates → **Always Use HTTPS** 켜면 끝
  (아래 GCP 설정 불필요).
- **방식 A(DNS only)**: GCP LB에 리다이렉트용 80포트 프론트엔드를 둔다.

```bash
cat > /tmp/redirect.yaml <<'YAML'
kind: compute#urlMap
name: moneyroad-http-redirect
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
YAML
gcloud compute url-maps import moneyroad-http-redirect --global --source=/tmp/redirect.yaml

gcloud compute target-http-proxies create moneyroad-http-proxy \
  --url-map=moneyroad-http-redirect
gcloud compute forwarding-rules create moneyroad-http-fr \
  --global --target-http-proxy=moneyroad-http-proxy \
  --address=moneyroad-lb-ip --ports=80
```

---

## (선택) realtime 서비스도 같은 LB에 붙이기

`rt.moneyroad.ai.kr` 호스트로 realtime(SSE)을 같은 LB에 추가한다. **SSE는 프록시 시
버퍼링/타임아웃 위험이 있어 realtime은 방식 A(회색 구름)로 두는 걸 권장**한다.

```bash
export RT_DOMAIN=rt.moneyroad.ai.kr

# 1) realtime용 NEG + 백엔드
gcloud compute network-endpoint-groups create moneyroad-realtime-neg \
  --region="$REGION" --network-endpoint-type=serverless \
  --cloud-run-service=moneyroad-realtime
gcloud compute backend-services create moneyroad-realtime-backend \
  --global --load-balancing-scheme=EXTERNAL_MANAGED
gcloud compute backend-services add-backend moneyroad-realtime-backend \
  --global --network-endpoint-group=moneyroad-realtime-neg \
  --network-endpoint-group-region="$REGION"

# 2) URL 맵에 호스트 규칙 추가 (api=기본 server, rt=realtime)
gcloud compute url-maps add-path-matcher moneyroad-lb \
  --path-matcher-name=rt-matcher \
  --default-service=moneyroad-realtime-backend \
  --new-hosts="$RT_DOMAIN"

# 3) rt용 GCP 관리형 인증서 추가 → 프록시에 기존 인증서와 함께 연결(SNI로 호스트별 선택)
gcloud compute ssl-certificates create moneyroad-rt-cert \
  --domains="$RT_DOMAIN" --global
#   방식 A 환경: 기존 moneyroad-cert 와 함께
gcloud compute target-https-proxies update moneyroad-https-proxy \
  --ssl-certificates=moneyroad-cert,moneyroad-rt-cert
#   방식 B 환경(api가 프록시): origin 인증서 + rt 관리형 인증서 함께
#   gcloud compute target-https-proxies update moneyroad-https-proxy \
#     --ssl-certificates=moneyroad-cf-origin-cert,moneyroad-rt-cert

# 4) Cloudflare DNS: rt → 같은 고정 IP, A 레코드, DNS only(회색 구름)
```

> ⚠️ realtime을 회색 구름으로 직접 노출하면 **공개 신뢰 인증서**가 필요하다(브라우저는
> Cloudflare Origin 인증서를 신뢰하지 않음). 그래서 rt는 위처럼 **GCP 관리형 인증서**
> (`moneyroad-rt-cert`)를 쓴다. 와일드카드 Origin 인증서(`*.moneyroad.ai.kr`)는 프록시
> 경유 트래픽에서만 유효하므로 회색 구름 rt에는 부적합.

이후 EAS `production` 환경에 realtime URL 추가:

```bash
eas env:create --environment production --name EXPO_PUBLIC_REALTIME_URL \
  --value "https://rt.moneyroad.ai.kr" --visibility plaintext
```

---

## 자주 보는 문제

### 공통
- 인증서가 계속 `PROVISIONING`/`FAILED_NOT_VISIBLE` → A 레코드가 LB IP를 안 가리키거나
  DNS 전파 전. `dig api.moneyroad.ai.kr` 로 IP 확인 후 대기.
- 502/503 → 백엔드 NEG가 Cloud Run 서비스를 못 가리킴(리전/서비스명 확인), 또는 Cloud
  Run이 `--allow-unauthenticated`가 아님.
- CORS 에러 → 9번 `cors-origin` 갱신 + 서비스 재배포 누락.

### Cloudflare 특화
- 방식 A인데 인증서가 `FAILED_NOT_VISIBLE` → **레코드가 주황 구름(프록시)** 상태일 확률이
  높다. **회색 구름(DNS only)** 으로 바꾸면 발급된다. (또는 방식 B로 전환)
- `dig`로 IP가 LB가 아닌 **Cloudflare IP(104.x/172.x)** → 프록시 ON 상태. 방식 A는 회색
  구름이어야 LB IP가 보인다.
- **Error 521/522** → origin(LB) 도달 불가. LB 포워딩 규칙·백엔드 상태 확인.
- **Error 526** (Invalid SSL certificate) → 방식 B에서 Full(strict)인데 origin 인증서
  만료/불일치. Origin 인증서 재발급·재등록.
- ⚠️ Cloudflare SSL 모드 **"Flexible" 금지** → CF는 http로 origin 접속, LB는 443만 열려
  무한 리다이렉트/오류. 방식 B는 반드시 **Full (strict)**.
