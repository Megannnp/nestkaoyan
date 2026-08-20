/**
 * kaoyan-db（database/server.mjs）单元测试
 * 覆盖：健康检查、PUT → GET 往返、非法请求、方法限制、空库初始态。
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startWorkspaceDbServer } from "../database/server.mjs";

let service;
let base;

before(async () => {
  service = await startWorkspaceDbServer({ port: 0, dbPath: ":memory:", host: "127.0.0.1" });
  base = `http://127.0.0.1:${service.server.address().port}`;
});

after(async () => {
  if (service) await service.close();
});

test("健康检查返回 ok", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("空库时 GET 返回 snapshot: null", async () => {
  const res = await fetch(`${base}/workspace`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.snapshot, null);
});

test("PUT 后 GET 返回同一快照", async () => {
  const snapshot = {
    storageVersion: 6,
    exam: { examDate: "2026-12-20", examGoalCreatedAt: "2026-08-01" },
    subjects: [{ id: "s1", name: "政治" }],
    tasks: [],
  };
  const putRes = await fetch(`${base}/workspace`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(snapshot),
  });
  assert.equal(putRes.status, 200);
  assert.deepEqual(await putRes.json(), { ok: true });

  const getRes = await fetch(`${base}/workspace`);
  const body = await getRes.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.snapshot, snapshot);
  assert.equal(body.storageVersion, 6);
  assert.ok(body.updatedAt);
});

test("再次 PUT 覆盖旧快照", async () => {
  const newer = { storageVersion: 6, exam: { examDate: "2027-01-01" }, subjects: [] };
  const putRes = await fetch(`${base}/workspace`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(newer),
  });
  assert.equal(putRes.status, 200);
  const body = await (await fetch(`${base}/workspace`)).json();
  assert.deepEqual(body.snapshot, newer);
});

test("非法 JSON → 400", async () => {
  const res = await fetch(`${base}/workspace`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: "not-json{{{",
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "bad_json");
});

test("数组负载 → 400", async () => {
  const res = await fetch(`${base}/workspace`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify([1, 2, 3]),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "bad_request");
});

test("未支持的路径 → 404", async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
});

test("DELETE → 405", async () => {
  const res = await fetch(`${base}/workspace`, { method: "DELETE" });
  assert.equal(res.status, 405);
  const body = await res.json();
  assert.equal(body.error, "method_not_allowed");
});
