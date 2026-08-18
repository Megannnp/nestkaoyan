/**
 * 2026-08-04 审查修复验证：事件流 key 从误用 `nest-exam-workspace-v4` 迁移到
 * `nest-exam-learning-events-v4` 的兼容逻辑。
 *
 * 核心断言：
 *  1. 新 key 为空时，从旧误用 key 一次性迁移合法事件（不丢失）
 *  2. 旧 key 中的非事件结构（Memory Engine 字段）不迁移，不干扰
 *  3. 旧误用 key 中无 learningEvents → 返回空数组（不迁移）
 *  4. 旧误用 key 中 eventSchemaVersion 高于当前 → 拒绝读取（保护未来数据）
 *  5. 新 key 已有数据时，不重复迁移（优先新 key）
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loadLearningEvents, appendLearningEvent, LEARNING_EVENT_VERSION } from "../app/lib/events.ts";

// ─── 最小 localStorage mock（Node 环境无 window）───
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.has(key) ? store.get(key)! : null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
};
(globalThis as Record<string, unknown>).window = { localStorage: mockLocalStorage };

const NEW_KEY = "nest-exam-learning-events-v4";
const LEGACY_KEY = "nest-exam-workspace-v4";

function makeLegacyEvent(id: string, type: string) {
  return {
    id,
    type,
    occurredAt: "2026-08-01T00:00:00.000Z",
    sourceRef: { kind: "task", id: "t-1" },
    payload: { minutes: 30 },
  };
}

beforeEach(() => {
  store.clear();
});

test("① 新 key 为空 + 旧 key 有合法事件 → 迁移到新 key 并返回", () => {
  store.set(LEGACY_KEY, JSON.stringify({
    eventSchemaVersion: 1,
    learningEvents: [makeLegacyEvent("evt-1", "study_completed")],
  }));
  const events = loadLearningEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].id, "evt-1");
  assert.equal(events[0].version, LEARNING_EVENT_VERSION); // 缺 version → 提升为 v1
  // 迁移后新 key 已写入
  assert.ok(store.get(NEW_KEY)?.includes("evt-1"));
});

test("② 新 key 为空 + 旧 key 无 learningEvents（Memory 字段）→ 不迁移返回空", () => {
  store.set(LEGACY_KEY, JSON.stringify({
    dataVersion: 4,
    longTermMemory: [{ id: "mem-1" }],
  }));
  assert.deepEqual(loadLearningEvents(), []);
  assert.equal(store.get(NEW_KEY), undefined); // 不写入新 key
});

test("③ 新 key 为空 + 旧 key 损坏 JSON → 返回空（不抛错）", () => {
  store.set(LEGACY_KEY, "{ not valid json");
  assert.deepEqual(loadLearningEvents(), []);
});

test("④ 新 key 为空 + 旧 key eventSchemaVersion 高于当前 → 拒绝读取返回空", () => {
  store.set(LEGACY_KEY, JSON.stringify({
    eventSchemaVersion: 99,
    learningEvents: [makeLegacyEvent("evt-future", "study_completed")],
  }));
  assert.deepEqual(loadLearningEvents(), []);
  assert.equal(store.get(NEW_KEY), undefined); // 不采纳未来数据
});

test("⑤ 新 key 已有数据 → 不重复迁移，优先新 key", () => {
  store.set(LEGACY_KEY, JSON.stringify({
    eventSchemaVersion: 1,
    learningEvents: [makeLegacyEvent("evt-legacy", "study_completed")],
  }));
  store.set(NEW_KEY, JSON.stringify({
    eventSchemaVersion: 1,
    learningEvents: [makeLegacyEvent("evt-new", "card_reviewed")],
  }));
  const events = loadLearningEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].id, "evt-new"); // 优先新 key
});

test("⑥ 迁移后 appendLearningEvent 写入新 key（旧 key 不受影响）", () => {
  store.set(LEGACY_KEY, JSON.stringify({
    eventSchemaVersion: 1,
    learningEvents: [makeLegacyEvent("evt-legacy", "study_completed")],
  }));
  const migrated = loadLearningEvents();
  const next = appendLearningEvent(migrated, {
    type: "card_reviewed",
    sourceRef: { kind: "card", id: "c-1" },
    payload: { mastery: "认识", intervalDays: 7 },
  });
  assert.equal(next.length, 2);
  const newRaw = store.get(NEW_KEY)!;
  assert.ok(newRaw.includes("evt-legacy") && newRaw.includes("card_reviewed"));
  // 旧 key 原样保留（不删除可回滚）
  assert.ok(store.get(LEGACY_KEY)?.includes("evt-legacy"));
});