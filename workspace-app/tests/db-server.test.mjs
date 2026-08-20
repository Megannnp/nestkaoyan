/**
 * kaoyan-db（database/server.mjs）单元测试
 * 覆盖：健康检查、PUT → GET 往返、非法请求、方法限制、空库初始态、文件上传/下载/删除、路径穿越防护。
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startWorkspaceDbServer } from "../database/server.mjs";

let service;
let base;

before(async () => {
  // 使用临时目录，避免测试在仓库里留下 data/ 与 files/ 产物
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kaoyan-db-test-"));
  service = await startWorkspaceDbServer({
    port: 0,
    dbPath: path.join(tmpDir, "test.db"),
    host: "127.0.0.1",
  });
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

// ─── 文件接口 ───────────────────────────────────────────

test("PUT 文件后 GET 返回相同二进制", async () => {
  const key = "pdf-1750000000000-ab12cd";
  const payload = new Uint8Array([1, 2, 3, 4, 255, 254, 0]);
  const putRes = await fetch(`${base}/files/${key}`, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: payload,
  });
  assert.equal(putRes.status, 200);
  assert.deepEqual(await putRes.json(), { ok: true });

  const getRes = await fetch(`${base}/files/${key}`);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.headers.get("content-type"), "application/octet-stream");
  const buf = new Uint8Array(await getRes.arrayBuffer());
  assert.deepEqual(buf, payload);
});

test("HEAD 文件存在性", async () => {
  const key = "pdf-1750000000000-ab12cd";
  const headOk = await fetch(`${base}/files/${key}`, { method: "HEAD" });
  assert.equal(headOk.status, 200);
  assert.equal(headOk.headers.get("content-length"), "7");
  const headMiss = await fetch(`${base}/files/missing-key`, { method: "HEAD" });
  assert.equal(headMiss.status, 404);
});

test("DELETE 文件后 GET 404（幂等）", async () => {
  const key = "pdf-1750000000000-delete-me";
  await fetch(`${base}/files/${key}`, { method: "PUT", body: "x" });
  const delRes = await fetch(`${base}/files/${key}`, { method: "DELETE" });
  assert.equal(delRes.status, 200);
  const delAgain = await fetch(`${base}/files/${key}`, { method: "DELETE" });
  assert.equal(delAgain.status, 200);
  const getRes = await fetch(`${base}/files/${key}`);
  assert.equal(getRes.status, 404);
});

test("路径穿越 key → 400", async () => {
  const res = await fetch(`${base}/files/..%2F..%2Fetc%2Fpasswd`, { method: "PUT", body: "x" });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "bad_key");
});

test("非法字符 key → 400", async () => {
  const res = await fetch(`${base}/files/${encodeURIComponent("evil key!@#")}`, { method: "PUT", body: "x" });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "bad_key");
});

test("文本后缀 key（:text）可正常存取", async () => {
  const key = "pdf-1750000000000-ab12cd:text";
  const putRes = await fetch(`${base}/files/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "content-type": "text/plain" },
    body: "纯文本内容",
  });
  assert.equal(putRes.status, 200);
  const getRes = await fetch(`${base}/files/${encodeURIComponent(key)}`);
  assert.equal(getRes.status, 200);
  assert.equal(await getRes.text(), "纯文本内容");
});
