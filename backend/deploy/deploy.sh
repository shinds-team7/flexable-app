#!/usr/bin/env bash
# 로컬(Git Bash)에서 실행: jar 빌드 → EC2 업로드 → 재기동
# 사용: backend/deploy/deploy.sh [ssh-host]   (기본 ubuntu@3.36.103.99, 키 ~/.ssh/sh-flex.pem)
set -euo pipefail
HOST="${1:-ubuntu@3.36.103.99}"
KEY="${SSH_KEY:-$HOME/.ssh/sh-flex.pem}"
DIR="$(cd "$(dirname "$0")" && pwd)"
# 서버 이전 기간(docs/server-migration.md)에는 EC2가 아카데미 VM으로 중계만 한다. 이때 배포하면 중계 Caddyfile을 덮어쓰고
# DB(RDS)가 없는 api를 띄우게 되므로 막는다.
if ssh -i "$KEY" "$HOST" 'test -e /opt/flexable/RELAY_MODE'; then
  echo "EC2가 중계 모드입니다(/opt/flexable/RELAY_MODE). 지금은 backend/deploy/academy/deploy.sh로 배포하세요." >&2; exit 1
fi
(cd "$DIR/.." && ./gradlew bootJar -q)
scp -i "$KEY" "$DIR/../build/libs/app.jar" "$DIR/Dockerfile" "$DIR/docker-compose.yml" "$DIR/Caddyfile" \
  "$DIR/.env.example" "$DIR/setup-db.sh" "$HOST:/opt/flexable/"
# 루트 디스크가 작아서(이슈 #31 당시 6.7GB, 10-20 기준 15GB — HANDOFF §5) 빌드 캐시가 쌓이면 다음 빌드가 no space left로 실패한다(apt-get update exit 100으로 보임).
# 빌드 전에 캐시를 지워 이미 디스크가 찬 상태에서도 다시 실행하면 복구되게 하고, 빌드 뒤 이전 이미지·새 캐시를 지운다.
ssh -i "$KEY" "$HOST" 'set -e; cd /opt/flexable && chmod +x setup-db.sh
# 컨테이너는 uid 10001로 돈다. 로컬 umask 077로 빌드한 jar(600)는 읽지 못해 "Unable to access jarfile"로 재시작이 반복된다
chmod 644 app.jar
if ! { test -s .env && grep -q "^DB_PASSWORD=." .env; }; then
  echo ".env가 비어 있습니다. 먼저 /opt/flexable/setup-db.sh 를 실행하세요." >&2; exit 1
fi
docker builder prune -af >/dev/null
docker compose up -d --build
docker image prune -f >/dev/null
docker builder prune -af >/dev/null
docker compose ps
df -h / | tail -1'
