import type { StudyDay } from "./types";

const STORAGE_KEY = "nest-exam-workspace-v3";
const SAVE_DEBOUNCE_MS = 500;
const DATA_VERSION = 1;

type SaveData = Record<string, unknown>;

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * localStorage 操作封装层
 * - 统一读写入口
 * - 防抖保存
 * - 数据版本迁移
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

/**
 * 数据版本迁移
 * 当前版本 v1: 初始版本，无迁移逻辑
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