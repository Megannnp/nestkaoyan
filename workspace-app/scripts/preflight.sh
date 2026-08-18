#!/usr/bin/env bash
#
# 一键部署前自检（Preflight Check）
# 用法：  bash scripts/preflight.sh         （在 workspace-app/ 下运行）
# 或：    ./scripts/preflight.sh
#
# 对照 CHECKLIST.md 的 A（代码健康）与 B（密钥安全）自动检查，
# 全部 PASS 后即可进入 D（wrangler login → build → deploy）。

set -u

PASS=0
FAIL=0

ok()   { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad()  { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
h2()   { echo ""; echo "── $1 ──"; }

echo "筑巢考研工作台 · 部署前自检"
echo "============================"

h2 "A. 代码健康"
if [ -d node_modules ]; then ok "依赖已安装 (node_modules)"; else bad "缺少 node_modules，请先 npm install"; fi
if [ -f package.json ]; then ok "package.json 存在"; else bad "缺少 package.json"; fi

if command -v npm >/dev/null 2>&1; then
  ok "npm 可用 ($(npm --version))"
else
  bad "未找到 npm"
fi

h2 "B. 密钥与环境"
if grep -rn "sk-" app worker --include="*.ts" 2>/dev/null | grep -qv "\.example\."; then
  bad "app/ 或 worker/ 中疑似硬编码密钥（sk-），请改为 env 读取"
else
  ok "代码中无硬编码密钥（sk-）"
fi

if [ -f .dev.vars ]; then
  ok ".dev.vars 存在（本地开发密钥）"
  if grep -q "^DEEPSEEK_API_KEY=" .dev.vars 2>/dev/null && [ -n "$(grep '^DEEPSEEK_API_KEY=' .dev.vars | cut -d= -f2)" ]; then
    ok "DEEPSEEK_API_KEY 已配置"
  else
    bad "DEEPSEEK_API_KEY 未配置（.dev.vars 中为空）"
  fi
else
  bad "缺少 .dev.vars（请先 cp .env.example .dev.vars 并填入 DEEPSEEK_API_KEY）"
fi

if [ -f .env.example ]; then ok ".env.example 存在"; else bad "缺少 .env.example"; fi

if grep -q "^\.dev\.vars" .gitignore 2>/dev/null; then
  ok ".gitignore 已排除 .dev.vars（密钥不会入 Git）"
else
  bad ".gitignore 未排除 .dev.vars！密钥有泄露风险"
fi

h2 "C. 数据与交付文档"
for f in README.md DEPLOY.md CHECKLIST.md database/README.md; do
  if [ -f "$f" ]; then ok "$f 存在"; else bad "缺少 $f"; fi
done

echo ""
echo "============================"
echo "结果：$PASS 通过 / $FAIL 失败"
if [ "$FAIL" -gt 0 ]; then
  echo "状态：未通过。请修复上述 ❌ 后重试，或对照 CHECKLIST.md 检查。"
  exit 1
else
  echo "状态：全部通过 ✅ 可进入部署（wrangler login → build → deploy）"
  exit 0
fi