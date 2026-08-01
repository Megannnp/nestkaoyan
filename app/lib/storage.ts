"use client";

/**
 * Storage Contract（Stabilization 1C-1 实现）
 *
 * 依据 docs/STORAGE_CONTRACT.md 设计：
 *   - 单一 workspace key：`nest-exam-workspace-v5`，内部携带 storageVersion=5
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
export const STORAGE_VERSION = 5;
/** 唯一 workspace key（v5 新契约） */
export const WORKSPACE_KEY = "nest-exam-workspace-v5";
/** 旧 v3 业务数据 key（迁移源） */
export const LEGACY_KEY_V3 = "nest-exam-workspace-v3";
/** 旧 v4 数据 key（迁移源：Memory Engine 字段） */
export const LEGACY_KEY_V4 = "nest-exam-workspace-v4";
/** 损坏原始串备份 key（hydrate 失败时保留现场） */
export const CORRUPT_BACKUP_KEY = "nest-exam-workspace-v5.corrupt_backup";
/** v3/v4 迁移后留下的时间戳标记 key */
const MIGRATED_AT_KEY = "__migratedAt";

export type WorkspaceSnapshot = {
  storageVersion?: number;
  /** 业务字段任意类型（与 JSON.parse 行为一致，由调用方按已知结构访问） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

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
  };
  return writeRaw(WORKSPACE_KEY, withVersion);
}
