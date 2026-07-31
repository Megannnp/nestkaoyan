/**
 * Stabilization 1A-1: PDF 二进制 → IndexedDB 持久化
 *
 * 设计约束：
 * - PDF 二进制绝不写入 localStorage（容量/性能）
 * - 资源元数据（resources）仍走现有 v3 localStorage
 * - 每个 PDF 文件使用 fileStorageKey 关联资源记录
 */

export const PDF_DB_NAME = "nest-exam-pdf-files";
export const PDF_DB_VERSION = 1;
export const PDF_STORE_NAME = "files";

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

/** 删除 PDF 文件（资源删除时清理） */
export async function deletePdfFile(fileStorageKey: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE_NAME, "readwrite");
    tx.objectStore(PDF_STORE_NAME).delete(fileStorageKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("PDF 删除失败"));
  });
}