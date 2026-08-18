"use client";

import { dateOnly } from "../lib/utils";
import { useWorkspace } from "./workspace-context";
import styles from "../../styles/workspace.module.css";

/** 递归收集拖拽的文件夹/多文件中的全部文件（webkitGetAsEntry 支持拖入文件夹）。 */
export async function collectFilesFromDataTransfer(dataTransfer: DataTransfer | null): Promise<File[]> {
  if (!dataTransfer) return [];
  const files: File[] = [];
  const asyncWalk = (entry: FileSystemEntry | null): Promise<void> =>
    new Promise((resolve) => {
      if (!entry) return resolve();
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        fileEntry.file((file) => { files.push(file); resolve(); }, () => resolve());
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const readBatch = (): Promise<void> =>
          new Promise((res) => {
            reader.readEntries(async (entries) => {
              if (!entries.length) return res();
              await Promise.all(entries.map(asyncWalk));
              await readBatch(); // readEntries 分批返回，循环读到空
              res();
            }, () => res());
          });
        readBatch().then(resolve, resolve);
      } else resolve();
    });
  const entryPromises: Promise<void>[] = [];
  for (const item of Array.from(dataTransfer.items)) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entryPromises.push(asyncWalk(entry));
    else {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  await Promise.all(entryPromises);
  return files;
}

/** 全局上传弹窗：在任何视图（含今日任务）点击「去上传资料」都能直接弹出，不跳转页面。 */
export function GlobalResourceUploadModal() {
  const {
    activeKnowledgeSubject, fileUploadState,
    closeResourceDialog, startBatchUpload, addResource,
  } = useWorkspace();

  const handleDropFiles = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    let files = await collectFilesFromDataTransfer(e.dataTransfer);
    if (files.length === 0 && e.dataTransfer.files?.length) {
      files = Array.from(e.dataTransfer.files);
    }
    if (files.length) await startBatchUpload(files, activeKnowledgeSubject);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleFolderInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) await startBatchUpload(files, activeKnowledgeSubject);
    e.target.value = "";
  };
  const handleMultiInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) await startBatchUpload(files, activeKnowledgeSubject);
    e.target.value = "";
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={closeResourceDialog}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label="AI识别资料" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><span>AI First</span><strong>AI识别资料</strong></div>
          <button onClick={closeResourceDialog}>关闭</button>
        </div>
        <form onSubmit={addResource} className="modal-form">
          <input type="hidden" name="sourceText" value={`${activeKnowledgeSubject || "未分科"}空白资料-${dateOnly()}`} />
          <div className={`upload-drop ${styles.uploadDropLarge}`}
            onDragOver={handleDragOver}
            onDrop={handleDropFiles}
          >
                                <span className={styles.uploadDropIcon}>📁 拖拽文件或文件夹到此处</span>
                                <span className={styles.uploadDropHint}>支持 PDF / DOCX / TXT / MD / 图片；Word 97-2003（.doc）请先用 Word/WPS 另存为 PDF 或 .docx</span>
          </div>
          <div className="flex gap-2 mt-3">
            <label className="inline-flex items-center justify-center min-h-[38px] px-4 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] cursor-pointer hover:bg-[#F4F4F5] transition-colors" role="button">
              选择多个 PDF
                                <input type="file" accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain,.md,text/markdown,.png,image/png,.jpg,image/jpeg,.webp,image/webp,.gif,image/gif" multiple className="hidden" onChange={handleMultiInput} />
            </label>
            <label className="inline-flex items-center justify-center min-h-[38px] px-4 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] cursor-pointer hover:bg-[#F4F4F5] transition-colors" role="button">
              选择文件夹
              <input
                type="file"
                multiple
                // @ts-expect-error webkitdirectory 非标准属性
                webkitdirectory=""
                directory=""
                className="hidden"
                onChange={handleFolderInput}
              />
            </label>
          </div>
          {fileUploadState && (
            <div className="p-3 mt-3 rounded-[8px] border border-[#E4E4E7] bg-white flex items-center gap-3">
              <span className={styles.fileIcon}>📄</span>
              <div className="flex-1 min-w-0">
                <strong className="text-[14px] block truncate">{fileUploadState.name}</strong>
                <span className="text-[12px] text-[#71717A]">{(fileUploadState.size / (1024 * 1024)).toFixed(1)} MB · {fileUploadState.inferred.pages.includes("AI识别") ? "AI识别中" : fileUploadState.inferred.pages}</span>
                {fileUploadState.step !== "done" && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-[#71717A]">
                    {["uploading", "extracting", "identifying", "parsing", "mapping"].map((s) => {
                      const stages = ["uploading", "extracting", "identifying", "parsing", "mapping"];
                      const curIdx = stages.indexOf(fileUploadState.step);
                      const thisIdx = stages.indexOf(s);
                      return <span key={s} className={thisIdx < curIdx ? "text-[#18181B]" : thisIdx === curIdx ? "text-[#18181B] font-bold" : "opacity-40"}>{thisIdx < curIdx ? "✓" : "·"}</span>;
                    })}
                    <span className="ml-1">
                      {fileUploadState.step === "uploading" ? "上传中" : fileUploadState.step === "extracting" ? "提取文本" : fileUploadState.step === "identifying" ? "识别科目/类型" : fileUploadState.step === "parsing" ? "解析章节" : fileUploadState.step === "mapping" ? "关联知识图谱" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {fileUploadState?.step === "done" && (
            <div className="p-3 mt-3 rounded-[8px] border border-[#E4E4E7] bg-white">
              <div className="text-[12px] font-bold text-[#18181B] mb-2">AI 识别结果</div>
              {[
                { icon: '📘', label: '类型', value: fileUploadState.inferred.type },
                { icon: '📖', label: '书名', value: fileUploadState.inferred.name },
                { icon: '📚', label: '所属科目', value: fileUploadState.inferred.subject },
                { icon: '🧠', label: '知识体系', value: fileUploadState.inferred.linkedNode },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-[12px] mt-1">
                  <span>{item.icon}</span>
                  <span className="text-[#71717A] w-[64px] shrink-0">{item.label}</span>
                  <span className="text-[#18181B]">{item.value}</span>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <button className="primary-btn" type="submit">确认保存</button>
                <button className="secondary-btn" type="button" onClick={closeResourceDialog}>取消</button>
              </div>
            </div>
          )}
          {!fileUploadState && (
            <div className="flex gap-2 mt-3">
              <span className="text-[12px] text-[#71717A]">上传后将自动识别科目与资料类型，也可直接点击「选择多个 PDF」开始导入。</span>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}