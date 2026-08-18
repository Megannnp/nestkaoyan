# Playwright E2E Test Status

> 状态：**2026-08-17 全量 64/64 PASS**（实测与静态计数一致；含数据导出/导入用例）

## 当前状态
- **结构统计（2026-08-17 实核）：64 个 test()**，分布于 8 个 spec：cards 12 / dashboard 14 / flows 5 / knowledge 8 / questions 6 / reader 10 / review 5 / settings **4**（含数据导出/导入；2026-08-17 实测 64/64 PASS，与静态统计一致）
- **2026-08-17 全量回归 64/64 PASS**（实测，含导出 JSON 备份 / 导入 JSON 恢复用例）
- **2026-08-14：E2E 种子已切换为公共课**（政治 / 英语一 / 数学二）——移除全部「828 物理化学」「傅献彩」引用；
  - `e2e-seed.ts` 注入政治测试卡片、**政治知识点、政治+英语一测试任务**（支撑卡片/知识图谱/Dashboard 任务用例）；
  - 科目 Tab / 上传 / 设置删除用例改指政治；傅献彩意图用例改为「Agent 跳转沉淀卡片复习」；
  - `questions.spec` / `knowledge.spec` 本就使用政治/英语一，无需改动。
- 历史记录：2026-08-02 声称全量 64/64 PASS（计数与当前结构 63 相差 1，需重跑全量 E2E 验证确认）
- 覆盖模块：dashboard / knowledge / reader / questions / cards / review / flows / settings
- `helpers.ts` 的 `freshState()` 已通过 `page.addInitScript` 注入 `onboardingCompleted=true`；2026-08-17 改为**仅无存档时注入**（避免测试内 reload 重置已保存数据）
- 2026-08-17：playwright 端口对齐 `:3000`；React 19「空态渲染 NaN」告警归入已知噪音

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
- 2026-08-04：**结构计数校正为 63 个 test()**（此前 grep 缩进匹配漏计 flows.spec 顶格 5 个；实测 14+12+8+7+5+10+5+2=63）。同时清理 29 个 lint warnings（0 errors / 0 warnings）。需重跑全量 E2E 后更新实际 PASS 数字
- 2026-08-02：**全量回归 64/64 PASS**（卡片组重命名/删除交互修复 + heatmap 模块落盘 + chat 竞态修复后零回归；零 Runtime/Network/React 错误）
- 2026-08-02：全量回归 64/64 PASS（含 settings.spec 1 项；P1 拆分 + P2 错因分析真 AI 后零回归）
- 2026-08-01 16:32：全量 52/52 PASS（此前记录，用例数后续增长至 64）
