# Playwright E2E Test Status

> 状态：**PASS（64/64 全量通过，2026-08-02）**

## 当前状态
- **全量 E2E 回归 64/64 PASS（2026-08-02）**，零 Runtime/Network/React 错误
- 覆盖模块：dashboard / knowledge / reader / questions / cards / review / flows / settings
- `helpers.ts` 的 `freshState()` 已通过 `page.addInitScript` 注入 `onboardingCompleted=true`，根治 Onboarding 全屏向导拦截
- 已同步过时选择器（Cards 学科 Tab/返回按钮/新建卡片组；Agent `chat-input`/「新建会话」/「历史会话」等）

## 运行要求（默认回归：`npx playwright test --workers=2`）
1. 网络可用时执行 `npm install -D @playwright/test`（已在 package.json）
2. 下载浏览器：`npx playwright install chromium`（需 revision 1234）
3. 运行：`npm run test:e2e`
4. 全部通过后再更新本文件状态为 PASS

## 已知未验证项
- Completion Modal 可访问名称
- 上传流程等待最终 UI（非休眠）
- Cards 按钮文本唯一性

## 变更记录
- 2026-08-02：**全量回归 64/64 PASS**（卡片组重命名/删除交互修复 + heatmap 模块落盘 + chat 竞态修复后零回归；零 Runtime/Network/React 错误）
- 2026-08-02：全量回归 64/64 PASS（含 settings.spec 1 项；P1 拆分 + P2 错因分析真 AI 后零回归）
- 2026-08-01 16:32：全量 52/52 PASS（此前记录，用例数后续增长至 64）
