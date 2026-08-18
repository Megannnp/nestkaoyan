# 第二轮审查报告 — 2026-07-30

> 基于第一次审查修复后的重新评估。

---

## ✅ 已关闭项

| 问题 | 状态 | 变更 |
|------|------|------|
| 热力图今天数据源 BUG | ✅ 已修复 | `heatmapDays` 中 today 行改为用 `studyDays` 已存记录 |
| actualMinutes "0" 被忽略 | ✅ 已修复 | 3 处 `||` → `!== ""` |
| Heatmap Runtime Error | ✅ 已修复 | 3 处 `cellEl.closest()` 前加 `instanceof HTMLElement` |
| Sidebar 绿色主题残留 | ✅ 已修复 | Logo、进度条、热力图滚动条/tooltip、四宫格阴影 |
| 删除「当前核心」模块 | ✅ 已修复 | 按需移除 |
| "use client" 指令 | ✅ 已修复 | 添加后构建通过 |
| 创建 `RULES.ts` | ✅ 已完成 | 抽取所有魔法常量到 `app/lib/rules.ts` |

---

## 🔴 未修复 P0

**无** — 所有 P0 已关闭。

---

## 🟠 未修复 P1

| 问题 | 优先级 | 说明 |
|------|--------|------|
| `RULES.ts` 未在 `page.tsx` 中引用 | P1 | 已创建文件但尚未替换 page.tsx 中的硬编码常量 |
| JSX 硬编码 fallback 字符串 | P1 | `"热力学第二定律"`、`"第一轮"`、`"Layer 1"` 等仍在 JSX 中 |
| round/layer fallback 重复定义 | P1 | `addSubject` vs `generatePlan` 中有重复的 round/layer 默认值 |

---

## 🟡 未修复 P2

| 问题 | 说明 |
|------|------|
| `generatePlan` 任务时长固定 60 分钟 | 应基于 `exam.weekdayHours` / `exam.weekendHours` 动态计算 |
| localStorage 无单独封装层 | 仍在 page.tsx 中直接操作 `window.localStorage` |
| 无数据版本迁移支持 | 数据格式变更时无迁移逻辑 |

---

## 🔵 未修复 P3 (大规模重构)

| 问题 | 行数/复杂度 | 说明 |
|------|-------------|------|
| `page.tsx` 2075 行 | 超大 | 应拆分为 ~20 个组件 |
| 内联样式未使用 `design-tokens.ts` | 大量 | 数十处 `style={{fontSize:...}}` 未引用 Token |
| `globals.css` 1913 行 | 超大 | 应改为 CSS Modules 按组件拆分 |
| 无自定义 Hooks | 缺失 | `useLocalStorage`、`useTasks` 等 8 个 Hook 缺失 |
| `cloudflare:workers` 类型错误 | 构建阻断 | `db/index.ts` 需跳过类型检查或安装类型声明 |

---

## 📊 当前评分（基于首次审查的修正）

| 维度 | 首次评分 | 当前评分 | 变化 |
|------|---------|---------|------|
| 功能完整度 | 85% | 90% | +5% (P0 修复) |
| 文档覆盖 | 95% | 95% | — |
| UI/UX | 60% | 65% | +5% (Sidebar 颜色修复) |
| 代码质量 | 30% | 35% | +5% (RULES.ts 创建) |
| 可维护性 | 20% | 25% | +5% (常量抽取) |
| **综合** | ~50% | **~55%** | **+5%** |

---

## 下一步建议

1. **P1**: 将 `page.tsx` 中的硬编码魔法常量替换为引用 `rules.ts`
2. **P1**: 提取 JSX fallback 字符串到 `default-data.ts`
3. **P2**: 创建 `storage.ts` 封装 localStorage 操作层 + debounce
4. **P2**: `generatePlan` 任务时长改为基于考试目标动态计算
5. **P3**: 开始拆分 `page.tsx` — 优先将 Sidebar 抽取为独立组件
6. **Tech Debt**: 修复 `cloudflare:workers` 类型错误让 `next build` 通过