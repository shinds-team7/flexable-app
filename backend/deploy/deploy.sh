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
ssh -i "$KEY" "$HOST" 'cd /opt/flexable && chmod +x setup-db.sh && test -s .env && grep -q "^DB_PASSWORD=." .env \
  && docker compose up -d --build && docker image prune -f >/dev/null && docker compose ps \
  || echo ".env가 비어 있습니다. 먼저 /opt/flexable/setup-db.sh 를 실행하세요."'
