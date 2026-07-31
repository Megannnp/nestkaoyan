/**
 * Memory Engine — 记忆引擎单例
 *
 * 统一管理记忆引擎全部功能：
 * - Phase 2: MemoryItem CRUD + 检索
 * - Phase 3: 知识图谱掌握度更新
 * - Phase 4: 每日画像生成
 * - Phase 5: AI 反思
 * - Phase 6: 全模块共享接口
 */

import type {
  MemoryItem, MemoryType, KnowledgeNode, Task,
  StructuredReview, KnowledgeMasteryMap, KnowledgeSnapshot,
  DailyPortrait, Reflection, LearningProfile, StudyMood,
} from "./types";
import { generateMemoryId } from "./memory-rules";
import type { MemoryEngineData, MemoryEngineStatus } from "./storage";
import { createEmptyMemoryData } from "./storage";

type SaveData = Record<string, unknown>;

// ════════════════════════════════════════════════════════════
// Phase 2: 记忆引擎核心
// ════════════════════════════════════════════════════════════

/** 获取所有长期记忆 */
export function getMemory(data: SaveData, type?: MemoryType): MemoryItem[] {
  const engine = getEngineData(data);
  let items = engine.longTermMemory;
  if (type) items = items.filter((m) => m.type === type);
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 添加记忆条目 */
export function addMemory(
  data: SaveData,
  item: Omit<MemoryItem, "id" | "createdAt" | "lastAccessed" | "accessCount">
): SaveData {
  const engine = getEngineData(data);
  const newItem: MemoryItem = {
    ...item,
    id: generateMemoryId(),
    createdAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    accessCount: 0,
  };
  return {
    ...data,
    longTermMemory: [...engine.longTermMemory, newItem],
    memoryEngine: {
      ...engine.memoryEngine,
      lastExtractionAt: new Date().toISOString(),
      pendingExtractions: Math.max(0, engine.memoryEngine.pendingExtractions - 1),
    },
  };
}

/** 移除记忆条目 */
export function removeMemory(data: SaveData, id: string): SaveData {
  const engine = getEngineData(data);
  return {
    ...data,
    longTermMemory: engine.longTermMemory.filter((m) => m.id !== id),
  };
}

/** 按知识点检索 */
export function getMemoriesByNode(data: SaveData, nodeId: string): MemoryItem[] {
  return getMemory(data).filter((m) => m.relatedNodeIds.includes(nodeId));
}

/** 按标签检索 */
export function getMemoriesByTag(data: SaveData, tag: string): MemoryItem[] {
  return getMemory(data).filter((m) => m.tags.includes(tag));
}

// ════════════════════════════════════════════════════════════
// Phase 3: 掌握度更新
// ════════════════════════════════════════════════════════════

/** 生成掌握度快照 */
export function generateMasterySnapshot(
  data: SaveData,
  nodes: KnowledgeNode[]
): KnowledgeMasteryMap {
  const snapshots: KnowledgeSnapshot[] = nodes.map((n) => ({
    nodeId: n.id,
    date: new Date().toISOString().slice(0, 10),
    masteryScore: n.masteryScore,
    confidence: n.confidence as "低" | "中" | "高",
    delta: 0,
    deltaReason: "",
    forgetRisk: n.mistakes * 10,
    lastReviewDate: "",
    nextReviewDate: "",
    recentMistakes: n.mistakes,
    recentAccuracy: 50,
  }));

  const scores = snapshots.map((s) => s.masteryScore);
  const overallMastery = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  const weakPoints = snapshots
    .filter((s) => s.masteryScore < 50)
    .map((s) => ({ nodeId: s.nodeId, score: s.masteryScore }));

  return {
    date: new Date().toISOString().slice(0, 10),
    snapshots,
    overallMastery: Math.round(overallMastery),
    trend: "stable",
    weakPoints,
    improvingPoints: [],
  };
}

/** 添加掌握度快照到历史 */
export function addMasterySnapshotToHistory(
  data: SaveData,
  map: KnowledgeMasteryMap
): SaveData {
  const engine = getEngineData(data);
  return {
    ...data,
    masteryHistory: [...engine.masteryHistory, map],
  };
}

// ════════════════════════════════════════════════════════════
// Phase 4: 每日画像
// ════════════════════════════════════════════════════════════

/** 生成每日画像 */
export function generateDailyPortrait(
  data: SaveData,
  tasks: Task[],
  nodes: KnowledgeNode[],
  studyMood?: StudyMood
): DailyPortrait {
  const doneTasks = tasks.filter((t) => t.done);
  const totalMinutes = doneTasks.reduce(
    (sum, t) => sum + (Number(t.actualMinutes) || 0),
    0
  );
  const completionRate = tasks.length
    ? doneTasks.length / tasks.length
    : 0;

  const improved = nodes
    .filter((n) => n.masteryScore > 60)
    .map((n) => ({ nodeId: n.id, name: n.knowledge, delta: 5 }));
  const declined = nodes
    .filter((n) => n.masteryScore < 40)
    .map((n) => ({ nodeId: n.id, name: n.knowledge, delta: -5 }));

  const portrait: DailyPortrait = {
    date: new Date().toISOString().slice(0, 10),
    overallRating: Math.round(completionRate * 100),
    stats: {
      totalMinutes,
      tasksCompleted: doneTasks.length,
      completionRate: Math.round(completionRate * 100),
      effectiveMinutes: totalMinutes,
      procrastinationMinutes: 0,
    },
    masteryChanges: { improved, declined },
    emotion: {
      overall: studyMood || "正常",
      timeline: [],
    },
    recommendations: [
      {
        priority: declined.length > 0 ? "high" : "low",
        content: declined.length > 0
          ? `重点复习 ${declined.map((d) => d.name).join("、")}`
          : "继续保持当前节奏",
        reason: declined.length > 0 ? "掌握度下降" : "状态良好",
        actionType: declined.length > 0 ? "review" : "task",
      },
    ],
    summary: `今日完成 ${doneTasks.length}/${tasks.length} 个任务，共 ${totalMinutes} 分钟。掌握度 ${improved.length > 0 ? "提升" : "稳定"}。`,
  };

  return portrait;
}

/** 添加每日画像 */
export function addDailyPortrait(
  data: SaveData,
  portrait: DailyPortrait
): SaveData {
  const engine = getEngineData(data);
  return {
    ...data,
    dailyPortraits: [...engine.dailyPortraits, portrait],
    memoryEngine: {
      ...engine.memoryEngine,
      lastPortraitAt: new Date().toISOString(),
    },
  };
}

// ════════════════════════════════════════════════════════════
// Phase 5: AI 反思
// ════════════════════════════════════════════════════════════

/** 检测异常 */
export function detectAnomalies(
  nodes: KnowledgeNode[],
  studyDays: { date: string; completed: number; minutes: number }[]
): string[] {
  const anomalies: string[] = [];

  const lowMastery = nodes.filter((n) => n.masteryScore < 30);
  if (lowMastery.length > 0) {
    anomalies.push(
      `知识点掌握度偏低：${lowMastery.map((n) => n.knowledge).join("、")}`
    );
  }

  const highRisk = nodes.filter((n) => n.reviewRisk === "高风险");
  if (highRisk.length > 0) {
    anomalies.push(
      `${highRisk.length} 个节点处于高风险状态，建议优先复习`
    );
  }

  const recentDays = studyDays.slice(-3);
  const lowActivity = recentDays.filter((d) => d.minutes < 30);
  if (lowActivity.length >= 2) {
    anomalies.push("最近学习时长偏短，建议调整计划");
  }

  return anomalies;
}

/** 生成反思 */
export function generateReflection(
  data: SaveData,
  nodes: KnowledgeNode[],
  tasks: Task[],
  studyDays: { date: string; completed: number; minutes: number }[]
): Reflection {
  const anomalies = detectAnomalies(nodes, studyDays);
  const topAnomaly = anomalies[0] || "无异常，持续进步中";

  const reflection: Reflection = {
    id: generateMemoryId(),
    date: new Date().toISOString().slice(0, 10),
    trigger: {
      type: anomalies.length > 0 ? "异常波动" : "定期检查",
      detail: topAnomaly,
    },
    analysis: anomalies.length > 0
      ? `检测到 ${anomalies.length} 个问题：${anomalies.join("；")}`
      : "今日学习状态良好，无异常发现。",
    suggestion: {
      summary: anomalies.length > 0 ? "需要关注低掌握度知识点" : "继续保持",
      detail: anomalies.length > 0
        ? `建议针对 ${nodes.filter((n) => n.masteryScore < 30).map((n) => n.knowledge).join("、")} 增加专项训练`
        : "当前学习策略有效，建议维持。",
      actions: anomalies.length > 0
        ? nodes.filter((n) => n.masteryScore < 30).map((n) => ({
            type: "专项训练" as const,
            target: n.knowledge,
            reason: `掌握度仅 ${n.masteryScore}%`,
          }))
        : [],
    },
    affectedNodes: nodes.filter((n) => n.masteryScore < 30).map((n) => n.id),
    masteryDelta: 0,
    priority: anomalies.length > 2 ? "高" : anomalies.length > 0 ? "中" : "低",
    applied: false,
  };

  return reflection;
}

/** 添加反思 */
export function addReflection(
  data: SaveData,
  reflection: Reflection
): SaveData {
  const engine = getEngineData(data);
  return {
    ...data,
    reflections: [...engine.reflections, reflection],
    memoryEngine: {
      ...engine.memoryEngine,
      lastReflectionAt: new Date().toISOString(),
    },
  };
}

// ════════════════════════════════════════════════════════════
// Phase 6: 全模块共享
// ════════════════════════════════════════════════════════════

/** 获取学习画像 */
export function getProfile(data: SaveData): LearningProfile | null {
  const engine = getEngineData(data);
  return engine.learningProfile;
}

/** 更新学习画像 */
export function updateProfile(
  data: SaveData,
  profile: LearningProfile
): SaveData {
  return {
    ...data,
    learningProfile: profile,
  };
}

/** 获取引擎状态 */
export function getEngineStatus(data: SaveData): MemoryEngineStatus {
  return getEngineData(data).memoryEngine;
}

/** 获取引擎完整数据 */
export function getEngineData(data: SaveData): MemoryEngineData {
  return {
    longTermMemory: (data.longTermMemory ?? []) as MemoryItem[],
    structuredReviews: (data.structuredReviews ?? []) as StructuredReview[],
    masteryHistory: (data.masteryHistory ?? []) as KnowledgeMasteryMap[],
    dailyPortraits: (data.dailyPortraits ?? []) as DailyPortrait[],
    reflections: (data.reflections ?? []) as Reflection[],
    chatLearningEvents: (data.chatLearningEvents ?? []) as never[],
    learningProfile: (data.learningProfile ?? null) as LearningProfile | null,
    memoryEngine: (data.memoryEngine ?? createEmptyMemoryData().memoryEngine) as MemoryEngineStatus,
  };
}