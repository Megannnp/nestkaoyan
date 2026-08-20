#!/usr/bin/env node
/**
 * 筑巢考研工作台 — 本地 SQLite 工作区同步服务（零依赖）
 *
 * 用途：Docker / 局域网部署时，为「工作区数据」提供独立的 SQLite 持久化，
 * 使数据不绑定浏览器 localStorage：换浏览器、清缓存、换设备（同一局域网）均可从服务端恢复。
 *
 * 技术：Node.js 内置 node:sqlite（Node ≥ 22.5），无需任何 npm 依赖，镜像极小。
 *
 * 接口（与 worker /api/workspace 的 D1 语义保持一致，便于后端无缝切换）：
 *   GET /workspace   → { ok:true, snapshot:{...} | null, storageVersion?, updatedAt? }
 *   PUT /workspace   → body = 完整工作区快照 JSON → { ok:true }
 *   GET /health      → { ok:true }
 *   文件（PDF/DOCX/文本，与工作区 JSON 分离存磁盘）：
 *   PUT /files/:key    body = 二进制 → 落盘 <dataDir>/files/（key 经 base64url 安全转码）
 *   GET /files/:key    → 二进制流（无 meta，mime 由客户端资源记录提供）
 *   HEAD /files/:key   → 200/404（存在性检查）
 *   DELETE /files/:key → 删除（幂等）
 *
 * 数据表：workspace_snapshots（单行，id='default'），与 Cloudflare D1 表结构一致。
 *
 * 环境变量：
 *   PORT           监听端口（默认 3001）
 *   HOST           监听地址（默认 127.0.0.1 仅本机；Docker 内部网络需设为 0.0.0.0）
 *   DB_PATH        SQLite 文件路径（默认 ./data/kaoyan.db）
 *   MAX_FILE_BYTES 单文件上限（默认 200MB）
 */
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SNAPSHOT_ID = "default";

function defaultDbPath() {
  return process.env.DB_PATH || path.join(process.cwd(), "data", "kaoyan.db");
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * 启动工作区 SQLite 服务。
 * @returns {{ server: import("node:http").Server, db: DatabaseSync, close: () => Promise<void> }}
 */
export async function startWorkspaceDbServer({
  port = Number(process.env.PORT || 3001),
  dbPath = defaultDbPath(),
  // 默认仅本机：局域网访问一律经应用层（worker）代理并做密码认证，避免数据接口直接暴露
  host = process.env.HOST || "127.0.0.1",
} = {}) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_snapshots (
      id TEXT PRIMARY KEY,
      storage_version INTEGER NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── 文件存储（PDF/DOCX/文本二进制，独立于 SQLite）────────────────
  const filesDir = path.join(path.dirname(dbPath), "files");
  fs.mkdirSync(filesDir, { recursive: true });
  const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES || 200 * 1024 * 1024);

  /** 校验并映射文件 key → 磁盘安全文件名（base64url 转码，防路径穿越） */
  function filePathFor(key) {
    if (!/^[A-Za-z0-9._:-]+$/.test(key)) return null;
    return path.join(filesDir, Buffer.from(key, "utf8").toString("base64url"));
  }

  async function handleFileRequest(req, res, key) {
    if (req.method === "PUT") {
      const filePath = filePathFor(key);
      if (!filePath) return json(res, 400, { ok: false, error: "bad_key" });
      const contentLength = Number(req.headers["content-length"] || 0);
      if (contentLength > MAX_FILE_BYTES) return json(res, 413, { ok: false, error: "too_large" });
      // 流式写入；对无 content-length（chunked）的请求也按字节计数强制上限
      const out = fs.createWriteStream(filePath);
      const tooLarge = await new Promise((resolve) => {
        let written = 0;
        let flag = false;
        req.on("data", (chunk) => {
          written += chunk.length;
          if (written > MAX_FILE_BYTES && !flag) {
            flag = true;
            out.destroy();
            req.destroy();
          }
        });
        req.pipe(out);
        out.on("finish", () => resolve(flag));
        out.on("error", () => resolve(flag));
        req.on("error", () => resolve(flag));
      });
      if (tooLarge) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return json(res, 413, { ok: false, error: "too_large" });
      }
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" || req.method === "HEAD") {
      const filePath = filePathFor(key);
      if (!filePath || !fs.existsSync(filePath)) {
        if (req.method === "HEAD") {
          res.writeHead(404);
          res.end();
          return;
        }
        return json(res, 404, { ok: false, error: "not_found" });
      }
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-length": stat.size,
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    if (req.method === "DELETE") {
      const filePath = filePathFor(key);
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (url.pathname === "/health") return json(res, 200, { ok: true });

      if (url.pathname === "/workspace") {
        if (req.method === "GET") {
          const row = db
            .prepare(
              "SELECT storage_version AS storageVersion, payload, updated_at AS updatedAt FROM workspace_snapshots WHERE id = ?"
            )
            .get(SNAPSHOT_ID);
          if (!row) return json(res, 200, { ok: true, snapshot: null });
          try {
            return json(res, 200, {
              ok: true,
              snapshot: JSON.parse(row.payload),
              storageVersion: row.storageVersion,
              updatedAt: row.updatedAt,
            });
          } catch {
            return json(res, 500, { ok: false, error: "corrupt_payload" });
          }
        }

        if (req.method === "PUT") {
          const raw = await readBody(req);
          let snapshot;
          try {
            snapshot = JSON.parse(raw);
          } catch {
            return json(res, 400, { ok: false, error: "bad_json" });
          }
          if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
            return json(res, 400, { ok: false, error: "bad_request" });
          }
          const storageVersion = typeof snapshot.storageVersion === "number" ? snapshot.storageVersion : 0;
          db.prepare(
            `INSERT INTO workspace_snapshots (id, storage_version, payload, updated_at)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
               storage_version = excluded.storage_version,
               payload = excluded.payload,
               updated_at = datetime('now')`
          ).run(SNAPSHOT_ID, storageVersion, JSON.stringify(snapshot));
          return json(res, 200, { ok: true });
        }

        return json(res, 405, { ok: false, error: "method_not_allowed" });
      }

      if (url.pathname.startsWith("/files/")) {
        const key = decodeURIComponent(url.pathname.slice("/files/".length));
        return handleFileRequest(req, res, key);
      }

      return json(res, 404, { ok: false, error: "not_found" });
    } catch (error) {
      console.error("[kaoyan-db] handler error:", error);
      return json(res, 500, { ok: false, error: "internal_error" });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  return {
    server,
    db,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          try {
            db.close();
          } catch {
            /* 已关闭则忽略 */
          }
          resolve();
        });
      }),
  };
}

// 直接运行时启动（Docker CMD / npm start）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dbPath = defaultDbPath();
  startWorkspaceDbServer({ dbPath })
    .then(() => {
      console.log(`[kaoyan-db] SQLite workspace service listening on :${process.env.PORT || 3001} (db=${dbPath})`);
    })
    .catch((err) => {
      console.error("[kaoyan-db] failed to start:", err);
      process.exit(1);
    });
}
