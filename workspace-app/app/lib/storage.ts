"use client";

import type {
  AgentStep, AppSettings, Annotation, CardCategory, ChatSession, ExamGoal,
  GrowthCard, KnowledgeNode, Material, MaterialSection, Note, PendingItem,
  PlanLog, Question, Resource, Review, StudyDay, StudyDraft, StructuredReview,
  Subject, Task,
} from "./types";

/**
 * Storage Contract（Stabilization 1C-1 实现）
 *
 * 依据 docs/STORAGE_CONTRACT.md 设计：
 *   - 单一 workspace key：`nest-exam-workspace-v5`，内部携带 storageVersion（v6 起含 materials/sections）
 *   - 唯一 Owner：storage.ts 提供 hydrateWorkspace / saveWorkspace / migrateWorkspace
 *   - page.tsx 不再直写 localStorage，统一经本模块读写
 *   - 迁移：以 v3 为业务数据基座，用 v4 补充 Memory Engine 字段；v3/v4 原样保留可回滚
 *   - 独立 key 保持独立：events（nest-exam-learning-events-v4）、IndexedDB（pdf）
 *
 * Failure Policy（§5，禁止静默丢数据）：
 *   - hydrate 失败(JSON 损坏) → 保留损坏原始串到 __corrupt_backup；返回空；不清除原 key
 *   - Migration 失败 → 保留 v3/v4 原样；回退读取旧数据；不采纳半迁移结果
 *   - 版本高于当前 → 只读保护：拒绝写入新结构，避免降级覆盖
 */

/** 当前契约版本（新 key 内部携带；未来升级走 migration 表，不用大量 if） */
export const STORAGE_VERSION = 6;
/** 唯一 workspace key（兼容 v5 key 名；内部 storageVersion 已升级到 6） */
export const WORKSPACE_KEY = "nest-exam-workspace-v5";
/** 旧 v3 业务数据 key（迁移源） */
export const LEGACY_KEY_V3 = "nest-exam-workspace-v3";
/** 旧 v4 数据 key（迁移源：Memory Engine 字段） */
export const LEGACY_KEY_V4 = "nest-exam-workspace-v4";
/** 损坏原始串备份 key（hydrate 失败时保留现场） */
export const CORRUPT_BACKUP_KEY = "nest-exam-workspace-v5.corrupt_backup";
/** v3/v4 迁移后留下的时间戳标记 key */
const MIGRATED_AT_KEY = "__migratedAt";
const UI_STATE_KEY_PREFIX = "nest-exam-ui:";

/**
 * Workspace 快照（page.tsx save effect 的字段清单 + 兼容字段）。
 *
 * - 已知业务字段全部强类型化：hydrate 侧通过 if 守卫即可收窄，无需手工断言。
 * - 其余未声明字段（如 v4 Memory 引擎字段 longTermMemory 等）经索引签名保持
 *   `unknown`，由调用方在需要时以类型守卫/断言访问，避免 `any` 扩散。
 */
export type WorkspaceSnapshot = {
  storageVersion?: number;
  exam?: ExamGoal;
  appSettings?: AppSettings;
  subjects?: Subject[];
  activeKnowledgeSubject?: string;
  activeCardSubject?: string;
  resources?: Resource[];
  materials?: Material[];
  materialSections?: MaterialSection[];
  questions?: Question[];
  nodes?: KnowledgeNode[];
  tasks?: Task[];
  pending?: PendingItem[];
  notes?: Note[];
  cards?: GrowthCard[];
  annotations?: Annotation[];
  activeResourceId?: string;
  readerSearch?: string;
  readerPage?: string;
  readerZoom?: string;
  studyDays?: StudyDay[];
  agentSteps?: AgentStep[];
  logs?: PlanLog[];
  chatSessions?: ChatSession[];
  activeSessionId?: string;
  review?: Review;
  structuredReviews?: StructuredReview[];
  studyDraft?: StudyDraft;
  cardCategories?: CardCategory[];
  onboardingCompleted?: boolean;
  /** 旧版 chat 数组（迁移源，见 chat.migrateLegacyChat） */
  chat?: unknown;
  timer?: {
    activeTimerTaskId?: string;
    timerStartTime?: string;
    timerAccumSeconds?: number;
    timerRunStartEpoch?: number;
  };
  /** 其余未声明的兼容字段（v4 Memory 字段等）保持 unknown */
  [key: string]: unknown;
};

/**
 * 构建持久化快照所需的全部业务 state（page.tsx save effect 与 handleExportData
 * 共用同一清单——新增/删除持久化字段只需改此处一处，杜绝两处清单漂移）。
 */
