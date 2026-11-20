#!/usr/bin/env bash
# 로컬(Git Bash)에서 실행: jar 빌드 → EC2 업로드 → 재기동
# 사용: backend/deploy/deploy.sh [--upload-only] [ssh-host]   (기본 ubuntu@flex-able-sh.duckdns.org — 탄력적 IP를 가리킨다, 키 ~/.ssh/sh-flex.pem)
#   --upload-only: 파일만 올리고 컨테이너는 건드리지 않는다(복귀 때 DB를 먼저 복원하려고. docs/server-migration.md §8-2)
set -euo pipefail
UPLOAD_ONLY=0
if [ "${1:-}" = "--upload-only" ]; then UPLOAD_ONLY=1; shift; fi
HOST="${1:-ubuntu@flex-able-sh.duckdns.org}"
KEY="${SSH_KEY:-$HOME/.ssh/sh-flex.pem}"
DIR="$(cd "$(dirname "$0")" && pwd)"
# 서버 이전 기간(docs/server-migration.md)에는 EC2가 아카데미 VM으로 중계만 한다. 이때 배포하면 중계 Caddyfile을 덮어쓰고
# DB가 없는 api를 띄우게 되므로 막는다. 복귀 절차(§8-2)에서 RELAY_MODE를 지운 뒤에 실행한다.
if ssh -i "$KEY" "$HOST" 'test -e /opt/flexable/RELAY_MODE'; then
  echo "EC2가 중계 모드입니다(/opt/flexable/RELAY_MODE). 복귀 전에는 backend/deploy/academy/deploy.sh로 배포하세요." >&2; exit 1
fi
(cd "$DIR/.." && ./gradlew bootJar -q)
scp -i "$KEY" "$DIR/../build/libs/app.jar" "$DIR/Dockerfile" "$DIR/docker-compose.yml" "$DIR/Caddyfile" \
  "$DIR/.env.example" "$DIR/setup-db.sh" "$DIR/backup-db.sh" "$DIR/count-rows.sql" "$HOST:/opt/flexable/"
# 루트 디스크가 작아서(이슈 #31 당시 6.7GB, 10-20 기준 15GB — HANDOFF §5) 빌드 캐시가 쌓이면 다음 빌드가 no space left로 실패한다(apt-get update exit 100으로 보임).
# 빌드 전에 캐시를 지워 이미 디스크가 찬 상태에서도 다시 실행하면 복구되게 하고, 빌드 뒤 이전 이미지·새 캐시를 지운다.
ssh -i "$KEY" "$HOST" "UPLOAD_ONLY=$UPLOAD_ONLY bash -s" <<'REMOTE'
set -e
cd /opt/flexable && chmod +x setup-db.sh backup-db.sh
# 컨테이너는 uid 10001로 돈다. 로컬 umask 077로 빌드한 jar(600)는 읽지 못해 "Unable to access jarfile"로 재시작이 반복된다
chmod 644 app.jar
if [ "$UPLOAD_ONLY" = 1 ]; then echo "파일만 올렸습니다(컨테이너 변경 없음)."; exit 0; fi
for k in DB_PASSWORD MYSQL_ROOT_PASSWORD JWT_SECRET API_DOMAIN WEB_DOMAIN; do
  if ! grep -q "^$k=." .env 2>/dev/null; then
    echo ".env에 $k 값이 없습니다. 새 서버면 /opt/flexable/setup-db.sh, 복귀면 docs/server-migration.md §8-2를 먼저 하세요." >&2; exit 1
  fi
done
if grep -q '^DB_URL=.*rds\.amazonaws\.com' .env; then
  echo ".env의 DB_URL이 아직 RDS입니다. .env.example처럼 db:3306으로 바꾸세요." >&2; exit 1
fi
docker builder prune -af >/dev/null
docker compose up -d --build
docker image prune -f >/dev/null
docker builder prune -af >/dev/null
docker compose ps
free -m | head -3
df -h / | tail -1
REMOTE
