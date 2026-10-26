#!/usr/bin/env bash
# 아카데미 네트워크 안의 PC(Git Bash)에서 실행: jar 빌드 → 아카데미 VM 업로드 → api 재기동
# 사용: backend/deploy/academy/deploy.sh <user@VM 내부 IP>   (VM 주소·계정은 팀 비공개 공간)
# EC2에는 쓰지 않는다. 이전 기간 EC2는 중계만 하므로 backend/deploy/deploy.sh 도 실행하지 않는다.
set -euo pipefail
HOST="${1:?사용: academy/deploy.sh <user@host>}"
DIR="$(cd "$(dirname "$0")" && pwd)"
(cd "$DIR/../.." && ./gradlew bootJar -q)
scp "$DIR/../../build/libs/app.jar" "$DIR/../Dockerfile" "$DIR/docker-compose.yml" "$DIR/backup-db.sh" "$HOST:/opt/flexable/"
ssh "$HOST" 'set -e; cd /opt/flexable && chmod +x backup-db.sh
if ! { test -s .env && grep -q "^MYSQL_ROOT_PASSWORD=." .env && grep -q "^JWT_SECRET=." .env; }; then
  echo ".env가 비어 있습니다. docs/server-migration.md 순서대로 먼저 채우세요." >&2; exit 1
fi
docker compose up -d --build
docker image prune -f >/dev/null
docker builder prune -af >/dev/null
docker compose ps
df -h / | tail -1'