export interface WorkspaceStateInput {
  exam: ExamGoal;
  appSettings: AppSettings;
  subjects: Subject[];
  activeKnowledgeSubject: string;
  activeCardSubject: string;
  resources: Resource[];
  materials: Material[];
  materialSections: MaterialSection[];
  questions: Question[];
  nodes: KnowledgeNode[];
  tasks: Task[];
  pending: PendingItem[];
  notes: Note[];
  cards: GrowthCard[];
  annotations: Annotation[];
  activeResourceId: string;
  readerSearch: string;
  readerPage: string;
  readerZoom: string;
  studyDays: StudyDay[];
  agentSteps: AgentStep[];
  logs: PlanLog[];
  chatSessions: ChatSession[];
  activeSessionId: string;
  review: Review;
  structuredReviews: StructuredReview[];
  studyDraft: StudyDraft | null;
  categories: CardCategory[];
  onboardingCompleted: boolean;
  timer: {
    activeTimerTaskId: string;
    timerStartTime: string;
    timerAccumSeconds: number;
    timerRunStartEpoch: number;
  };
}

/** 从内存 state 构建持久化快照（唯一字段清单；不含 storageVersion，由 saveWorkspace 注入） */
export function buildWorkspaceSnapshot(input: WorkspaceStateInput): Omit<WorkspaceSnapshot, "storageVersion"> {
  const {
    exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject,
    resources, materials, materialSections, questions, nodes, tasks, pending, notes, cards, annotations,
    activeResourceId, readerSearch, readerPage, readerZoom,
    studyDays, agentSteps, logs, chatSessions, activeSessionId, review, structuredReviews, studyDraft,
    categories, onboardingCompleted, timer,
  } = input;
  return {
    exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject,
    resources, materials, materialSections, questions, nodes, tasks, pending, notes, cards, annotations,
    activeResourceId, readerSearch, readerPage, readerZoom,
    studyDays, agentSteps, logs, chatSessions, activeSessionId, review, structuredReviews, studyDraft,
    cardCategories: categories, onboardingCompleted,
    timer: { ...timer },
  };
}

function safeParse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function saveUiState(key: string, value: unknown): boolean {
  return writeRaw(`${UI_STATE_KEY_PREFIX}${key}`, value);
}

