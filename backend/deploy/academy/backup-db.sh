#!/usr/bin/env bash
# 아카데미 VM cron(매일 04:00 KST): DB를 덤프하고 7일 지난 파일을 지운다(개인정보처리방침 "백업 최대 7일").
# 등록: (crontab -l 2>/dev/null; echo '0 4 * * * /opt/flexable/backup-db.sh >> /opt/flexable/backups/backup.log 2>&1') | crontab -
set -euo pipefail
cd /opt/flexable
mkdir -p backups && chmod 700 backups
OUT="backups/flexable-$(date +%Y%m%d-%H%M).sql.gz"
umask 077
docker compose exec -T db sh -c 'exec mysqldump --single-transaction --no-tablespaces -uroot -p"$MYSQL_ROOT_PASSWORD" flexable' | gzip > "$OUT"
# 빈 파일이면 실패로 본다
test "$(gzip -cd "$OUT" | head -c 100 | wc -c)" -gt 0
find backups -name 'flexable-*.sql.gz' -mtime +6 -delete
echo "$(date '+%F %T') ok $OUT $(du -h "$OUT" | cut -f1)"
