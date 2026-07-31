import type {
  StudyDay,
  MemoryItem,
  StructuredReview,
  KnowledgeMasteryMap,
  DailyPortrait,
  Reflection,
  ChatLearningEvent,
  LearningProfile,
} from "./types";

const STORAGE_KEY = "nest-exam-workspace-v4";
const SAVE_DEBOUNCE_MS = 500;
const DATA_VERSION = 2;

type SaveData = Record<string, unknown>;

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * localStorage 操作封装层
 * - 统一读写入口
 * - 防抖保存
 * - 数据版本迁移
 * - 记忆引擎数据自动清理
 */

export function loadData(): SaveData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return migrateData(data);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveData(data: SaveData): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, __version: DATA_VERSION }));
    } catch {
      // localStorage 写满或不可用时静默失败
    }
  }, SAVE_DEBOUNCE_MS);
}

export function saveDataImmediate(data: SaveData): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, __version: DATA_VERSION }));
  } catch {
    // 静默失败
  }
}

// ════════════════════════════════════════════════════════════
// Memory Engine 辅助接口
// ════════════════════════════════════════════════════════════

/** Memory Engine 运行状态 */
export interface MemoryEngineStatus {
  lastExtractionAt: string;
  lastPortraitAt: string;
  lastReflectionAt: string;
  lastKnowledgeUpdateAt: string;
  pendingExtractions: number;
  version: number;
}

/** 记忆引擎数据接口 */
export interface MemoryEngineData {
  longTermMemory: MemoryItem[];
  structuredReviews: StructuredReview[];
  masteryHistory: KnowledgeMasteryMap[];
  dailyPortraits: DailyPortrait[];
  reflections: Reflection[];
  chatLearningEvents: ChatLearningEvent[];
  learningProfile: LearningProfile | null;
  memoryEngine: MemoryEngineStatus;
}

/**
 * 获取默认记忆引擎状态
 */
function defaultMemoryEngineStatus(): MemoryEngineStatus {
  return {
    lastExtractionAt: "",
    lastPortraitAt: "",
    lastReflectionAt: "",
    lastKnowledgeUpdateAt: "",
    pendingExtractions: 0,
    version: 1,
  };
}

/**
 * 初始化空记忆引擎数据
 */
export function createEmptyMemoryData(): MemoryEngineData {
  return {
    longTermMemory: [],
    structuredReviews: [],
    masteryHistory: [],
    dailyPortraits: [],
    reflections: [],
    chatLearningEvents: [],
    learningProfile: null,
    memoryEngine: defaultMemoryEngineStatus(),
  };
}

/** 30 天前的日期（用于过期检查） */
function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * 清理过期的记忆引擎数据
 */
function cleanupExpiredData(data: SaveData): SaveData {
  const now = new Date().toISOString();
  const cutoff30 = dateDaysAgo(30);
  const cutoff90 = dateDaysAgo(90);
  const cutoff7 = dateDaysAgo(7);
  const cleaned = { ...data };

  // 清理过期复盘（保留 30 天）
  const reviews = (cleaned.structuredReviews ?? []) as StructuredReview[];
  cleaned.structuredReviews = reviews.filter((r) => r.date >= cutoff30);

  // 清理过期画像（保留 90 天）
  const portraits = (cleaned.dailyPortraits ?? []) as DailyPortrait[];
  cleaned.dailyPortraits = portraits.filter((p) => p.date >= cutoff90);

  // 清理过期反思（保留 30 天）
  const reflections = (cleaned.reflections ?? []) as Reflection[];
  cleaned.reflections = reflections.filter((r) => r.date >= cutoff30);

  // 清理过期聊天事件（保留 7 天）
  const events = (cleaned.chatLearningEvents ?? []) as ChatLearningEvent[];
  cleaned.chatLearningEvents = events.filter((e) => e.timestamp >= cutoff7);

  // 清理过期长期记忆
  const memories = (cleaned.longTermMemory ?? []) as MemoryItem[];
  cleaned.longTermMemory = memories.filter((m) => {
    if (m.expiresAt === null) return true; // 永久保留
    return m.expiresAt >= now;
  });

  return cleaned;
}

/**
 * 数据版本迁移
 * v0 → v1: 确保 examGoalCreatedAt 存在
 * v1 → v2: 初始化记忆引擎字段，支持清理过期数据
 */
