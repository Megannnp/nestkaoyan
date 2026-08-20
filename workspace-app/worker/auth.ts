/**
 * 认证工具（私有部署版）—— 参考 NestLife 的 NESTLIFE_AUTH 方案
 * 启用：KAOYAN_AUTH=1 + KAOYAN_PASSWORD=xxx
 * 方案：无状态 session token = SHA-256(固定盐 + 密码)，登录后写入 httpOnly cookie，
 *       数据接口校验。本机访问（localhost/127.0.0.1）免登录；局域网/其他设备必须登录。
 */

const SESSION_SALT = "kaoyan-session-v1";
const SESSION_COOKIE = "kaoyan_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

/** 无状态 token（登录时发放 / 校验时重算） */
export async function sessionTokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${SESSION_SALT}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 常量时间字符串比较（防时序侧信道） */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_MAX_AGE_SEC = SESSION_MAX_AGE;

/** 读取 Cookie header 中指定 cookie 的值 */
export function readCookie(header: string | null, name: string): string {
  if (!header) return "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=") || "";
  }
  return "";
}

/** auth 配置（兼容 env 绑定与 process.env 两种来源；env 可能为 undefined，如 vinext 本地服务器） */
export function authConfig(env: Record<string, unknown> | undefined): { enabled: boolean; password: string } {
  const e = env ?? {};
  const bind = (key: string): string => {
    const fromEnv = e[key];
    if (typeof fromEnv === "string" && fromEnv) return fromEnv;
    if (typeof process !== "undefined" && process.env?.[key]) return process.env[key] as string;
    return "";
  };
  return { enabled: bind("KAOYAN_AUTH") === "1", password: bind("KAOYAN_PASSWORD") };
}

/** 校验请求是否携带有效会话 */
export async function isSessionValid(req: Request, password: string): Promise<boolean> {
  if (!password) return false;
  const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return false;
  const expected = await sessionTokenFor(password);
  return safeEqual(token, expected);
}

/** 真实来源 IP（反向代理优先 x-real-ip；x-forwarded-for 仅后备，由全局限流兜底） */
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** 请求是否来自本机（免登录） */
export function isLocalRequest(req: Request): boolean {
  const host = (req.headers.get("host") || "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1";
}

/** ═══ 登录限流（防暴力破解，内存实现，重启重置） ═══ */

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;
const MAX_GLOBAL_FAILURES = 30;
const GLOBAL_WINDOW_MS = 10 * 60 * 1000;

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
let globalFailures: { count: number; windowStart: number } = { count: 0, windowStart: Date.now() };

export function checkLoginLock(ip: string): { locked: boolean; retryAfterSec?: number } {
  const rec = loginAttempts.get(ip);
  if (!rec) return { locked: false };
  if (rec.lockedUntil > Date.now()) {
    return { locked: true, retryAfterSec: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
  }
  if (rec.lockedUntil > 0 && rec.lockedUntil <= Date.now()) loginAttempts.delete(ip);
  return { locked: false };
}

export function recordLoginFailure(ip: string) {
  const rec = loginAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= MAX_LOGIN_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCK_MS;
    rec.count = 0;
  }
  loginAttempts.set(ip, rec);
}

export function clearLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}

export function checkGlobalLoginLock(): { locked: boolean; retryAfterSec?: number } {
  const now = Date.now();
  if (now - globalFailures.windowStart > GLOBAL_WINDOW_MS) {
    globalFailures = { count: 0, windowStart: now };
  }
  if (globalFailures.count >= MAX_GLOBAL_FAILURES) {
    return { locked: true, retryAfterSec: Math.ceil((GLOBAL_WINDOW_MS - (now - globalFailures.windowStart)) / 1000) };
  }
  return { locked: false };
}

export function recordGlobalLoginFailure() {
  const now = Date.now();
  if (now - globalFailures.windowStart > GLOBAL_WINDOW_MS) globalFailures = { count: 0, windowStart: now };
  globalFailures.count += 1;
}
