#!/bin/bash
# ═══════════════════════════════════════════════════
#  筑巢考研（NestKaoyan）一键发布到 GitHub
#  用法（二选一）：
#    1) 已有 PAT token：  GITHUB_TOKEN=ghp_xxx bash publish.sh
#    2) 已在网页创建好 nestkaoyan 空仓库： 直接 bash publish.sh
#  自动完成：创建仓库（若有 token）→ 配 remote → 推送 main
# ═══════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"
REPO="nestkaoyan"
OWNER="Megannnp"
REMOTE="git@github.com:${OWNER}/${REPO}.git"

echo "  📦 发布 ${OWNER}/${REPO} …"

# ── 1.（可选）有 token 时用 API 创建仓库 ─────────
if [ -n "$GITHUB_TOKEN" ]; then
  echo "  ⏳ 检测到 GITHUB_TOKEN，正在创建公开仓库…"
  HTTP_CODE=$(curl -s -o /tmp/nestkaoyan-create.json -w "%{http_code}" \
    -X POST "https://api.github.com/user/repos" \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -d "{\"name\":\"${REPO}\",\"description\":\"筑巢考研（NestKaoyan）— AI 考研学习系统：真题驱动 · 7核4层6轮 · 动态计划 · Agent 闭环\",\"homepage\":\"\",\"private\":false}")
  if [ "$HTTP_CODE" = "201" ]; then
    echo "  ✅ 仓库创建成功"
  elif [ "$HTTP_CODE" = "422" ]; then
    echo "  ℹ️  仓库可能已存在（422），继续推送"
  else
    echo "  ❌ 创建失败（HTTP $HTTP_CODE）：$(cat /tmp/nestkaoyan-create.json 2>/dev/null | head -c 300)"
    exit 1
  fi
else
  echo "  ℹ️  未提供 GITHUB_TOKEN，跳过创建（请在网页先创建 ${OWNER}/${REPO} 空仓库）"
fi

# ── 2. 配置 remote 并推送 ─────────────────────────
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE"
echo "  ⏳ 推送 main → $REMOTE（走 SSH：ssh.github.com:443，无需网页）"
git push -u origin main
git branch -a | grep fix/review-hardening && git push -u origin fix/review-hardening || true

echo ""
echo "  🎉 发布完成！"
echo "  🔗 https://github.com/${OWNER}/${REPO}"
echo ""
