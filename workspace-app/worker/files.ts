interface FilesEnv {
  /** 本地 SQLite 同步服务地址（Docker 部署时指向 kaoyan-db 容器） */
  WORKSPACE_DB_URL?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** 兼容容器/宿主通过进程环境传入（nodejs_compat 下 process.env 可用） */
function filesDbUrl(env: FilesEnv): string | undefined {
  if (env.WORKSPACE_DB_URL) return env.WORKSPACE_DB_URL;
  if (typeof process !== "undefined" && process.env?.WORKSPACE_DB_URL) return process.env.WORKSPACE_DB_URL;
  return undefined;
}

/**
 * 文件（PDF/DOCX/文本二进制）代理到本地 SQLite sidecar。
 * /api/files/:key → sidecar /files/:key（去掉 /api 前缀）。
 * 说明：Cloudflare D1 不承载二进制文件；云端部署时本接口返回 skipped，
 * 文件保持浏览器 IndexedDB 本地存储（如需云端文件存储可后续接 R2）。
 */
export async function handleFiles(request: Request, env: FilesEnv | undefined): Promise<Response> {
  const e: FilesEnv = env ?? {};
  const dbUrl = filesDbUrl(e);
  if (!dbUrl) return json({ ok: false, skipped: true, error: "no_storage_backend" });

  const url = new URL(request.url);
  const target = new URL(url.pathname.replace(/^\/api/, "") + url.search, dbUrl);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const init: RequestInit = { method: request.method, headers, redirect: "follow" };
  if (request.method === "PUT" || request.method === "POST") {
    init.body = await request.arrayBuffer();
  }
  try {
    const upstream = await fetch(target.toString(), init);
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      },
    });
  } catch {
    return json({ ok: false, skipped: true, error: "sqlite_unavailable" }, 503);
  }
}
