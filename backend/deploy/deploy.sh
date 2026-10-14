#!/usr/bin/env bash
# 로컬(Git Bash)에서 실행: jar 빌드 → EC2 업로드 → 재기동
# 사용: backend/deploy/deploy.sh [ssh-host]   (기본 ubuntu@3.36.103.99, 키 ~/.ssh/sh-flex.pem)
set -euo pipefail
HOST="${1:-ubuntu@3.36.103.99}"
KEY="${SSH_KEY:-$HOME/.ssh/sh-flex.pem}"
DIR="$(cd "$(dirname "$0")" && pwd)"
(cd "$DIR/.." && ./gradlew bootJar -q)
scp -i "$KEY" "$DIR/../build/libs/app.jar" "$DIR/Dockerfile" "$DIR/docker-compose.yml" "$DIR/Caddyfile" \
  "$DIR/.env.example" "$DIR/setup-db.sh" "$HOST:/opt/flexable/"
# 루트 디스크가 6.7GB라 빌드 캐시가 쌓이면 다음 빌드가 no space left로 실패한다(apt-get update exit 100으로 보임).
# 배포마다 빌드 캐시와 이전 이미지를 지우고, 마지막에 디스크 사용량을 보여 준다.
ssh -i "$KEY" "$HOST" 'set -e; cd /opt/flexable && chmod +x setup-db.sh
if ! { test -s .env && grep -q "^DB_PASSWORD=." .env; }; then
  echo ".env가 비어 있습니다. 먼저 /opt/flexable/setup-db.sh 를 실행하세요." >&2; exit 1
fi
docker compose up -d --build
docker image prune -f >/dev/null
docker builder prune -af >/dev/null
docker compose ps
df -h / | tail -1'
