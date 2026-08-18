# localStorage 规范 (Storage Guide)

> 所有 localStorage 操作必须统一。

---

## 1. 当前状态

**存储 Key**: `nest-exam-workspace-v3`

**存储位置**: `page.tsx` 中的两个 useEffect:
1. `lines 104-143`: 首次加载时从 localStorage 读取并恢复 state
2. `lines 145-147`: 每次 state 变化时全量保存

### 问题

1. **每次 state 变化都全量写入** ─ 性能浪费，应使用 debounce
2. **写入和读取逻辑散布在 page.tsx** ─ 应抽取为独立模块
3. **没有版本管理** ─ 数据格式变更时无迁移策略
4. **序列化/反序列化在 useEffect 中** ─ 错误处理不完整

---

## 2. 目标设计

```typescript
// app/lib/storage.ts

const STORAGE_KEY = "nest-exam-workspace-v3";
const STORAGE_VERSION = 3;

export interface StorageData {
  version: number;
  savedAt: string;
  exam: ExamGoal;
  appSettings: AppSettings;
  subjects: Subject[];
  // ... 所有持久化字段
}

export function loadState(): Partial<StorageData> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StorageData;
    return migrateIfNeeded(data);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveState(data: Omit<StorageData, 'version' | 'savedAt'>): void {
  try {
    const payload: StorageData = {
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      ...data,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error("Failed to save state:", e);
  }
}

function migrateIfNeeded(data: StorageData): StorageData {
  // 版本迁移逻辑
  if (!data.version || data.version < STORAGE_VERSION) {
    // 执行迁移
  }
  return data;
}
```

---

## 3. 使用规范

### 读取
```typescript
// ✅ 正确 — 通过 storage.ts
const saved = loadState();
if (saved) {
  setExam(saved.exam ?? seedExam);
  setSubjects(saved.subjects ?? seedSubjects);
}

// ❌ 禁止 — 直接在 useEffect 中操作 localStorage
const raw = window.localStorage.getItem("nest-exam-workspace-v3");
```

### 写入
```typescript
// ✅ 正确 — 通过 storage.ts + debounce
const debouncedSave = useMemo(
  () => debounce((data) => saveState(data), 1000),
  []
);
useEffect(() => {
  debouncedSave({ exam, appSettings, subjects, ... });
}, [exam, appSettings, subjects, ...]);

// ❌ 禁止 — 每次 state 变化都写入
useEffect(() => {
  window.localStorage.setItem("nest-exam-workspace-v3", JSON.stringify({...}));
}, [exam, ...]);
```

---

## 4. 数据迁移策略

```typescript
const MIGRATIONS: Record<number, (data: any) => any> = {
  // v1 → v2: 添加 examGoalCreatedAt
  2: (data) => ({
    ...data,
    exam: {
      ...data.exam,
      examGoalCreatedAt: data.exam.examGoalCreatedAt ?? dateOnly(),
    },
  }),
  // v2 → v3: 添加 readingMinutes
  3: (data) => ({
    ...data,
    resources: (data.resources ?? []).map((r: any) => ({
      ...r,
      readingMinutes: r.readingMinutes ?? "",
    })),
  }),
};
```

---

## 5. 当前存储字段清单

| 字段 | 类型 | 来源 | 迁移版本 |
|------|------|------|---------|
| exam | ExamGoal | seedExam / 用户修改 | v2 added examGoalCreatedAt |
| appSettings | AppSettings | seedAppSettings / 用户修改 | — |
| subjects | Subject[] | seedSubjects / 用户修改 | — |
| activeKnowledgeSubject | string | 用户选择 | — |
| activeCardSubject | string | 用户选择 | — |
| resources | Resource[] | seedResources / 用户上传 | v3 added readingMinutes |
| questions | Question[] | seedQuestions / 录入 | — |
| nodes | KnowledgeNode[] | seedNodes / 添加 | — |
| tasks | Task[] | seedTasks / generatePlan | — |
| pending | PendingItem[] | AI识别 | — |
| notes | Note[] | seedNotes / 生成 | — |
| cards | GrowthCard[] | seedCards / 创建 | v2 added nextReviewAt |
| annotations | Annotation[] | seedAnnotations / 添加 | — |
| activeResourceId | string | 用户选择 | — |
| readerSearch | string | 用户输入 | — |
| readerPage | string | 用户输入 | — |
| readerZoom | string | 默认 100% | — |
| favoritePages | string[] | 用户收藏 | — |
| studyDays | StudyDay[] | seedStudyDays / 记录 | — |
| agentSteps | AgentStep[] | Agent 工作流 | — |
| logs | PlanLog[] | generatePlan / 复盘 | v2 added dataRead, userRevision |
| chat | ChatMessage[] | 对话 | — |