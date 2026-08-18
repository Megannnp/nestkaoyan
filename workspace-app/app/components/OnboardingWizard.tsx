import { useState } from "react";
import type { ExamGoal, Subject, Resource, KnowledgeNode, Task, ResourceType } from "../lib/types";
import { RESOURCE_KIND_LABEL, RESOURCE_KIND_TO_LEGACY_TYPE } from "../lib/types";
import { makeSubject, clampTargetScore, SUBJECT_PRESETS } from "../lib/subject-utils";
import { savePdfFile, saveDocText } from "../lib/pdf-storage";
import { isDocxFile, isTextFileType, isImageFileType, extractDocxText, extractTextFileContent } from "../lib/docx-utils";
import { setStoredApiKey } from "../lib/ai/chat-complete";
import { chatCompleteStream, chatErrorReason } from "../lib/ai/chat-complete";
import { collectFilesFromDataTransfer } from "./GlobalResourceUploadModal";

export interface OnboardingResult {
  exam: ExamGoal;
  subjects: Subject[];
  resources: Resource[];
  nodes: KnowledgeNode[];
  tasks: Task[];
}

interface OnboardingWizardProps {
  onComplete: (result: OnboardingResult) => void;
}

// 2026-08-03 用户反馈：增加「学习程度」步骤，让用户对每个科目明确标注当前水平
const STEP_TITLES = ["基本目标", "考试科目", "学习程度", "导入资料", "添加 API"];

