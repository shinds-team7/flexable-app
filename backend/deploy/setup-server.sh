#!/usr/bin/env bash
# EC2(Ubuntu) 1회: Docker, swap 2GB, 시간대, /opt/flexable. 이미 돼 있으면 건너뛴다(다시 실행해도 된다).
# DB는 MySQL 컨테이너라 호스트에 MySQL 클라이언트를 깔지 않는다(docker compose exec db mysql ...).
set -euo pipefail
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
# t3.small(2GB)에 JVM 셋·MySQL 둘이 같이 돈다(docs/server-migration.md §8-1 메모리 예산). swap은 2GB 이상.
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
sudo timedatectl set-timezone Asia/Seoul || true
sudo mkdir -p /opt/flexable && sudo chown "$USER":"$USER" /opt/flexable
swapon --show; free -m | head -3
echo "done. 다시 로그인하면 sudo 없이 docker를 쓸 수 있습니다."
