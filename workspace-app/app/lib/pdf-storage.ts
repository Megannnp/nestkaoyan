/**
 * Stabilization 1A-1: PDF 二进制 → IndexedDB 持久化
 *
 * 设计约束：
 * - PDF 二进制绝不写入 localStorage（容量/性能）
 * - 资源元数据（resources）仍走现有 v3 localStorage
 * - 每个 PDF 文件使用 fileStorageKey 关联资源记录
 */

export const PDF_DB_NAME = "nest-exam-pdf-files";
export const PDF_DB_VERSION = 2;
export const PDF_STORE_NAME = "files";
/** 文档解析文本存储 key 后缀：fileStorageKey + DOCX_TEXT_KEY_SUFFIX = 该文件的纯文本 */
export const DOCX_TEXT_KEY_SUFFIX = ":text";

export interface StoredPdfFile {
  /** 与 Resource.fileStorageKey 关联 */
  fileStorageKey: string;
  blob: Blob;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB 不可用"));
      return;
    }
    const request = indexedDB.open(PDF_DB_NAME, PDF_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
        db.createObjectStore(PDF_STORE_NAME, { keyPath: "fileStorageKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 打开失败"));
  });
  return dbPromise;
}

/** 写入单条文件记录（savePdfFile / saveDocText / 服务端恢复共用） */
async function putBlobRecord(record: StoredPdfFile): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE_NAME, "readwrite");
    tx.objectStore(PDF_STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB 写入失败"));
  });
}

/** ── 服务端文件镜像/恢复（SQLite sidecar 模式；无后端时全部静默）── */

async function mirrorFileToServer(fileStorageKey: string, blob: Blob): Promise<void> {
  try {
    await fetch(`/api/files/${encodeURIComponent(fileStorageKey)}`, {
      method: "PUT",
      headers: { "content-type": blob.type || "application/octet-stream" },
      body: blob,
    });
  } catch {
    /* 无后端/离线：保持浏览器本地模式 */
  }
}

async function deleteFileFromServer(fileStorageKey: string): Promise<void> {
  try {
    await fetch(`/api/files/${encodeURIComponent(fileStorageKey)}`, { method: "DELETE" });
  } catch {
    /* 静默 */
  }
}

async function fetchFileFromServer(fileStorageKey: string): Promise<Blob | null> {
  try {
    const res = await fetch(`/api/files/${encodeURIComponent(fileStorageKey)}`);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * 恢复缺失的文件二进制（换浏览器/清缓存后从服务端拉回 PDF/DOCX/文本）。
 * 幂等：已在 IndexedDB 的记录跳过；无后端时静默跳过。
 */
export async function restoreMissingFilesFromServer(
  resources: ReadonlyArray<{ fileStorageKey?: string }>,
): Promise<void> {
  for (const resource of resources) {
    const key = resource.fileStorageKey;
    if (!key) continue;
    const textKey = `${key}${DOCX_TEXT_KEY_SUFFIX}`;

    const existing = await loadPdfBlob(key).catch(() => null);
    if (!existing) {
      const blob = await fetchFileFromServer(key);
      if (blob) {
        await putBlobRecord({
          fileStorageKey: key,
          blob,
          name: key,
          mimeType: blob.type || "application/octet-stream",
          size: blob.size,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const existingText = await loadPdfBlob(textKey).catch(() => null);
    if (!existingText) {
      const textBlob = await fetchFileFromServer(textKey);
      if (textBlob) {
        await putBlobRecord({
          fileStorageKey: textKey,
          blob: textBlob,
          name: textKey,
          mimeType: "text/plain",
          size: textBlob.size,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
}

/**
 * 服务端孤儿文件 GC：删除磁盘上不在 active 列表中的文件（崩溃残留/删除镜像失败兜底）。
 * 在恢复/加载后调用；无后端时静默。
 */
export async function garbageCollectServerFiles(activeKeys: ReadonlyArray<string>): Promise<void> {
  try {
    await fetch("/api/files/gc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(activeKeys),
    });
  } catch {
    /* 静默 */
  }
}

/** 服务端文件 GC 使用：主文件 + DOCX/TXT 解析文本 sidecar 都视为 active。 */
export function fileStorageKeysForServerGc(resources: ReadonlyArray<{ fileStorageKey?: string }>): string[] {
  return resources.flatMap((resource) => {
    const key = resource.fileStorageKey;
    return key ? [key, `${key}${DOCX_TEXT_KEY_SUFFIX}`] : [];
  });
}

/** 保存 PDF 文件到 IndexedDB */
export async function savePdfFile(file: File): Promise<{ fileStorageKey: string; size: number; mimeType: string }> {
  const fileStorageKey = `pdf-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const blob = new Blob([file], { type: file.type || "application/pdf" });
  const record: StoredPdfFile = {
    fileStorageKey,
    blob,
    name: file.name,
    mimeType: file.type || "application/pdf",
    size: file.size,
    createdAt: new Date().toISOString(),
  };
  await putBlobRecord(record);
  // 服务端镜像（SQLite sidecar 模式；无后端时静默失败）
  void mirrorFileToServer(fileStorageKey, blob);
  return { fileStorageKey, size: file.size, mimeType: file.type || "application/pdf" };
}

/** 读取 PDF Blob（按 fileStorageKey） */
export async function loadPdfBlob(fileStorageKey: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE_NAME, "readonly");
    const request = tx.objectStore(PDF_STORE_NAME).get(fileStorageKey);
    request.onsuccess = () => {
      const record = request.result as StoredPdfFile | undefined;
      resolve(record?.blob ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error("PDF 读取失败"));
  });
}

/** 保存文档解析文本（docx 等）到 IndexedDB（key = fileStorageKey + ":text"） */
export async function saveDocText(fileStorageKey: string, text: string): Promise<boolean> {
  if (!text) return false;
  const textKey = `${fileStorageKey}${DOCX_TEXT_KEY_SUFFIX}`;
  const blob = new Blob([text], { type: "text/plain" });
  await putBlobRecord({
    fileStorageKey: textKey,
    blob,
    name: textKey,
    mimeType: "text/plain",
    size: text.length,
    createdAt: new Date().toISOString(),
  });
  void mirrorFileToServer(textKey, blob);
  return true;
}

/** 读取文档解析文本 */
export async function loadDocText(fileStorageKey: string): Promise<string> {
  const db = await openDb();
  const text = await new Promise<string>((resolve) => {
    const tx = db.transaction(PDF_STORE_NAME, "readonly");
    const request = tx.objectStore(PDF_STORE_NAME).get(`${fileStorageKey}${DOCX_TEXT_KEY_SUFFIX}`);
    request.onsuccess = () => {
      const record = request.result as StoredPdfFile | undefined;
      if (!record?.blob) { resolve(""); return; }
      record.blob.text().then(resolve, () => resolve(""));
    };
    request.onerror = () => resolve("");
  });
  return text;
}

/** 删除 PDF 文件（资源删除时清理） */
export async function deletePdfFile(fileStorageKey: string): Promise<void> {
  const textKey = `${fileStorageKey}${DOCX_TEXT_KEY_SUFFIX}`;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE_NAME, "readwrite");
    const store = tx.objectStore(PDF_STORE_NAME);
    store.delete(fileStorageKey);
    store.delete(textKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("PDF 删除失败"));
  });
  // 同步清理服务端文件（SQLite sidecar 模式；无后端时静默失败）
  void deleteFileFromServer(fileStorageKey);
  void deleteFileFromServer(textKey);
}
