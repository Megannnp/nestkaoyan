#!/bin/sh
# 筑巢考研工作台 容器入口
# 1) 自动生成访问密码（默认启用 KAOYAN_AUTH=1；保存到数据卷 /app/data/password.txt，可持久化）
# 2) 透传后续命令（npm run start）
set -e

DATA_DIR="${KAOYAN_DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"

if [ -z "${KAOYAN_PASSWORD:-}" ] && [ -f "$DATA_DIR/password.txt" ]; then
  export KAOYAN_PASSWORD="$(cat "$DATA_DIR/password.txt")"
fi

if [ -z "${KAOYAN_PASSWORD:-}" ]; then
  if command -v openssl >/dev/null 2>&1; then
    export KAOYAN_PASSWORD="$(openssl rand -hex 8)"
  else
    export KAOYAN_PASSWORD="$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  echo "$KAOYAN_PASSWORD" > "$DATA_DIR/password.txt"
  chmod 600 "$DATA_DIR/password.txt"
  echo "[kaoyan] 已生成访问密码：$KAOYAN_PASSWORD（保存在 $DATA_DIR/password.txt）"
else
  echo "$KAOYAN_PASSWORD" > "$DATA_DIR/password.txt"
  chmod 600 "$DATA_DIR/password.txt"
fi

export KAOYAN_AUTH=1
exec "$@"
