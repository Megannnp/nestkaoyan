@echo off
REM ═══════════════════════════════════════════════════
REM  筑巢考研工作台 一键安装（Windows）
REM  用法：双击这个文件运行
REM  自动完成：检查 Node → 装依赖 → 构建 → 启动 → 打开浏览器
REM  数据默认存在浏览器 localStorage，备份/迁移见「设置 → 数据管理」
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

REM ── 3. 启动 ─────────────────────────────────────
if not defined PORT set PORT=3000
echo   ⏳ 启动中（端口 %PORT%）…
start "kaoyan-exam-workspace" cmd /c "npm run start > kaoyan.log 2>&1"
timeout /t 5 /nobreak >nul

REM ── 4. 打开浏览器 ─────────────────────────────
start "" "http://localhost:%PORT%"

echo.
echo   🎉 安装完成！
echo   ──────────────────────────────────────────────
echo   💻 本机使用：   http://localhost:%PORT%
echo   📂 真题 PDF：   放到 public\papers\（命名规范见 public\papers\README.md）
echo   💾 数据备份：   设置 → 数据管理 → 导出学习档案
echo   📜 运行日志：   type kaoyan.log
echo.
pause
