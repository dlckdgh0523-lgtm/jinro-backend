# EC2 배포 가이드

## 사전 요구사항

- EC2 인스턴스 (t3.small 이상 권장)
- Docker + Docker Compose 설치
- 보안 그룹: 포트 80/443 (HTTPS), 22 (SSH)
- 도메인 + SSL 인증서 (Let's Encrypt 또는 AWS ACM)

## 보안 그룹 설정

| 포트 | 프로토콜 | 소스 | 용도 |
|------|----------|------|------|
| 22 | TCP | 관리자 IP | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP → HTTPS 리다이렉트 |
| 443 | TCP | 0.0.0.0/0 | HTTPS (API) |
| 4000 | TCP | localhost only | 백엔드 (내부) |

## 배포 순서

### 1. 소스 클론
```bash
git clone git@github.com:dlckdgh0523-lgtm/jinro-backend.git
cd jinro-backend
```

### 2. 환경변수 설정
```bash
cp .env.example .env
nano .env
```

필수 환경변수:
```env
PORT=4000
NODE_ENV=production
APP_BASE_URL=https://api.jinro.it.kr
CORS_ORIGIN=https://www.jinro.it.kr
DATABASE_URL=postgresql://jinro_app:STRONG_PASSWORD@postgres:5432/jinro_nachimban?schema=public&sslmode=disable
DB_PASSWORD=STRONG_PASSWORD

JWT_ACCESS_SECRET=<64자 이상 랜덤 문자열>
JWT_REFRESH_SECRET=<64자 이상 랜덤 문자열>
JWT_STREAM_SECRET=<64자 이상 랜덤 문자열>

GOOGLE_CLIENT_ID=<Google Cloud Console에서 발급>
GOOGLE_CLIENT_SECRET=<Google Cloud Console에서 발급>
GOOGLE_CALLBACK_URL=https://www.jinro.it.kr/auth/google/callback

AI_PROVIDER=openai
OPENAI_API_KEY=<OpenAI API Key>
AI_MODEL_DEFAULT=gpt-4o-mini
```

### 3. Docker 이미지 빌드 & 실행
```bash
docker compose build
docker compose up -d
```

### 4. 마이그레이션 (첫 배포 시)
```bash
docker compose exec backend npx prisma migrate deploy
```

### 5. 헬스체크
```bash
curl http://localhost:4000/health
# {"success":true,"data":{"status":"ok",...}}

curl http://localhost:4000/health/ready
# {"success":true,"data":{"status":"ready","database":"reachable",...}}
```

### 6. 로그 확인
```bash
docker compose logs -f backend
```

## Nginx 리버스 프록시 (HTTPS)

```nginx
server {
    listen 443 ssl;
    server_name api.jinro.it.kr;

    ssl_certificate /etc/letsencrypt/live/api.jinro.it.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.jinro.it.kr/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /v1/notifications/stream {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

## 업데이트 배포

```bash
cd jinro-backend
git pull origin main
docker compose build backend
docker compose up -d backend
docker compose exec backend npx prisma migrate deploy
```

## 롤백

```bash
git checkout <previous-commit>
docker compose build backend
docker compose up -d backend
```

## 모니터링

```bash
# 컨테이너 상태
docker compose ps

# 리소스 사용량
docker stats jinro-backend jinro-postgres

# 로그 (최근 100줄)
docker compose logs --tail=100 backend
```

## 문제 해결

### 백엔드가 시작되지 않을 때
```bash
docker compose logs backend | tail -50
# DATABASE_URL 확인, 마이그레이션 상태 확인
```

### DB 연결 실패
```bash
docker compose exec postgres pg_isready -U jinro_app -d jinro_nachimban
```

### 마이그레이션 실패
```bash
docker compose exec backend npx prisma migrate status
docker compose exec backend npx prisma migrate resolve --applied <migration_name>
```
