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
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE_NAME, "readwrite");
    tx.objectStore(PDF_STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("PDF 保存失败"));
  });
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
  const db = await openDb();
  const textKey = `${fileStorageKey}${DOCX_TEXT_KEY_SUFFIX}`;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE_NAME, "readwrite");
    tx.objectStore(PDF_STORE_NAME).put({ fileStorageKey: textKey, blob: new Blob([text], { type: "text/plain" }), name: textKey, mimeType: "text/plain", size: text.length, createdAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("文本保存失败"));
  });
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
}
