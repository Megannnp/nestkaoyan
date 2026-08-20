/**
 * 多设备新鲜度判定（storage.ts isServerNewerThanLocal）单元测试
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isServerNewerThanLocal } from "../app/lib/storage.ts";

test("服务端明显更新（跨设备，>90s）→ true", () => {
  const local = "2026-08-20T10:00:00.000Z";
  const server = "2026-08-20 10:05:00"; // UTC，比本地晚 5 分钟
  assert.equal(isServerNewerThanLocal(local, server), true);
});

test("服务端仅略新（同设备自更新，<90s）→ false", () => {
  const local = "2026-08-20T10:00:00.000Z";
  const server = "2026-08-20 10:00:30"; // 晚 30s（PUT 镜像回写，不误报）
  assert.equal(isServerNewerThanLocal(local, server), false);
});

test("服务端更旧 → false", () => {
  const local = "2026-08-20T10:00:00.000Z";
  const server = "2026-08-20 09:00:00";
  assert.equal(isServerNewerThanLocal(local, server), false);
});

test("恰好等于容差边界 → false（> 而非 >=）", () => {
  const local = "2026-08-20T10:00:00.000Z";
  const server = "2026-08-20 10:01:30"; // 恰好 90s
  assert.equal(isServerNewerThanLocal(local, server), false);
});

test("非法时间 → false（不误报）", () => {
  assert.equal(isServerNewerThanLocal("not-a-date", "2026-08-20 10:00:00"), false);
  assert.equal(isServerNewerThanLocal("2026-08-20T10:00:00.000Z", "garbage"), false);
});

test("自定义容差生效", () => {
  const local = "2026-08-20T10:00:00.000Z";
  const server = "2026-08-20 10:00:30";
  assert.equal(isServerNewerThanLocal(local, server, 10_000), true); // 30s > 10s
  assert.equal(isServerNewerThanLocal(local, server, 60_000), false); // 30s < 60s
});