function todayShanghai(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function blankExam(): ExamGoal {
  const today = todayShanghai();
  return {
    examName: "考研初试",
    school: "待设置",
    major: "待设置",
    examDate: "2026-12-26",
    startDate: today,
    examGoalCreatedAt: today,
    weeklyDays: "6",
    weekdayHours: "3",
    weekendHours: "6",
    baseline: "",
  };
}

function makeResourceId(): string {
  return `r-onb-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

async function buildResource(subjectName: string, kind: ResourceType, rawName: string, file: File | null): Promise<Resource> {
  const base: Resource = {
    id: makeResourceId(),
    name: rawName.replace(/\.(pdf|docx?|txt|md|png|jpe?g|webp|gif)$/i, "") || RESOURCE_KIND_LABEL[kind],
    subject: subjectName,
    type: RESOURCE_KIND_TO_LEGACY_TYPE[kind],
    resourceKind: kind,
    author: "待确认",
    version: "",
    pages: "待解析",
    status: "待解析",
    fileName: file?.name ?? rawName,
    recommendedRound: "第一轮",
    recommendedLayer: "第 1-2 层",
    currentPage: "",
    lastRead: "",
    readingMinutes: "",
    linkedNode: "待关联",
    kind: "demo",
    createdAt: new Date().toISOString(),
  };
  const isPdf = file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf");
  const isDocx = file ? isDocxFile(file) : false;
  const isText = file ? isTextFileType(file) : false;
  const isImage = file ? isImageFileType(file) : false;
  if (file && (isPdf || isDocx || isText || isImage)) {
    const stored = await savePdfFile(file);
    const extra: Partial<Resource> = {
      kind: isPdf ? "pdf" : isDocx ? "docx" : isText ? "text" : "image",
      fileStorageKey: stored.fileStorageKey,
      size: stored.size,
      mimeType: stored.mimeType,
    };
    if (isDocx) {
      extra.pages = `DOCX 文档 · ${(stored.size / 1024).toFixed(1)} KB`;
      const docText = await extractDocxText(file).catch(() => "");
      if (docText) await saveDocText(stored.fileStorageKey, docText);
    } else if (isText) {
      extra.pages = `文本文件 · ${(stored.size / 1024).toFixed(1)} KB`;
      const docText = await extractTextFileContent(file).catch(() => "");
      if (docText) await saveDocText(stored.fileStorageKey, docText);
    } else if (isImage) {
      extra.pages = `图片资料 · ${(stored.size / 1024).toFixed(1)} KB`;
    } else {
      extra.pages = `PDF 文件 · ${(stored.size / 1024).toFixed(1)} KB`;
    }
    return { ...base, ...extra };
  }
  return base;
}

const labelCls = "text-[11px] font-bold text-[#71717A] mb-1 block";
const inputCls = "w-full min-h-[36px] px-3 rounded-[8px] border border-[#D4D4D8] text-[13px] bg-white";
const primaryCls = "min-h-[38px] px-5 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px] disabled:opacity-40";
const ghostCls = "min-h-[38px] px-5 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]";

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [exam, setExam] = useState<ExamGoal>(blankExam);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  // Step 4 导入表单（AI 自动归档：不再需要用户选择科目/类型）
  const [impName, setImpName] = useState("");
  const [importError, setImportError] = useState("");
  // Step 5 添加 API
  const [apiKey, setApiKey] = useState("");
  const [testingKey, setTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const patchExam = (patch: Partial<ExamGoal>) => setExam((prev) => ({ ...prev, ...patch }));

  function addPreset(preset: (typeof SUBJECT_PRESETS)[number]) {
    if (subjects.some((s) => s.name === preset.name)) return;
    setSubjects((prev) => [...prev, makeSubject(preset)]);
  }
  function addBlankSubject() {
    setSubjects((prev) => [...prev, makeSubject({ name: "" })]);
  }
  function updateSubject(id: string, patch: Partial<Subject>) {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeSubject(id: string) {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  }

  async function addResourceEntry(file: File | null) {
    const raw = (file?.name || impName).trim();
    const subjectName = subjects[0]?.name;
    if (!raw || !subjectName) return;
    if (file && !(
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      || isDocxFile(file) || isTextFileType(file) || isImageFileType(file)
    )) {
      setImportError("当前支持导入 PDF / DOCX / 文本（txt、md）/ 图片文件。");
      return;
    }
    setImportError("");
    try {
      const resource = await buildResource(subjectName, "other", raw, file);
      setResources((prev) => [resource, ...prev]);
      setImpName("");
    } catch {
      setImportError("导入失败，请重试");
    }
  }

  function finish() {
    onComplete({ exam, subjects, resources, nodes: [], tasks: [] });
  }

  const canNextFrom1 = !!exam.examDate;
  const canNextFrom2 = subjects.length > 0 && subjects.every((s) => s.name.trim());

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#FAFAFA]">
      <div className="max-w-[720px] mx-auto px-5 py-8">
        {/* 头部 + 步骤指示 */}
        <div className="flex items-center gap-3 mb-1">
          {/* 静态 SVG logo，用原生 <img> 即可（next/image 对 SVG 反而需额外配置） */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="筑巢考研" className="w-9 h-9 shrink-0" />
          <div>
            <div className="text-[15px] font-bold text-[#18181B]">筑巢考研 · 初始化</div>
            <div className="text-[12px] text-[#71717A]">告诉系统你考什么、什么时候考、有哪些科目与资料</div>
          </div>
        </div>

        <div className="flex items-center gap-2 my-5">
          {STEP_TITLES.map((title, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div key={title} className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`grid place-items-center w-6 h-6 rounded-full text-[12px] font-bold shrink-0 ${active ? "bg-[#18181B] text-white" : done ? "bg-[#52525B] text-white" : "bg-[#E4E4E7] text-[#71717A]"}`}>
                  {done ? "✓" : n}
                </div>
                <span className={`text-[12px] truncate ${active ? "text-[#18181B] font-bold" : "text-[#71717A]"}`}>{title}</span>
                {n < STEP_TITLES.length && <div className="flex-1 h-px bg-[#E4E4E7] min-w-[8px]" />}
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-[14px] border border-[#E4E4E7] p-6 min-h-[360px]">
          {/* ─── Step 1 基本目标 ─── */}
          {step === 1 && (
            <div>
              <h2 className="text-[18px] font-bold text-[#18181B] mb-1">基本目标</h2>
              <p className="text-[13px] text-[#71717A] mb-5">院校和专业可以先跳过，考试日期必填。</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>考试名称</label>
                  <input className={inputCls} value={exam.examName} onChange={(e) => patchExam({ examName: e.target.value })} placeholder="如：2027 考研初试" />
                </div>
                <div>
                  <label className={labelCls}>考试日期 <span className="text-[#EF4444]">*</span></label>
                  <input className={inputCls} type="date" value={exam.examDate} onChange={(e) => patchExam({ examDate: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>目标院校（可跳过）</label>
                  <input className={inputCls} value={exam.school} onChange={(e) => patchExam({ school: e.target.value })} placeholder="如：目标院校" />
                </div>
                <div>
                  <label className={labelCls}>专业 / 方向（可跳过）</label>
                  <input className={inputCls} value={exam.major} onChange={(e) => patchExam({ major: e.target.value })} placeholder="如：数学二" />
                </div>
                <div>
                  <label className={labelCls}>每周学习天数</label>
                  <input className={inputCls} value={exam.weeklyDays} onChange={(e) => patchExam({ weeklyDays: e.target.value })} placeholder="如：6" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>工作日 (h)</label>
                    <input className={inputCls} value={exam.weekdayHours} onChange={(e) => patchExam({ weekdayHours: e.target.value })} placeholder="3" />
                  </div>
                  <div>
                    <label className={labelCls}>周末 (h)</label>
                    <input className={inputCls} value={exam.weekendHours} onChange={(e) => patchExam({ weekendHours: e.target.value })} placeholder="6" />
                  </div>
                </div>
              </div>
              {!canNextFrom1 && <p className="text-[12px] text-[#A1A1AA] mt-4">填写考试日期后即可进入下一步。</p>}
            </div>
          )}

          {/* ─── Step 2 科目 ─── */}
          {step === 2 && (
            <div>
              <h2 className="text-[18px] font-bold text-[#18181B] mb-1">考试科目</h2>
              <p className="text-[13px] text-[#71717A] mb-4">点击预设一键添加，或手动新增。至少添加 1 个科目。</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {SUBJECT_PRESETS.map((preset) => {
                  const added = subjects.some((s) => s.name === preset.name);
                  return (
                    <button key={preset.name} type="button" disabled={added}
                      className={`min-h-[30px] px-3 rounded-[8px] text-[12px] font-bold ${added ? "bg-[#E4E4E7] text-[#A1A1AA]" : "bg-[#F4F4F5] text-[#18181B] hover:bg-[#EDEDED]"}`}
                      onClick={() => addPreset(preset)}>
                      {added ? `✓ ${preset.name}` : `+ ${preset.name}`}
                    </button>
                  );
                })}
                <button type="button" className="min-h-[30px] px-3 rounded-[8px] text-[12px] font-bold bg-[#18181B] text-white" onClick={addBlankSubject}>+ 自定义</button>
              </div>

              {subjects.length === 0 ? (
                <p className="text-[13px] text-[#A1A1AA] text-center py-8 border border-dashed border-[#D4D4D8] rounded-[8px]">还没有科目，点上面的预设或「自定义」添加。</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {subjects.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-2 p-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                      <input className="min-h-[32px] px-2 rounded-[6px] border border-[#D4D4D8] text-[13px] w-[130px]" value={s.name} placeholder="科目名称" onChange={(e) => updateSubject(s.id, { name: e.target.value })} />
                      <select className="min-h-[32px] px-2 rounded-[6px] border border-[#D4D4D8] text-[13px]" value={s.type}
                        onChange={(e) => { const type = e.target.value; const next = makeSubject({ ...s, type }); updateSubject(s.id, { type, maxScore: next.maxScore, targetScore: clampTargetScore(s.targetScore, next.maxScore) }); }}>
                        <option value="公共课">公共课</option>
                        <option value="专业课">专业课</option>
                      </select>
                      <div className="flex items-center gap-1 text-[12px] text-[#71717A]">
                        <span>目标</span>
                        <input className="min-h-[32px] w-[56px] px-2 text-center rounded-[6px] border border-[#D4D4D8] text-[13px]" type="number" min="0" max={s.maxScore}
                          value={s.targetScore} onChange={(e) => updateSubject(s.id, { targetScore: clampTargetScore(e.target.value, s.maxScore) })} />
                        <span className="text-[#A1A1AA]">/ {s.maxScore}</span>
                      </div>
                      {/* Step 3 已提供独立「学习程度」选择，此处不再重复 */}
                      <div className="flex-1" />
                      <button type="button" className="text-[12px] text-[#EF4444] px-2" onClick={() => removeSubject(s.id)}>删除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 3 学习程度（2026-08-03 用户反馈：了解学习者当前水平） ─── */}
          {step === 3 && (
            <div>
              <h2 className="text-[18px] font-bold text-[#18181B] mb-1">当前学习水平</h2>
              <p className="text-[13px] text-[#71717A] mb-4">为每个科目选择你现在的能力状态，AI 会根据它安排学习起点。</p>
              {subjects.length === 0 ? (
                <p className="text-[13px] text-[#A1A1AA] text-center py-8 border border-dashed border-[#D4D4D8] rounded-[8px]">请先返回上一步添加科目。</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {subjects.map((s) => (
                    <div key={s.id} className="p-3 rounded-[10px] border border-[#E4E4E7] bg-white">
                      <strong className="text-[14px] text-[#18181B] block mb-2">{s.name}</strong>
                      <div className="flex flex-wrap gap-2">
                        {["完全不懂", "有些模糊", "基本理解", "能够讲清", "能够迁移"].map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`min-h-[30px] px-3 rounded-[8px] text-[12px] font-bold ${s.currentMastery === m ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B] hover:bg-[#EDEDED]"}`}
                            onClick={() => updateSubject(s.id, { currentMastery: m })}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-[#A1A1AA] mt-1.5">
                        当前选择：{s.currentMastery}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 4 导入资料（AI 自动归档，拖拽即上传）─── */}
          {step === 4 && (
            <div>
              <h2 className="text-[18px] font-bold text-[#18181B] mb-1">导入资料 <span className="text-[12px] font-normal text-[#A1A1AA]">（可跳过）</span></h2>
              <p className="text-[13px] text-[#71717A] mb-4">拖入 PDF 文件或文件夹即可，AI 自动识别所属科目、资料类型与年份，无需手动分类。</p>
              <div
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-[10px] border-2 border-dashed border-[#D4D4D8] bg-[#FAFAFA] mb-4 text-center"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={async (e) => {
                  e.preventDefault(); e.stopPropagation();
                  const dropped = await collectFilesFromDataTransfer(e.dataTransfer);
                  const files = dropped.length ? dropped : Array.from(e.dataTransfer.files || []);
                  for (const f of files) {
                    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
                      await addResourceEntry(f);
                    }
                  }
                }}
              >
                <span className="text-[28px]">📁</span>
                <strong className="text-[14px] text-[#18181B]">拖拽 PDF 文件或文件夹到此处</strong>
                <span className="text-[12px] text-[#71717A]">AI 自动识别科目与类型（真题 / 教材 / 教辅 / 笔记等），文件保存在本机 IndexedDB</span>
                <label className={`${ghostCls} grid place-items-center cursor-pointer`}>
                  或点击选择 PDF
                  <input type="file" className="hidden" accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain,.md,text/markdown,.png,image/png,.jpg,image/jpeg" multiple onChange={(e) => { const fs = Array.from(e.target.files || []); fs.forEach((f) => void addResourceEntry(f)); e.currentTarget.value = ""; }} />
                </label>
              </div>
              {importError && <p className="text-[12px] text-[#EF4444] mb-3">{importError}</p>}
              {subjects.length === 0 && <p className="text-[12px] text-[#EF4444] mb-3">请先在上一步添加科目。</p>}
              {resources.length === 0 ? (
                <p className="text-[13px] text-[#A1A1AA] text-center py-6 border border-dashed border-[#D4D4D8] rounded-[8px]">还没有导入资料。也可以直接跳过，之后在知识中心再上传。</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {resources.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-[8px] border border-[#E4E4E7] text-[13px]">
                      <span className="px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[11px] text-[#52525B] font-bold">{RESOURCE_KIND_LABEL[r.resourceKind ?? "other"]}</span>
                      <span className="font-bold text-[#18181B] truncate">{r.name}</span>
                      <span className="text-[#A1A1AA] text-[12px]">· {r.subject} · {r.kind === "pdf" ? "PDF" : "占位"}</span>
                      <div className="flex-1" />
                      <button type="button" className="text-[12px] text-[#EF4444]" onClick={() => setResources((prev) => prev.filter((x) => x.id !== r.id))}>移除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 5 添加 API Key（2026-08-05 替换原"生成学习结构"内容） ─── */}
          {step === 5 && (
            <div>
              <h2 className="text-[18px] font-bold text-[#18181B] mb-1">添加 API Key <span className="text-[12px] font-normal text-[#A1A1AA]">（可跳过）</span></h2>
              <p className="text-[13px] text-[#71717A] mb-4">
                填入你的 DeepSeek API Key，让 AI 阅读讲解、计划分析等真实模型功能可用。密钥仅保存在本机浏览器，通过服务端转发调用，不会明文暴露。
              </p>

              <div className="mb-3">
                <label className={`${labelCls}`}>DeepSeek API Key</label>
                <input
                  className={inputCls}
                  type="password"
                  autoComplete="off"
                  placeholder="sk-…（在 https://platform.deepseek.com/api_keys 申请）"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  className={primaryCls}
                  disabled={!apiKey.trim() || testingKey}
                  onClick={async () => {
                    setTestingKey(true);
                    setKeyStatus(null);
                    try {
                      // 先保存到本地，再通过真实 SSE 端点发一条最小请求验证密钥可用性
                      setStoredApiKey(apiKey);
                      let responded = false;
                      const done = new Promise<{ ok: boolean; error?: string }>((resolve) => {
                        void chatCompleteStream({
                          system: "你是连接测试助手。请只回复两个字：正常",
                          user: "连接测试",
                          onDelta: () => { responded = true; },
                          onDone: (r) => resolve(r.ok || responded ? { ok: true } : { ok: false, error: r.error }),
                        });
                      });
                      const result = await done;
                      setKeyStatus(result.ok
                        ? { ok: true, text: "✓ 密钥已保存且连接正常" }
                        : { ok: false, text: `连接失败（${chatErrorReason(result.error)}），密钥已保存，可在设置中重试` });
                    } catch {
                      setKeyStatus({ ok: false, text: "测试出错，密钥已保存" });
                    } finally {
                      setTestingKey(false);
                    }
                  }}
                >
                  {testingKey ? "测试连接中…" : "保存并测试连接"}
                </button>
                {apiKey.trim() && (
                  <button
                    type="button"
                    className={ghostCls}
                    onClick={() => { setApiKey(""); setStoredApiKey(""); setKeyStatus(null); }}
                  >
                    清除
                  </button>
                )}
              </div>
              {keyStatus && (
                <p className={`text-[13px] mb-4 font-bold ${keyStatus.ok ? "text-[#18181B]" : "text-[#EF4444]"}`}>
                  {keyStatus.text}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 页脚导航 */}
        <div className="flex items-center gap-3 mt-5">
          {step === 1 ? (
            <div />
          ) : (
            <button type="button" className={ghostCls} onClick={() => setStep((s) => s - 1)}>上一步</button>
          )}
          <div className="flex-1" />
          {(step === 4 || step === 5) && (
            <button type="button" className="text-[13px] text-[#71717A] hover:text-[#18181B]" onClick={() => (step === 5 ? finish() : setStep((s) => s + 1))}>跳过</button>
          )}
          {step < 5 ? (
            <button type="button" className={primaryCls} disabled={(step === 1 && !canNextFrom1) || (step === 2 && !canNextFrom2)} onClick={() => setStep((s) => s + 1)}>下一步</button>
          ) : (
            <button type="button" className={primaryCls} onClick={finish}>完成，进入工作台</button>
          )}
        </div>
      </div>
    </div>
  );
}
