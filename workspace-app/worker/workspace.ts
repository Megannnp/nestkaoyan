interface WorkspaceEnv {
  DB?: D1Database;
  /** 本地 SQLite 同步服务地址（Docker 部署时指向 kaoyan-db 容器，如 http://kaoyan-db:3001） */
  WORKSPACE_DB_URL?: string;
}

const SNAPSHOT_ID = "default";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** 兼容容器/宿主通过进程环境传入（nodejs_compat 下 process.env 可用） */
function workspaceDbUrl(env: WorkspaceEnv): string | undefined {
  if (env.WORKSPACE_DB_URL) return env.WORKSPACE_DB_URL;
  if (typeof process !== "undefined" && process.env?.WORKSPACE_DB_URL) return process.env.WORKSPACE_DB_URL;
  return undefined;
}

/** 本地 SQLite 同步模式：把 /api/workspace 请求代理到 sidecar 服务（去掉 /api 前缀） */
async function proxyToSqlite(request: Request, baseUrl: string): Promise<Response> {
  const url = new URL(request.url);
  // /api/workspace → /workspace（与 sidecar 路由一致）
  const target = new URL(url.pathname.replace(/^\/api/, "") + url.search, baseUrl);
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  const init: RequestInit = { method: request.method, headers, redirect: "follow" };
  if (request.method === "PUT") {
    init.body = await request.text();
  }
  try {
    const upstream = await fetch(target.toString(), init);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    // sidecar 未就绪/不可达：静默降级，客户端继续用 localStorage 兜底
    return json({ ok: false, skipped: true, error: "sqlite_unavailable" }, 503);
  }
}

/** AI 网关配置跨设备同步（URL + Key + 模型，存服务端 meta 表；受访问密码保护） */
export async function handleAiConfig(request: Request, env: WorkspaceEnv | undefined): Promise<Response> {
  const e: WorkspaceEnv = env ?? {};
  const dbUrl = workspaceDbUrl(e);
  if (!dbUrl) return json({ ok: false, skipped: true, error: "no_storage_backend" });

  const url = new URL(request.url);
  const target = new URL(url.pathname.replace(/^\/api/, "") + url.search, dbUrl);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const init: RequestInit = { method: request.method, headers, redirect: "follow" };
  if (request.method === "PUT") init.body = await request.text();
  try {
    const upstream = await fetch(target.toString(), init);
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return json({ ok: false, skipped: true, error: "sqlite_unavailable" }, 503);
  }
}

/** AI 密钥跨设备同步（存服务端 meta 表；受 /api/* 密码保护，不入工作区快照/导出） */
export async function handleAiKey(request: Request, env: WorkspaceEnv | undefined): Promise<Response> {
  const e: WorkspaceEnv = env ?? {};
  const dbUrl = workspaceDbUrl(e);
  if (!dbUrl) return json({ ok: false, skipped: true, error: "no_storage_backend" });

  const url = new URL(request.url);
  const target = new URL(url.pathname.replace(/^\/api/, "") + url.search, dbUrl);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const init: RequestInit = { method: request.method, headers, redirect: "follow" };
  if (request.method === "PUT") init.body = await request.text();
  try {
    const upstream = await fetch(target.toString(), init);
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return json({ ok: false, skipped: true, error: "sqlite_unavailable" }, 503);
  }
}

export async function handleWorkspace(request: Request, env: WorkspaceEnv | undefined): Promise<Response> {
  // 防御：vinext 本地/生产服务器调用 worker.fetch 时 env 可能为 undefined（无 D1/绑定）
  const e: WorkspaceEnv = env ?? {};

  // 1) Cloudflare D1（云端部署）
  if (e.DB) {
    if (request.method === "GET") {
      const row = await e.DB.prepare(
        "select storage_version as storageVersion, payload, updated_at as updatedAt from workspace_snapshots where id = ?",
      ).bind(SNAPSHOT_ID).first<{ storageVersion: number; payload: string; updatedAt: string }>();
      if (!row) return json({ ok: true, snapshot: null });
      // 防御：payload 损坏时不抛 500，返回损坏标记（客户端可继续用 localStorage 兜底）
      try {
        return json({ ok: true, snapshot: JSON.parse(row.payload), storageVersion: row.storageVersion, updatedAt: row.updatedAt });
      } catch {
        return json({ ok: false, error: "corrupt_payload" }, 500);
      }
    }

    if (request.method === "PUT") {
      const snapshot = await request.json().catch(() => null) as { storageVersion?: unknown } | null;
      // 防御：JSON 为数组（typeof "object" 但非纯对象）也应拒绝
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return json({ ok: false, error: "bad_request" }, 400);
      const storageVersion = typeof snapshot.storageVersion === "number" ? snapshot.storageVersion : 0;
      await e.DB.prepare(
        `insert into workspace_snapshots (id, storage_version, payload, updated_at)
         values (?, ?, ?, CURRENT_TIMESTAMP)
         on conflict(id) do update set storage_version = excluded.storage_version, payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`,
      ).bind(SNAPSHOT_ID, storageVersion, JSON.stringify(snapshot)).run();
      return json({ ok: true });
    }

    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  // 2) 本地 SQLite sidecar（Docker / 局域网部署）
  const dbUrl = workspaceDbUrl(e);
  if (dbUrl) return proxyToSqlite(request, dbUrl);

  // 3) 无后端：纯 localStorage 模式（双击脚本 / 快速体验）
  return json({ ok: false, skipped: true, error: "no_storage_backend" });
}

