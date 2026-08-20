/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleAnalyzeExam } from "./analyze-exam";
import { handleAnalyzeMistakes } from "./analyze-mistakes";
import { handlePlanGenerate } from "./plan-generate";
import { handleChatComplete } from "./chat-complete";
import { handleWorkspace, handleAiKey } from "./workspace";
import { handleFiles } from "./files";
import {
  authConfig, isLocalRequest, isSessionValid, sessionTokenFor,
  SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC, checkLoginLock, recordLoginFailure,
  clearLoginFailures, checkGlobalLoginLock, recordGlobalLoginFailure, clientIp,
} from "./auth";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  /** 本地 SQLite 同步服务地址（Docker 部署：http://kaoyan-db:3001；也可经 process.env 注入） */
  WORKSPACE_DB_URL?: string;
  /** 访问密码开关（KAOYAN_AUTH=1 启用；本机访问免登录，局域网/其他设备需密码） */
  KAOYAN_AUTH?: string;
  /** 访问密码（安装脚本/Docker 自动生成并保存到 data/password.txt） */
  KAOYAN_PASSWORD?: string;
  /** DeepSeek 真题分析密钥（服务端 secret / 本地 .dev.vars；绝不下发前端） */
  DEEPSEEK_API_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function handleLogin(request: Request, password: string, enabled: boolean): Promise<Response> {
  if (!enabled) return json({ ok: true, authEnabled: false });

  const ip = clientIp(request);
  const globalLock = checkGlobalLoginLock();
  if (globalLock.locked) {
    return json({ error: `尝试过于频繁，请 ${globalLock.retryAfterSec} 秒后再试` }, 429);
  }
  const lock = checkLoginLock(ip);
  if (lock.locked) {
    return json({ error: `尝试过于频繁，请 ${lock.retryAfterSec} 秒后再试` }, 429);
  }

  const body = await request.json().catch(() => null) as { password?: string } | null;
  const input = String(body?.password ?? "");
  if (!password || !input || input !== password) {
    recordLoginFailure(ip);
    recordGlobalLoginFailure();
    return json({ error: "密码错误" }, 401);
  }
  clearLoginFailures(ip);

  const token = await sessionTokenFor(password);
  const res = json({ ok: true, authEnabled: true });
  res.headers.set(
    "set-cookie",
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SEC}`,
  );
  return res;
}

function handleLogout(): Response {
  const res = json({ ok: true });
  res.headers.set("set-cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}

async function handleStatus(request: Request, password: string, enabled: boolean): Promise<Response> {
  if (!enabled) return json({ ok: true, authEnabled: false });
  const local = isLocalRequest(request);
  const authorized = local || (await isSessionValid(request, password));
  return json({ ok: true, authEnabled: true, authorized, isLocalhost: local });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const auth = authConfig(env as unknown as Record<string, unknown> | undefined);

    // ── 认证接口（免登录）────────────────────────────
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      return handleLogin(request, auth.password, auth.enabled);
    }
    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      return handleLogout();
    }
    if (url.pathname === "/api/auth/status") {
      return handleStatus(request, auth.password, auth.enabled);
    }

    // ── 启用认证时保护所有 /api/*（本机访问免登录）──
    if (auth.enabled && url.pathname.startsWith("/api/")) {
      const local = isLocalRequest(request);
      if (!local && !(await isSessionValid(request, auth.password))) {
        return json({ error: "unauthorized" }, 401);
      }
    }

    // 真题分析 API（首个真 AI 意图）——key 只在服务端使用
    if (url.pathname === "/api/analyze-exam" && request.method === "POST") {
      return handleAnalyzeExam(request, env);
    }

    if (url.pathname === "/api/analyze-mistakes" && request.method === "POST") {
      return handleAnalyzeMistakes(request, env);
    }

    if (url.pathname === "/api/plan-generate" && request.method === "POST") {
      return handlePlanGenerate(request, env);
    }

    if (url.pathname === "/api/chat-complete" && request.method === "POST") {
      return handleChatComplete(request, env);
    }

    if (url.pathname === "/api/workspace") {
      return handleWorkspace(request, env);
    }

    if (url.pathname === "/api/ai-key") {
      return handleAiKey(request, env);
    }

    if (url.pathname.startsWith("/api/files/")) {
      return handleFiles(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

