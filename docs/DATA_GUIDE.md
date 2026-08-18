# 数据来源规范 (Data Guide)

> 所有数字必须有来源。禁止在代码中硬编码任意数值。
> 所有默认数据统一来自 `default-data.ts`。

**审计报告**: [`/workspace-app/DATA_PROVENANCE_AUDIT.md`](/workspace-app/DATA_PROVENANCE_AUDIT.md)

---

## 1. 核心规则

```
❌ subject.progress = 57
✅ subject.progress = overallProgress (computed)

❌ exam.targetScore = 315
✅ exam.targetScore = subjects.reduce(sum + Number(targetScore), 0)

❌ daysLeft = 143
✅ daysLeft = Math.max(0, Math.ceil((examDate - now) / 86400000))

❌ minutes = 60
✅ minutes = task.minutes (from user input or computed from settings)
```

---

## 2. 数据分类

### A. 用户设置 (可修改)
| 数据 | 类型 | 来源 | 示例 |
|------|------|------|------|
| `exam.examName` | string | seedExam / 用户修改 | "2027 考研初试" |
| `exam.school` | string | seedExam / 用户修改 | "待设置" |
| `exam.major` | string | seedExam / 用户修改 | "数学二" |
| `exam.examDate` | string | seedExam / 用户修改 | "2026-12-26" |
| `exam.weeklyDays` | string | seedExam / 用户修改 | "6" |
| `subject.targetScore` | string | seedSubjects / 用户修改 | "70" |
| `subject.weeklyHours` | string | seedSubjects / 用户修改 | "6" |
| `appSettings.*` | various | seedAppSettings / 用户修改 | — |

### B. 用户行为记录 (累积)
| 数据 | 创建方式 | 存储 |
|------|---------|------|
| `studyDays[]` | recordStudyDay() | localStorage |
| `tasks[]` | generatePlan() / 手动 | localStorage |
| `questions[]` | 手动录入 / AI识别 | localStorage |
| `nodes[]` | 手动添加 / AI更新 | localStorage |
| `cards[]` | createCardFromText() | localStorage |
| `notes[]` | 复盘提交 / AI生成 | localStorage |

### C. 动态计算值
| 数据 | 公式 | 依赖 |
|------|------|------|
| `daysLeft` | `Math.max(0, Math.ceil((exam.examDate - now) / 86400000))` | exam.examDate |
| `totalTargetScore` | `subjects.reduce(sum + Number(targetScore), 0)` | subjects[].targetScore |
| `overallProgress` | `nodes.masteryScore * 0.55 + confirmedQuestions * 0.25 + indexedResources * 0.2` | nodes, questions, resources |
| `completed` | `tasks.filter(done).length` | tasks[].done |
| `completedMinutes` | `tasks.reduce(Number(actualMinutes || minutes), 0)` | tasks |
| `heatmap level` | `day.completed >= 1/2/3/4` | studyDays |
| `reviewMasteryDelta` | `avg(nodes.masteryScore)` | nodes |

### D. 硬编码常量和 Seed 数据
| 值 | 位置 | 用途 |
|----|------|------|
| `"热力学第二定律"` | page.tsx:994 | fallback — **应移除** |
| `"第一轮"`, `"Layer 1"` | page.tsx:861 | fallback — **应统一** |
| `1, 3, 7, 14, 30` | page.tsx:789 | 卡片复习间隔 — **应抽取为常量** |
| `60, 45` | page.tsx:633,666 | generatePlan 任务时长 — **应动态计算** |
| `30` | page.tsx:712 | 备用任务最大分钟 |
| `-5, -8, -1, +1` | page.tsx:560,724 | 掌握度扣减 — **应抽取为常量** |
| `10` | page.tsx:615 | 最大复习卡片数 |

---

## 3. 数字来源链

```
设置页保存考试日期
→ exam.examDate
→ calculate daysLeft()
→ Sidebar 倒计时显示

科目管理设置 targetScore
→ subjects[].targetScore
→ reduce sum: totalTargetScore
→ Sidebar "目标 315"

generatePlan()
→ 读取高风险节点, subjects, resources
→ 生成 tasks[].minutes (当前硬编码 60/45，应改为动态)
→ 今日任务面板显示

热力图
→ studyDays[] (seed + recordStudyDay)
→ today 数据源: studyDays 优先 (当前 page.tsx:207 有 BUG)
→ heatmap level → 颜色
```

---

## 4. 已知数据来源问题

| 优先级 | 问题 | 修复方案 |
|--------|------|---------|
| **P0** | 热力图今天数据被覆盖 | page.tsx:207 优先使用 studyDays 已存记录 |
| **P0** | `task.actualMinutes \|\| ...` 合法 "0" 被忽略 | 改用 `actualMinutes !== "" ? Number(actualMinutes) : ...` |
| **P1** | JSX 硬编码 fallback 字符串 | 提取到 default-data.ts 的常量 |
| **P1** | round/layer fallback 重复定义 | 统一到一处 |
| **P2** | generatePlan 时长硬编码 | 从 exam.weekdayHours 按比例计算 |
| **P2** | 掌握度扣减散落 | 抽取为 `RULES.ts` 常量 |

---

## 5. 未来改进

- 所有 magic number 抽取到 `RULES.ts` 或 `constants.ts`
- 使用 `??` 替代 `||` 避免合法值被替换
- 计算逻辑抽取为纯函数，便于测试