function migrateData(data: SaveData): SaveData {
  const version = (data as { __version?: number }).__version ?? 0;
  let migrated = { ...data };

  if (version < 1) {
    // v0 → v1: 确保 examGoalCreatedAt 存在
    const exam = migrated.exam as Record<string, string> | undefined;
    if (exam && !exam.examGoalCreatedAt) {
      const studyDays = (migrated.studyDays ?? []) as StudyDay[];
      const earliestDate = studyDays.length
        ? studyDays.map((d: StudyDay) => d.date).sort()[0]
        : new Date().toISOString().slice(0, 10);
      migrated.exam = { ...exam, examGoalCreatedAt: earliestDate };
    }
    migrated.__version = 1;
  }

  if (version < 2) {
    // v1 → v2: 初始化记忆引擎字段
    const memoryDefaults = createEmptyMemoryData();
    migrated = {
      ...migrated,
      longTermMemory: migrated.longTermMemory ?? memoryDefaults.longTermMemory,
      structuredReviews: migrated.structuredReviews ?? memoryDefaults.structuredReviews,
      masteryHistory: migrated.masteryHistory ?? memoryDefaults.masteryHistory,
      dailyPortraits: migrated.dailyPortraits ?? memoryDefaults.dailyPortraits,
      reflections: migrated.reflections ?? memoryDefaults.reflections,
      chatLearningEvents: migrated.chatLearningEvents ?? memoryDefaults.chatLearningEvents,
      learningProfile: migrated.learningProfile ?? memoryDefaults.learningProfile,
      memoryEngine: migrated.memoryEngine ?? memoryDefaults.memoryEngine,
    };
    migrated.__version = 2;
  }

  // 加载时清理过期数据（仅 v2+）
  const currentVersion = (migrated as { __version?: number }).__version ?? 0;
  if (currentVersion >= 2) {
    migrated = cleanupExpiredData(migrated);
  }

  return migrated;
}

export function clearData(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 静默失败
  }
}

/** 添加长期记忆条目 */
export function addMemoryItem(data: SaveData, item: MemoryItem): SaveData {
  const memories = (data.longTermMemory ?? []) as MemoryItem[];
  return {
    ...data,
    longTermMemory: [...memories, item],
  };
}

/** 按类型检索长期记忆 */
export function getMemoriesByType(data: SaveData, type: MemoryItem["type"]): MemoryItem[] {
  const memories = (data.longTermMemory ?? []) as MemoryItem[];
  return memories.filter((m) => m.type === type);
}

/** 按知识点 ID 检索长期记忆 */
export function getMemoriesByNode(data: SaveData, nodeId: string): MemoryItem[] {
  const memories = (data.longTermMemory ?? []) as MemoryItem[];
  return memories.filter((m) => m.relatedNodeIds.includes(nodeId));
}

/** 按标签检索长期记忆 */
export function getMemoriesByTag(data: SaveData, tag: string): MemoryItem[] {
  const memories = (data.longTermMemory ?? []) as MemoryItem[];
  return memories.filter((m) => m.tags.includes(tag));
}

/** 添加结构化复盘 */
export function addStructuredReview(data: SaveData, review: StructuredReview): SaveData {
  const reviews = (data.structuredReviews ?? []) as StructuredReview[];
  return {
    ...data,
    structuredReviews: [...reviews, review],
  };
}

/** 添加知识掌握度快照 */
export function addMasterySnapshot(data: SaveData, map: KnowledgeMasteryMap): SaveData {
  const history = (data.masteryHistory ?? []) as KnowledgeMasteryMap[];
  return {
    ...data,
    masteryHistory: [...history, map],
  };
}

/** 添加每日画像 */
export function addDailyPortrait(data: SaveData, portrait: DailyPortrait): SaveData {
  const portraits = (data.dailyPortraits ?? []) as DailyPortrait[];
  return {
    ...data,
    dailyPortraits: [...portraits, portrait],
  };
}

/** 添加 AI 反思 */
export function addReflection(data: SaveData, reflection: Reflection): SaveData {
  const reflections = (data.reflections ?? []) as Reflection[];
  return {
    ...data,
    reflections: [...reflections, reflection],
  };
}

/** 添加聊天学习事件 */
export function addChatLearningEvent(data: SaveData, event: ChatLearningEvent): SaveData {
  const events = (data.chatLearningEvents ?? []) as ChatLearningEvent[];
  return {
    ...data,
    chatLearningEvents: [...events, event],
  };
}

/** 更新学习画像 */
export function updateLearningProfile(data: SaveData, profile: LearningProfile): SaveData {
  return {
    ...data,
    learningProfile: profile,
  };
}

/** 更新记忆引擎状态 */
export function updateMemoryEngineStatus(data: SaveData, status: Partial<MemoryEngineStatus>): SaveData {
  const current = (data.memoryEngine ?? defaultMemoryEngineStatus()) as MemoryEngineStatus;
  return {
    ...data,
    memoryEngine: { ...current, ...status },
  };
}