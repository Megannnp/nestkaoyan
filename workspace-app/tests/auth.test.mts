/**
 * 认证模块（worker/auth.ts）单元测试
 * 覆盖：session token、常量时间比较、Cookie 解析、authConfig、本机判断、登录限流。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sessionTokenFor,
  safeEqual,
  readCookie,
  authConfig,
  isLocalRequest,
  checkLoginLock,
  recordLoginFailure,
  clearLoginFailures,
} from "../worker/auth.ts";

test("sessionTokenFor：确定性 + 不同密码不同 token", async () => {
  const t1 = await sessionTokenFor("abc");
  const t2 = await sessionTokenFor("abc");
  const t3 = await sessionTokenFor("abd");
  assert.equal(t1, t2);
  assert.notEqual(t1, t3);
  assert.equal(t1.length, 64); // SHA-256 hex
});

test("safeEqual：常量时间比较", () => {
  assert.equal(safeEqual("same-token", "same-token"), true);
  assert.equal(safeEqual("same-token", "different"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual("", ""), true);
});

test("readCookie：解析 Cookie header", () => {
  const header = "a=1; kaoyan_session=TOKEN123; b=2";
  assert.equal(readCookie(header, "kaoyan_session"), "TOKEN123");
  assert.equal(readCookie(header, "missing"), "");
  assert.equal(readCookie(null, "kaoyan_session"), "");
  assert.equal(readCookie("kaoyan_session=", "kaoyan_session"), "");
});

test("authConfig：读取 env 绑定与默认关闭", () => {
  const enabled = authConfig({ KAOYAN_AUTH: "1", KAOYAN_PASSWORD: "pw" });
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.password, "pw");
  const disabled = authConfig({});
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.password, "");
});

test("isLocalRequest：本机免登录判断", () => {
  assert.equal(
    isLocalRequest(new Request("http://localhost:3000/x", { headers: { host: "localhost:3000" } })),
    true,
  );
  assert.equal(
    isLocalRequest(new Request("http://127.0.0.1:3000/x", { headers: { host: "127.0.0.1:3000" } })),
    true,
  );
  assert.equal(
    isLocalRequest(new Request("http://192.168.1.5:3000/x", { headers: { host: "192.168.1.5:3000" } })),
    false,
  );
});

test("登录限流：连续失败 5 次后锁定 10 分钟", () => {
  const ip = "10.0.0.9";
  clearLoginFailures(ip);
  assert.equal(checkLoginLock(ip).locked, false);
  for (let i = 0; i < 5; i++) recordLoginFailure(ip);
  const lock = checkLoginLock(ip);
  assert.equal(lock.locked, true);
  assert.ok(lock.retryAfterSec && lock.retryAfterSec > 0);
});
