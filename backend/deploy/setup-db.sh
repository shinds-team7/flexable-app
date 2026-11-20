#!/usr/bin/env bash
# EC2에서 사용자가 직접 실행(새 서버를 처음 꾸릴 때): .env의 빈 DB_PASSWORD·MYSQL_ROOT_PASSWORD·JWT_SECRET을 채운다.
# DB와 앱 계정(flexable / DB_USERNAME)은 db 컨테이너가 처음 뜰 때 이 값으로 직접 만든다(docker-compose.yml).
# 이미 채워진 값은 바꾸지 않는다(MySQL 볼륨이 생긴 뒤 비밀번호를 바꾸면 접속이 끊기고, JWT_SECRET을 바꾸면 전원 로그아웃).
# 아카데미에서 복귀할 때는 이 스크립트 대신 아카데미 .env를 가져온다(docs/server-migration.md §8-2). 비밀번호는 화면에 출력하지 않는다.
set -euo pipefail
cd /opt/flexable
[ -f .env ] || cp .env.example .env
umask 077
gen() { openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-32; }   # 영숫자만($ 없음 — compose 치환 방지)
fill() {   # 키가 없거나 값이 비어 있을 때만 채운다
  local key="$1" val="$2"
  if grep -q "^${key}=." .env; then echo "유지: ${key}"; return; fi
  if grep -q "^${key}=" .env; then sed -i "s|^${key}=.*|${key}=${val}|" .env; else echo "${key}=${val}" >> .env; fi
  echo "채움: ${key}"
}
fill DB_PASSWORD "$(gen)"
fill MYSQL_ROOT_PASSWORD "$(gen)"
fill JWT_SECRET "$(openssl rand -base64 48 | tr -d '\n')"
grep -q '^MYSQL_IMAGE=' .env || echo 'MYSQL_IMAGE=mysql:8.4' >> .env
chmod 600 .env
grep -q '^WEB_DOMAIN=.' .env || echo "주의: WEB_DOMAIN이 비어 있습니다. .env에 웹 도메인을 넣어야 deploy.sh가 진행합니다." >&2
echo "완료: .env를 채웠습니다. DB는 'docker compose up -d db'로 처음 뜰 때 만들어집니다."
