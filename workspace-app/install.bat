@echo off
REM ═══════════════════════════════════════════════════
REM  筑巢考研工作台 一键安装（Windows）
REM  用法：双击这个文件运行
REM  自动完成：检查 Node → 装依赖 → 构建 → 启动本地 SQLite → 启动应用 → 打开浏览器
REM  数据：默认存本地 SQLite（data\kaoyan.db）+ 浏览器缓存，换浏览器/清缓存不丢
REM ═══════════════════════════════════════════════════
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo   📚 筑巢考研工作台 一键安装开始（首次约 3~5 分钟，请勿关闭此窗口）
echo   ──────────────────────────────────────────────

REM ── 1. 检查 Node.js（需要 ≥ 22.13）─────────────
where node >nul 2>nul
if errorlevel 1 (
  echo   ⚠️  未检测到 Node.js。
  echo       请先到 https://nodejs.org 下载 LTS 版并安装，然后重新双击本文件。
  echo       也可以改用 Docker 方式：装 Docker Desktop 后，在命令行运行 docker compose up -d
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODE_V=%%v
echo   ✅ Node.js 版本：%NODE_V%

REM ── 2. 安装依赖 + 构建 ─────────────────────────
if not exist node_modules (
  echo   ⏳ 安装依赖（约 1~3 分钟，视网速）…
  call npm ci
  if errorlevel 1 (
    echo   ❌ 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)
if not exist dist (
  echo   ⏳ 构建（约 1 分钟）…
  call npm run build
  if errorlevel 1 (
    echo   ❌ 构建失败。
    pause
    exit /b 1
  )
)

REM ── 3. 启动本地 SQLite 数据库（kaoyan-db，零依赖）─────
netstat -an | findstr ":3001 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo   ✅ 本地数据库已在运行（端口 3001）
) else (
  echo   ⏳ 启动本地 SQLite 数据库（kaoyan-db）…
  start "kaoyan-db" /B cmd /c "node database\server.mjs > kaoyan-db.log 2>&1"
  timeout /t 1 /nobreak >nul
)

REM ── 3.5 生成访问密码（首次；本机免登录，其他设备访问需密码）──
if not exist data mkdir data
set "KAOYAN_PASSWORD="
if exist data\password.txt (
  set /p KAOYAN_PASSWORD=<data\password.txt
)
if not defined KAOYAN_PASSWORD (
  set "KAOYAN_PASSWORD="
  for /f %%p in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N').Substring(0,12)"') do set "KAOYAN_PASSWORD=%%p"
  if not defined KAOYAN_PASSWORD set "KAOYAN_PASSWORD=kaoyan%RANDOM%%RANDOM%"
  echo !KAOYAN_PASSWORD!> data\password.txt
  echo   🔑 已生成访问密码：!KAOYAN_PASSWORD!（保存在 data\password.txt）
)

REM ── 4. 启动 ─────────────────────────────────────
if not defined PORT set PORT=3000
echo   ⏳ 启动中（端口 %PORT%）…
set "KAOYAN_AUTH=1"
set "WORKSPACE_DB_URL=http://127.0.0.1:3001"
start "kaoyan-exam-workspace" cmd /c "npm run start > kaoyan.log 2>&1"
timeout /t 5 /nobreak >nul

REM ── 5. 打开浏览器 ─────────────────────────────
start "" "http://localhost:%PORT%"

set "PWSHOW="
if exist data\password.txt set /p PWSHOW=<data\password.txt
echo.
echo   🎉 安装完成！
echo   ──────────────────────────────────────────────
echo   💻 本机使用：   http://localhost:%PORT%
echo   📱 手机访问：   http://电脑IP:%PORT%（手机连同一 WiFi）
echo   🔑 访问密码：   %PWSHOW%（本机免登录，其他设备访问需输入）
echo   💾 数据持久化： 本地 SQLite（data\kaoyan.db）+ 浏览器缓存，换浏览器不丢
echo   📂 真题 PDF：   放到 public\papers\（命名规范见 public\papers\README.md）
echo   📜 运行日志：   type kaoyan.log（数据库：type kaoyan-db.log）
echo.
pause
