#!/usr/bin/env bash
# EC2에서 사용자가 직접 1회 실행: RDS에 앱 전용 DB·계정을 만들고 .env에 DB 비밀번호와 JWT 비밀키를 채운다.
# 비밀번호는 화면에 출력하지 않는다.
set -euo pipefail
cd /opt/flexable
[ -f .env ] || cp .env.example .env
RDS_HOST="database-flex.cdi4cs8mempl.ap-northeast-2.rds.amazonaws.com"
read -r -s -p "RDS 마스터(admin) 비밀번호: " ADMIN_PW; echo
APP_PW="$(openssl rand -base64 33 | tr -d '/+=' | cut -c1-32)"
JWT="$(openssl rand -base64 48 | tr -d '\n')"
MYSQL_PWD="$ADMIN_PW" mysql -h "$RDS_HOST" -u admin --ssl-mode=REQUIRED <<SQL
CREATE DATABASE IF NOT EXISTS flexable CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'flexable_app'@'%' IDENTIFIED BY '${APP_PW}';
ALTER USER 'flexable_app'@'%' IDENTIFIED BY '${APP_PW}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON flexable.* TO 'flexable_app'@'%';
FLUSH PRIVILEGES;
SQL
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${APP_PW}|" .env
if grep -q '^JWT_SECRET=$' .env; then sed -i "s|^JWT_SECRET=$|JWT_SECRET=${JWT}|" .env; fi
chmod 600 .env
echo "완료: flexable DB와 flexable_app 계정을 만들고 .env를 채웠습니다."
