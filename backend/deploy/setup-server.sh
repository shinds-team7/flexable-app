#!/usr/bin/env bash
# EC2(Ubuntu) 최초 1회: Docker, MySQL 클라이언트, swap 2GB 설치
set -euo pipefail
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
sudo apt-get update -y && sudo apt-get install -y mysql-client-core-8.0 || sudo apt-get install -y default-mysql-client
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
sudo timedatectl set-timezone Asia/Seoul || true
sudo mkdir -p /opt/flexable && sudo chown "$USER":"$USER" /opt/flexable
echo "done. 다시 로그인하면 sudo 없이 docker를 쓸 수 있습니다."
