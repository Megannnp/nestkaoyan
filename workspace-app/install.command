#!/bin/bash
# ═══════════════════════════════════════════════════
#  筑巢考研工作台 一键安装（macOS）
#  用法：双击这个文件运行（或终端执行 bash install.command）
#  自动完成：检查 Node → 装依赖 → 构建 → 启动本地 SQLite → 启动应用 → 打开浏览器
#  数据：默认存本地 SQLite（data/kaoyan.db）+ 浏览器缓存，换浏览器/清缓存不丢
# ═══════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"

echo ""
echo "  📚 筑巢考研工作台 一键安装开始（首次约 3~5 分钟，请勿关闭此窗口）"
echo "  ──────────────────────────────────────────────"

# ── 1. 检查 Node.js（需要 ≥ 22.13）─────────────
if ! command -v node >/dev/null 2>&1; then
  echo "  ⚠️  未检测到 Node.js，尝试用 Homebrew 安装 node@24…"
  if ! command -v brew >/dev/null 2>&1; then
    echo "  ⏳ 需要先装 Homebrew（Mac 的软件管家），可能提示输入开机密码。"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || true
    export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  fi
  brew install node@24 || brew install node || true
  export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
fi

NODE_V=$(node -v 2>/dev/null || echo "none")
echo "  ✅ Node.js 版本：$NODE_V"

# ── 2. 安装依赖 + 构建 ─────────────────────────
if [ ! -d node_modules ]; then
  echo "  ⏳ 安装依赖（约 1~3 分钟，视网速）…"
  npm ci
fi
if [ ! -d dist ]; then
  echo "  ⏳ 构建（约 1 分钟）…"
  npm run build
fi

# ── 3. 启动本地 SQLite 数据库（kaoyan-db，零依赖）─────────
if lsof -ti :3001 >/dev/null 2>&1; then
  echo "  ✅ 本地数据库已在运行（端口 3001）"
else
  echo "  ⏳ 启动本地 SQLite 数据库（kaoyan-db）…"
  nohup node database/server.mjs > kaoyan-db.log 2>&1 &
  sleep 1
fi

# ── 4. 启动应用 ─────────────────────────────────────
PORT=${PORT:-3000}
if lsof -ti :$PORT >/dev/null 2>&1; then
  echo "  ℹ️  端口 $PORT 已在运行（可能之前启动过），跳过启动。"
else
  nohup env WORKSPACE_DB_URL=http://127.0.0.1:3001 npm run start > kaoyan.log 2>&1 &
  echo "  ⏳ 启动中…"
  sleep 3
fi

# ── 5. 打开浏览器 + 局域网访问地址 ─────────────────
open "http://localhost:$PORT" 2>/dev/null || true
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "本机IP")
echo ""
echo "  🎉 安装完成！"
echo "  ──────────────────────────────────────────────"
echo "  💻 本机使用：   http://localhost:$PORT"
echo "  📱 手机访问：   http://$IP:$PORT（手机连同一 WiFi）"
echo "  💾 数据持久化： 本地 SQLite（data/kaoyan.db）+ 浏览器缓存，换浏览器不丢"
echo "  📂 真题 PDF：   放到 public/papers/（命名规范见 public/papers/README.md）"
echo "  📜 运行日志：   tail -f kaoyan.log（数据库：tail -f kaoyan-db.log）"
echo ""
