# 第三轮审查报告 — 2026-07-30

> 截至当前，所有通过的审查项汇总。

---

## ✅ 已关闭 — 总计 11 项

| # | 问题 | 状态 | 变更 |
|---|------|------|------|
| 1 | 热力图今天数据源 BUG | ✅ 已修复 | `heatmapDays` 中 today 行改为用 `studyDays` 已存记录 |
| 2 | actualMinutes "0" 被忽略 | ✅ 已修复 | 3 处 `||` → `!== ""` |
| 3 | Heatmap Runtime Error | ✅ 已修复 | 3 处 `cellEl.closest()` 前加 `instanceof HTMLElement` |
| 4 | Sidebar 绿色主题残留 | ✅ 已修复 | Logo、进度条、热力图滚动条/tooltip、四宫格阴影 |
| 5 | 删除「当前核心」模块 | ✅ 已修复 | 按需移除 |
| 6 | "use client" 指令 | ✅ 已修复 | 添加后构建通过 |
| 7 | 创建 `RULES.ts` | ✅ 已完成 | 抽取所有魔法常量到 `app/lib/rules.ts` |
| 8 | 创建 `storage.ts` | ✅ 已完成 | localStorage 封装层 + 防抖 + 数据版本迁移 |
| 9 | `storageKey` → `STORAGE.key` | ✅ 已修复 | 3 处替换 |
| 10 | `RULES.ts` 导入 page.tsx | ✅ 已完成 | 已 import STORAGE, TASK, MASTERY, CARD_REVIEW_INTERVALS, CARD_REVIEW_LABELS, TOAST_DURATION, MAX_STUDY_DAYS, CHAT_KEEP_LAST, HEATMAP_SIZE |
| 11 | `loadData/saveData` 导入 | ✅ 已完成 | 从 storage.ts 导入 |

---

## 🔴 待修复 — 共 8 项

### P1 — 现有常量引用替换（RULES.ts 已导入但未使用）

| # | 行位置 | 硬编码值 | 应替换为 |
|---|--------|---------|---------|
| 1 | 3000 | `setTimeout(() => setNotice(""), 3000)` | ✅ `TOAST_DURATION` |
| 2 | Math.min(dueCards.length, 10) | 10 | ✅ `TASK.maxReviewCards` |
| 3 | Math.min(task.minutes, 30) | 30 | ✅ `TASK.backupMaxMinutes` |
| 4 | Math.max(1, Math.round(elapsedSeconds / 60)) | 1 | `TASK.minElapsedMinutes` |
| 5 | `generatePlan` 固定 60 分钟 | 60 | 动态计算 |
| 6 | slice(-140) | 140 | `MAX_STUDY_DAYS` |
| 7 | Math.min(900, ...) | 900 | `MAX_DATE_RANGE_DAYS` |
| 8 | 卡片掌握度扣减 `-5, -8, +1, +20` | 硬编码 | `MASTERY.confirmUpdatePenalty` 等 |

### P2 — `generatePlan` 动态时长

- 当前固定 `minutes: 60`，应基于 `exam.weekdayHours` 或 `exam.weekendHours` 与任务数动态计算

### P3 — 长期重构

| # | 问题 | 说明 |
|---|------|------|
| 1 | `page.tsx` 2075 行 | 应拆分为组件 |
| 2 | 内联样式未用设计 Token | 数十处 `style={{fontSize:...}}` |
| 3 | `globals.css` 1913 行 | 应改为 CSS Modules |
| 4 | 无自定义 Hooks | `useLocalStorage` 等缺失 |
| 5 | `cloudflare:workers` 类型错误 | `npx next build` 阻断 |

---

## 📊 当前评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整度 | 90% | 核心功能正常 |
| 文档覆盖 | 95% | 文档体系完善 |
| UI/UX | 65% | 黑白灰已统一，内联样式待替换 |
| 代码质量 | 40% | RULES.ts + storage.ts 已创建，常量引用待替换 |
| 可维护性 | 35% | 同上 |
| **综合** | **~65%** | **较第二轮 +10%** |

---

## 下一步（按优先级）

1. 🔴 替换 8 处硬编码常量为 `RULES.ts` 引用（`TOAST_DURATION`, `TASK.*`, `MAX_STUDY_DAYS`, `MASTERY.*` 等）
2. 🟡 `generatePlan` 动态计算任务时长
3. 🔵 修复 `cloudflare:workers` 类型错误（`db/index.ts` 添加 `.ts-ignore`）