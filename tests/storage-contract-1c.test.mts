/**
 * Stabilization 1C-2: Storage Contract 迁移 / 回滚演练
 *
 * 依据 docs/STORAGE_CONTRACT.md §6（1C-2）验证：
 *   ① 模拟 v3+v4 共存现场 → 迁移 → 校验 storageVersion=5
 *   ② 回滚演练：删除新 key 后重跑迁移仍成功
 *   ③ 迁移后 v3/v4 原样保留（可回滚）
 *   ④ v4 Memory 字段补充不覆盖 v3 同名业务字段
 *   ⑤ 只读保护：版本高于当前 → 拒绝读取（不降级覆盖）
 *   ⑥ 损坏现场：v5 损坏 → 备份 corrupt_backup；不清除原 key
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_VERSION,
  WORKSPACE_KEY,
  LEGACY_KEY_V3,
  LEGACY_KEY_V4,
  CORRUPT_BACKUP_KEY,
  hydrateWorkspace,
  saveWorkspace,
} from "../app/lib/storage.ts";

// ─── 最小 localStorage mock（Node 环境无 window）───
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.has(key) ? store.get(key)! : null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
};
// storage.ts 在函数内部访问 window.localStorage，注入最低可用 mock
type MinimalWindow = { localStorage: typeof mockLocalStorage };
(globalThis as Record<string, unknown>).window = { localStorage: mockLocalStorage } satisfies MinimalWindow;

const v3sample = {
  exam: { examName: "验收测试考试" },
  subjects: [{ id: "s1", name: "828 物理化学" }],
  tasks: [{ id: "t1", done: true }],
  resources: [{ id: "r1", name: "傅献彩" }],
};

const v4sample = {
  dataVersion: 4,
  longTermMemory: [{ id: "mem-1", content: "化学势知识点" }],
  structuredReviews: [{ id: "sr-1", date: "2026-07-31" }],
  // 与 v3 同名字段（不应覆盖 v3）
  exam: { examName: "不应被采纳的 v4 exam" },
};

beforeEach(() => {
  store.clear();
  // 恢复默认 mock window
  (globalThis as Record<string, unknown>).window = { localStorage: mockLocalStorage } satisfies MinimalWindow;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

test("① 模拟 v3+v4 共存现场 → 迁移 → 校验 storageVersion=5 与业务基座", () => {
  store.set(LEGACY_KEY_V3, JSON.stringify(v3sample));
  store.set(LEGACY_KEY_V4, JSON.stringify(v4sample));

  const result = hydrateWorkspace();

  assert.ok(result, "迁移后应返回数据");
  assert.equal(result.storageVersion, STORAGE_VERSION, "storageVersion 应为 5");
  // 业务基座来自 v3（不被 v4 覆盖）
  assert.equal(result.exam.examName, "验收测试考试", "exam 应来自 v3 而非 v4");
  assert.equal(result.subjects?.[0]?.name, "828 物理化学");
  assert.ok(Array.isArray(result.tasks));
  // v4 字段补充
  assert.ok(Array.isArray(result.longTermMemory), "v4 Memory 字段应被补充");
  assert.equal(result.longTermMemory?.[0]?.content, "化学势知识点");
  assert.ok(Array.isArray(result.structuredReviews), "v4 structuredReviews 应被补充");
});

test("② 回滚演练：删除新 key 后重跑迁移仍成功", () => {
  // 首次迁移
  store.set(LEGACY_KEY_V3, JSON.stringify(v3sample));
  const first = hydrateWorkspace();
  assert.equal(first?.storageVersion, STORAGE_VERSION);
  assert.ok(store.has(WORKSPACE_KEY), "首次迁移后应写入 v5 key");

  // 模拟回滚：删除新 key，保留旧 key
  store.delete(WORKSPACE_KEY);

  const second = hydrateWorkspace();
  assert.ok(second, "删除新 key 后重跑迁移应仍成功");
  assert.equal(second.storageVersion, STORAGE_VERSION);
  assert.equal(second.exam.examName, "验收测试考试", "回滚重建后业务数据一致");
});

test("③ 迁移后 v3/v4 原样保留（可回滚）", () => {
  store.set(LEGACY_KEY_V3, JSON.stringify(v3sample));
  store.set(LEGACY_KEY_V4, JSON.stringify(v4sample));

  hydrateWorkspace();

  // v3 原样保留（仅附加 __migratedAt 只读标记,业务字段不删）
  const v3After = JSON.parse(store.get(LEGACY_KEY_V3)!);
  assert.equal(v3After.exam.examName, "验收测试考试", "v3 业务字段保留");
  assert.equal(v3After.subjects?.[0]?.name, "828 物理化学");
  assert.ok(typeof v3After.__migratedAt === "string", "v3 应留下 __migratedAt 只读标记");

  // v4 原样保留
  const v4After = JSON.parse(store.get(LEGACY_KEY_V4)!);
  assert.equal(v4After.longTermMemory?.[0]?.content, "化学势知识点", "v4 Memory 字段保留");
  assert.ok(typeof v4After.__migratedAt === "string");
});

test("④ 已存在 v5 时不重复迁移（幂等）", () => {
  // 直接写入 v5（模拟已完成迁移状态）
  store.set(WORKSPACE_KEY, JSON.stringify({ storageVersion: STORAGE_VERSION, exam: { examName: "直接写入" } }));

  // 同时存在旧 key（不应触发重复迁移,直接使用 v5）
  store.set(LEGACY_KEY_V3, JSON.stringify(v3sample));

  const result = hydrateWorkspace();
  assert.equal(result?.exam.examName, "直接写入", "应直接使用 v5,不重复迁移");
});

test("⑤ 只读保护：版本高于当前 → 拒绝读取", () => {
  store.set(WORKSPACE_KEY, JSON.stringify({ storageVersion: STORAGE_VERSION + 1, exam: { examName: "未来版本" } }));

  const result = hydrateWorkspace();
  assert.equal(result, null, "高于当前版本应拒绝读取,避免降级覆盖");
  // 原 key 不被清除
  assert.ok(store.has(WORKSPACE_KEY), "只读保护不清除原 key");
});

test("⑥ v5 损坏现场 → 备份 corrupt_backup,返回空态,不清除原 key", () => {
  const corruptRaw = "{ 这不是有效 JSON";
  store.set(WORKSPACE_KEY, corruptRaw);

  const result = hydrateWorkspace();
  assert.equal(result, null, "损坏时返回空态");
  // 原始串已备份
  assert.equal(store.get(CORRUPT_BACKUP_KEY), corruptRaw, "损坏原始串应备份到 corrupt_backup");
  // 原 key 保留（不清除）,确保可人工恢复
  assert.ok(store.has(WORKSPACE_KEY));
});

test("⑦ saveWorkspace 写入 v5 并携带 storageVersion", () => {
  const ok = saveWorkspace({ exam: { examName: "保存测试" }, subjects: [] });
  assert.equal(ok, true);
  const saved = JSON.parse(store.get(WORKSPACE_KEY)!);
  assert.equal(saved.storageVersion, STORAGE_VERSION);
  assert.equal(saved.exam.examName, "保存测试");
});

test("⑧ saveWorkspace 写失败 → 返回 false（不覆盖已有数据）", () => {
  // 模拟配额满:setItem 抛异常
  const throwStore = new Map<string, string>();
  const throwingStorage = {
    getItem: (key: string) => throwStore.has(key) ? throwStore.get(key)! : null,
    setItem: () => { throw new Error("QuotaExceededError"); },
    removeItem: (key: string) => { throwStore.delete(key); },
  };
  (globalThis as Record<string, unknown>).window = { localStorage: throwingStorage } as MinimalWindow;

  const ok = saveWorkspace({ exam: { examName: "不应写入" } });
  assert.equal(ok, false, "写失败应返回 false");
});

test("⑨ saveWorkspace 版本守卫：磁盘为更高版本 → 拒写（与读侧对称，防降级覆盖）", () => {
  // 模拟未来版本 v6 数据已存在
  const futureData = { storageVersion: STORAGE_VERSION + 1, exam: { examName: "未来版本数据" }, onboardingCompleted: true };
  store.set(WORKSPACE_KEY, JSON.stringify(futureData));

  // 旧构建尝试自动保存 v5 → 应被拒写
  const ok = saveWorkspace({ exam: { examName: "旧构建不应覆盖" }, onboardingCompleted: false });
  assert.equal(ok, false, "磁盘版本高于当前时应拒写");

  // 未来版本数据原样保留（未被降级覆盖）
  const after = JSON.parse(store.get(WORKSPACE_KEY)!);
  assert.equal(after.storageVersion, STORAGE_VERSION + 1, "未来版本号应保留");
  assert.equal(after.exam.examName, "未来版本数据", "业务数据应保留");
  assert.equal(after.onboardingCompleted, true, "onboardingCompleted 不应被旧构建重置为 false");
});

test("⑩ saveWorkspace 版本守卫：磁盘 v5 损坏 → 允许覆盖重建（不因损坏误拒写）", () => {
  // v5 key 存在但 JSON 损坏（hydrate 会备份；save 不应因此拒写否则用户无法恢复）
  store.set(WORKSPACE_KEY, "{ 这不是有效 JSON");

  const ok = saveWorkspace({ exam: { examName: "重建数据" } });
  assert.equal(ok, true, "损坏现场不应拒写（允许覆盖重建）");
  const after = JSON.parse(store.get(WORKSPACE_KEY)!);
  assert.equal(after.storageVersion, STORAGE_VERSION);
  assert.equal(after.exam.examName, "重建数据");
});
