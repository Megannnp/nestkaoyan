interface WorkspaceEnv {
  DB?: D1Database;
}

const SNAPSHOT_ID = "default";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleWorkspace(request: Request, env: WorkspaceEnv): Promise<Response> {
  if (!env.DB) return json({ ok: false, skipped: true, error: "no_d1_binding" });

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "select storage_version as storageVersion, payload, updated_at as updatedAt from workspace_snapshots where id = ?",
    ).bind(SNAPSHOT_ID).first<{ storageVersion: number; payload: string; updatedAt: string }>();
    if (!row) return json({ ok: true, snapshot: null });
    return json({ ok: true, snapshot: JSON.parse(row.payload), storageVersion: row.storageVersion, updatedAt: row.updatedAt });
  }

  if (request.method === "PUT") {
    const snapshot = await request.json().catch(() => null) as { storageVersion?: unknown } | null;
    if (!snapshot || typeof snapshot !== "object") return json({ ok: false, error: "bad_request" }, 400);
    const storageVersion = typeof snapshot.storageVersion === "number" ? snapshot.storageVersion : 0;
    await env.DB.prepare(
      `insert into workspace_snapshots (id, storage_version, payload, updated_at)
       values (?, ?, ?, CURRENT_TIMESTAMP)
       on conflict(id) do update set storage_version = excluded.storage_version, payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`,
    ).bind(SNAPSHOT_ID, storageVersion, JSON.stringify(snapshot)).run();
    return json({ ok: true });
  }

  return json({ ok: false, error: "method_not_allowed" }, 405);
}