/** 读取 UI 状态（如 Sidebar 热力图折叠态）。无数据/解析失败返回 null。 */
export function loadUiState(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(`${UI_STATE_KEY_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * 一次性迁移辅助：读取历史直写 key 的原始字符串值（如旧 `kaoyan-heatmap-expanded`
 * 直接存 `"1"`/`"0"` 非 JSON）。只读不写；新代码统一走 loadUiState/saveUiState。
 */
export function readLegacyRawValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function mirrorWorkspaceToD1(snapshot: WorkspaceSnapshot) {
  if (typeof fetch !== "function") return;
  void fetch("/api/workspace", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(snapshot),
    keepalive: true,
  }).catch(() => {});
}

/**
 * 迁移：以 v3 为业务数据基座，用 v4 补充 Memory Engine 字段，写入 v5。
 * v3/v4 原样保留（只写 `__migratedAt` 只读标记，不删除）→ 可回滚。
 */
export function migrateWorkspace(): WorkspaceSnapshot | null {
  const rawV3 = window.localStorage.getItem(LEGACY_KEY_V3);
  const rawV4 = window.localStorage.getItem(LEGACY_KEY_V4);
  const v3 = safeParse(rawV3);
  const v4 = safeParse(rawV4);

  // 若 v3/v4 均损坏/缺失 → 不能迁移（v3 是业务基座，缺失即无迁移源）
  if (!v3 && !v4) return null;

  const merged: WorkspaceSnapshot = {
    storageVersion: STORAGE_VERSION,
    ...(v3 || {}),
  };

  // 用 v4 补充 Memory Engine 字段（不覆盖 v3 同名业务字段）
  if (v4) {
    const memoryFields: string[] = [
      "longTermMemory",
      "masteryHistory",
      "dailyPortraits",
      "reflections",
      "learningProfile",
      "dataVersion",
      "structuredReviews",
    ];
    for (const field of memoryFields) {
      if (v4[field] !== undefined && merged[field] === undefined) {
        merged[field] = v4[field];
      }
    }
  }

  // 写入新 key（失败则回退读取旧 key，不采纳半迁移结果）
  const written = writeRaw(WORKSPACE_KEY, merged);
  if (!written) return v3 || { storageVersion: STORAGE_VERSION };

  // v3/v4 留下只读迁移标记（不删除原数据，可回滚）
  const now = new Date().toISOString();
  if (rawV3) window.localStorage.setItem(LEGACY_KEY_V3, JSON.stringify({ ...(v3 || {}), [MIGRATED_AT_KEY]: now }));
  if (rawV4) window.localStorage.setItem(LEGACY_KEY_V4, JSON.stringify({ ...(v4 || {}), [MIGRATED_AT_KEY]: now }));

  return merged;
}

/**
 * 唯一 hydrate 入口：优先读 v5；v5 不存在且有 v3/v4 时自动迁移。
 * JSON 损坏 → 保留原始串到备份 key，返回空态（不清除原 key）。
 */
export function hydrateWorkspace(): WorkspaceSnapshot | null {
  const rawV5 = window.localStorage.getItem(WORKSPACE_KEY);
  const v5 = safeParse(rawV5);
  if (v5) {
    // 版本高于当前 → 只读保护：拒绝读取降级（返回 null 触发空态，不覆盖）
    const ver = typeof v5.storageVersion === "number" ? v5.storageVersion : 0;
    if (ver > STORAGE_VERSION) {
      console.error(`[Storage] 数据版本 ${ver} 高于支持版本 ${STORAGE_VERSION}，已启用只读保护`);
      return null;
    }
    return v5 as WorkspaceSnapshot;
  }
  // v5 损坏但存在原始串 → 备份现场
  if (rawV5) {
    try { window.localStorage.setItem(CORRUPT_BACKUP_KEY, rawV5); } catch { /* 忽略备份失败 */ }
    console.error("[Storage] v5 数据损坏，已备份到 corrupt_backup");
    return null;
  }
  // 首次启动：尝试迁移 v3+v4
  return migrateWorkspace();
}

/**
 * 服务端工作区拉取（SQLite / D1 同步模式）：
 * 本地无存档（首次打开 / 换浏览器 / 清缓存）时，从服务端恢复最近一次保存的工作区快照，
 * 并写入本地 localStorage。任何失败都静默降级为空态（保持纯本地模式可用）。
 */
export async function fetchServerWorkspace(): Promise<WorkspaceSnapshot | null> {
  try {
    const res = await fetch("/api/workspace", { method: "GET" });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: boolean; snapshot?: unknown; storageVersion?: number };
    if (!body?.ok || !body.snapshot || typeof body.snapshot !== "object") return null;
    const ver = typeof body.storageVersion === "number" ? body.storageVersion : 0;
    // 只读保护：服务端版本高于当前构建 → 拒绝降级读取（避免旧构建覆盖新数据）
    if (ver > STORAGE_VERSION) return null;
    const snapshot = body.snapshot as WorkspaceSnapshot;
    // 写入本地（saveWorkspace 内部有版本守卫）；写失败则放弃
    if (!saveWorkspace(snapshot as Omit<WorkspaceSnapshot, "storageVersion">)) return null;
    return snapshot;
  } catch {
    return null;
  }
}

/**
 * 唯一 save 入口：写入 v5（带 storageVersion）。
 * 写失败 → 返回 false（不覆盖已有数据），由调用方提示用户。
 * 写前版本守卫：磁盘已是更高版本 → 拒写返回 false（与读侧 hydrateWorkspace 对称，
 * 防止旧构建自动保存降级覆盖未来版本数据）。
 */
export function saveWorkspace(snapshot: Omit<WorkspaceSnapshot, "storageVersion">): boolean {
  // 版本守卫：仅当磁盘无 v5 或版本 ≤ 当前时才可写。
  // 注意：不能依赖 hydrateWorkspace()（损坏时返回 null 会误判为可写），需读原始串判断。
  const rawV5 = window.localStorage.getItem(WORKSPACE_KEY);
  if (rawV5) {
    try {
      const existing = JSON.parse(rawV5) as { storageVersion?: unknown };
      const ver = typeof existing.storageVersion === "number" ? existing.storageVersion : 0;
      if (ver > STORAGE_VERSION) {
        console.error(`[Storage] 数据版本 ${ver} 高于支持版本 ${STORAGE_VERSION}，拒绝写入（只读保护）`);
        return false;
      }
    } catch {
      // 磁盘 v5 损坏 → 由 hydrate 侧处理备份；此处不应因损坏而拒写（允许覆盖重建）
    }
  }

  const withVersion: WorkspaceSnapshot = {
    ...snapshot,
    storageVersion: STORAGE_VERSION,
    // 本地保存时间戳（用于与服务端 updatedAt 比较新鲜度，检测多设备更新）
    savedAt: new Date().toISOString(),
  };
  const ok = writeRaw(WORKSPACE_KEY, withVersion);
  if (ok) mirrorWorkspaceToD1(withVersion);
  return ok;
}

/** 读取本地快照的 savedAt（用于与服务端 updatedAt 比较新鲜度） */
export function readLocalSavedAt(): string | null {
  const raw = window.localStorage.getItem(WORKSPACE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { savedAt?: unknown };
    return typeof parsed.savedAt === "string" ? parsed.savedAt : null;
  } catch {
    return null;
  }
}

/** 获取服务端快照元信息（updatedAt/storageVersion），用于多设备新鲜度检测 */
export async function fetchServerWorkspaceMeta(): Promise<{ updatedAt: string; storageVersion: number } | null> {
  try {
    const res = await fetch("/api/workspace", { method: "GET" });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      ok?: boolean;
      snapshot?: unknown;
      updatedAt?: unknown;
      storageVersion?: unknown;
    };
    if (!body?.ok || !body.snapshot) return null;
    return {
      updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : "",
      storageVersion: typeof body.storageVersion === "number" ? body.storageVersion : 0,
    };
  } catch {
    return null;
  }
}
