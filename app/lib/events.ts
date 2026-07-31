/**
 * LearningEvent — 学习事件（Sprint 1 / Phase A）
 *
 * 追加式（append-only）事实流，是 Memory Engine 的唯一真相源。
 * Sprint 1 只采集三种事件：
 *   - study_completed     学习/任务完成（Dashboard Completion）
 *   - card_reviewed       成长卡片复习（Cards Review）
 *   - question_answered   做题结果（Questions Result）
 *
 * 设计约束：
 *   - 不投影 KnowledgeState / ReviewSchedule（Sprint 2+ 再做）
 *   - UI 继续读旧状态（tasks/cards/questions），本模块是纯副作用
 *   - 不删除、不修改现有 v3 逻辑
 *   - 独立 v4 key：nest-exam-workspace-v4
 *
 * 版本策略（2026-07-31 反馈新增）：
 *   - 每条事件携带 `version`（当前 1），payload 结构演进时通过版本号识别代际
 *   - 存储顶层携带 `eventSchemaVersion`（当前 1），未来 schema 迁移可平滑升级
 *   - 读取时遇到 `eventSchemaVersion > 当前版本` 一律拒绝（保护未来数据不被低版本覆盖）
 *   - 读取时对缺 `version` 的旧事件自动提升为 v1（兼容 Sprint 1 上线初期的写入）
 */

import type { GrowthCard } from "./types.ts";

// ════════════════════════════════════════════════════════════
// 版本常量
// ════════════════════════════════════════════════════════════

/** 单条事件结构版本 */
export const LEARNING_EVENT_VERSION = 1;
/** 存储 schema 版本 */
export const EVENT_SCHEMA_VERSION = 1;

// ════════════════════════════════════════════════════════════
// 类型定义
// ════════════════════════════════════════════════════════════

export type LearningEventType =
  | "study_completed"
  | "card_reviewed"
  | "question_answered";

export type LearningEvent = {
  id: string;
  /** 事件结构版本（当前 1）。payload 结构变更时 +1，Replay 据此选择解析器 */
  version: number;
  type: LearningEventType;
  /** ISO 时间戳（写入时刻） */
  occurredAt: string;
  /** 来源引用：触发本事件的业务对象 */
  sourceRef: {
    kind: "task" | "card" | "question";
    id: string;
    /** 科目标识（当前系统中科目以 name 为业务标识，此处存 name） */
    subjectId?: string;
    /** 关联知识点 id（可空，供后续 Sprint 投影消费） */
    nodeIds?: string[];
  };
  /** 事件载荷：按 type 归一化的最小事实集，禁止存派生 UI 状态 */
  payload: {
    // study_completed
    minutes?: number;
    accuracy?: number; // 0-100
    masteryBefore?: number;
    masteryAfter?: number;
    // card_reviewed
    mastery?: GrowthCard["mastery"];
    intervalDays?: number;
    // question_answered
    result?: "正确" | "错误" | "未做";
    errorReason?: string;
  };
};

/** 兼容：Sprint 1 上线初期写入的事件可能缺 version 字段 */
type LegacyEvent = Omit<LearningEvent, "version">;
type StoredEvent = LearningEvent | LegacyEvent;

/** v4 key 下的存储结构（顶层带 eventSchemaVersion） */
type StoredEngineData = {
  eventSchemaVersion?: number;
  learningEvents?: StoredEvent[];
};

// ════════════════════════════════════════════════════════════
// ID 与工厂（时间可注入，保持可测试性 / 幂等投影基础）
// ════════════════════════════════════════════════════════════

let _eventSeq = 0;

export function createLearningEventId(now = Date.now()): string {
  _eventSeq += 1;
  return `evt-${now}-${_eventSeq}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 将旧事件（缺 version）提升为当前版本；已带版本的事件原样返回 */
function normalizeEvent(e: StoredEvent): LearningEvent {
  if ("version" in e && typeof e.version === "number") {
    return e as LearningEvent;
  }
  return { ...e, version: LEARNING_EVENT_VERSION };
}

/** 创建完整事件（出厂函数；occurredAt 默认当前时刻，可注入用于测试） */
export function createLearningEvent(
  input: Omit<LearningEvent, "id" | "occurredAt" | "version">,
  occurredAt = new Date().toISOString()
): LearningEvent {
  return {
    ...input,
    id: createLearningEventId(),
    version: LEARNING_EVENT_VERSION,
    occurredAt,
  };
}

// ════════════════════════════════════════════════════════════
// v4 独立存储（与 v3 业务数据完全隔离）
// ════════════════════════════════════════════════════════════

const ENGINE_KEY = "nest-exam-workspace-v4";

/**
 * 读取全部学习事件（无数据 / 解析失败时返回空数组）。
 * 兼容策略：
 *   - eventSchemaVersion 缺失 → 视为 v1
 *   - eventSchemaVersion > 当前版本 → 拒绝读取（保护未来数据，返回空数组）
 *   - 事件缺 version → 提升为 v1
 */
export function loadLearningEvents(): LearningEvent[] {
  try {
    const raw = window.localStorage.getItem(ENGINE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as StoredEngineData;
    if (
      typeof data.eventSchemaVersion === "number" &&
      data.eventSchemaVersion > EVENT_SCHEMA_VERSION
    ) {
      // 未来版本数据：当前应用无法安全解析，返回空并保留原始存储
      return [];
    }
    if (!Array.isArray(data.learningEvents)) return [];
    return data.learningEvents.map(normalizeEvent);
  } catch {
    return [];
  }
}

/**
 * 追加事件并同步持久化到 v4。
 * 事件追加是低频用户操作（点击），同步写避免防抖丢失；同时保留 v4 中未来字段。
 * 防御：若存储中已存在更高 eventSchemaVersion，拒绝写入（避免低版本覆盖高版本）。
 */
export function appendLearningEvent(
  events: LearningEvent[],
  input: Omit<LearningEvent, "id" | "occurredAt" | "version">
): LearningEvent[] {
  try {
    const raw = window.localStorage.getItem(ENGINE_KEY);
    if (raw) {
      const existing = JSON.parse(raw) as StoredEngineData;
      if (
        typeof existing.eventSchemaVersion === "number" &&
        existing.eventSchemaVersion > EVENT_SCHEMA_VERSION
      ) {
        return events; // 不写入，保护未来数据
      }
    }
  } catch {
    // 解析失败视为无存储，继续写入
  }
  const next = [...events.map(normalizeEvent), createLearningEvent(input)];
  persistEngineData({
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    learningEvents: next,
  });
  return next;
}

function persistEngineData(patch: Record<string, unknown>): void {
  try {
    const raw = window.localStorage.getItem(ENGINE_KEY);
    let current: Record<string, unknown> = {};
    if (raw) {
      try {
        current = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        current = {};
      }
    }
    window.localStorage.setItem(
      ENGINE_KEY,
      JSON.stringify({ ...current, ...patch })
    );
  } catch {
    // localStorage 不可用 / 写满时静默失败（与现有 storage.ts 行为一致）
  }
}