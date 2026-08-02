"use client";

import { useState } from "react";
import type { ExamGoal, Subject, Resource, KnowledgeNode, Task, ResourceType } from "../lib/types";
import { RESOURCE_KIND_LABEL, RESOURCE_KIND_TO_LEGACY_TYPE } from "../lib/types";
import { makeSubject, clampTargetScore, SUBJECT_PRESETS } from "../lib/subject-utils";
import { generateInitialStructure, type InitialStructure } from "../lib/onboarding-generator";
import { savePdfFile } from "../lib/pdf-storage";

export interface OnboardingResult {
  exam: ExamGoal;
  subjects: Subject[];
  resources: Resource[];
  nodes: KnowledgeNode[];
  tasks: Task[];
}

interface OnboardingWizardProps {
  onComplete: (result: OnboardingResult) => void;
  onLoadDemo: () => void;
}

const RESOURCE_KINDS: ResourceType[] = ["past_exam", "textbook", "exercise_book", "notes", "other"];
const STEP_TITLES = ["基本目标", "考试科目", "导入资料", "生成学习结构"];

function todayShanghai(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function blankExam(): ExamGoal {
  const today = todayShanghai();
  return {
    examName: "考研初试",
    school: "",
    major: "",
    examDate: "",
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
    name: rawName.replace(/\.(pdf|docx?|png|jpe?g)$/i, "") || RESOURCE_KIND_LABEL[kind],
    subject: subjectName,
    type: RESOURCE_KIND_TO_LEGACY_TYPE[kind],
    resourceKind: kind,
    author: "待确认",
    version: "",
    pages: "待解析",
    status: "待解析",
    fileName: file?.name ?? rawName,
    recommendedRound: "第一轮",
    recommendedLayer: "Layer 1-2",
    currentPage: "",
    lastRead: "",
    readingMinutes: "",
    linkedNode: "待关联",
    kind: "demo",
    createdAt: new Date().toISOString(),
  };
  if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
    const stored = await savePdfFile(file);
    return {
      ...base,
      kind: "pdf",
      fileStorageKey: stored.fileStorageKey,
      size: stored.size,
      mimeType: stored.mimeType,
      pages: `PDF 文件 · ${(stored.size / 1024).toFixed(1)} KB`,
    };
  }
  return base;
}

const labelCls = "text-[11px] font-bold text-[#71717A] mb-1 block";
const inputCls = "w-full min-h-[36px] px-3 rounded-[8px] border border-[#D4D4D8] text-[13px] bg-white";
const primaryCls = "min-h-[38px] px-5 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px] disabled:opacity-40";
const ghostCls = "min-h-[38px] px-5 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]";

export function OnboardingWizard({ onComplete, onLoadDemo }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [exam, setExam] = useState<ExamGoal>(blankExam);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [generated, setGenerated] = useState<InitialStructure | null>(null);

  // Step 3 导入表单
  const [impSubject, setImpSubject] = useState("");
  const [impKind, setImpKind] = useState<ResourceType>("past_exam");
  const [impName, setImpName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

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
    const subjectName = impSubject || subjects[0]?.name;
    if (!raw || !subjectName) return;
    if (file && !(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
      setImportError("当前仅支持导入 PDF 文件。");
      return;
    }
    setImportError("");
    setImporting(true);
    try {
      const resource = await buildResource(subjectName, impKind, raw, file);
      setResources((prev) => [resource, ...prev]);
      setImpName("");
    } finally {
      setImporting(false);
    }
  }

  function runGenerate() {
    setGenerated(generateInitialStructure(exam, subjects, resources));
  }

  function finish() {
    const structure = generated ?? { nodes: [], tasks: [] };
    onComplete({ exam, subjects, resources, nodes: structure.nodes, tasks: structure.tasks });
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
                <div className={`grid place-items-center w-6 h-6 rounded-full text-[12px] font-bold shrink-0 ${active ? "bg-[#18181B] text-white" : done ? "bg-[#0F766E] text-white" : "bg-[#E4E4E7] text-[#71717A]"}`}>
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
                  <input className={inputCls} value={exam.school} onChange={(e) => patchExam({ school: e.target.value })} placeholder="如：哈尔滨工业大学" />
                </div>
                <div>
                  <label className={labelCls}>专业 / 方向（可跳过）</label>
                  <input className={inputCls} value={exam.major} onChange={(e) => patchExam({ major: e.target.value })} placeholder="如：828 物理化学" />
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
                      <select className="min-h-[32px] px-2 rounded-[6px] border border-[#D4D4D8] text-[13px]" value={s.currentMastery} onChange={(e) => updateSubject(s.id, { currentMastery: e.target.value })}>
                        {["完全不懂", "有些模糊", "基本理解", "能够讲清", "能够迁移"].map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <div className="flex-1" />
                      <button type="button" className="text-[12px] text-[#EF4444] px-2" onClick={() => removeSubject(s.id)}>删除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 3 导入资料 ─── */}
          {step === 3 && (
            <div>
              <h2 className="text-[18px] font-bold text-[#18181B] mb-1">导入资料 <span className="text-[12px] font-normal text-[#A1A1AA]">（可跳过）</span></h2>
              <p className="text-[13px] text-[#71717A] mb-4">区分资料类型，后续 AI 会按类型差异化处理。真实 PDF 会存到本地（IndexedDB）。</p>
              <div className="flex flex-wrap items-end gap-2 p-3 rounded-[8px] bg-[#F4F4F5] mb-4">
                <div>
                  <label className={labelCls}>所属科目</label>
                  <select className="min-h-[36px] px-2 rounded-[8px] border border-[#D4D4D8] text-[13px] bg-white" value={impSubject || subjects[0]?.name || ""} onChange={(e) => setImpSubject(e.target.value)}>
                    {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>资料类型</label>
                  <select className="min-h-[36px] px-2 rounded-[8px] border border-[#D4D4D8] text-[13px] bg-white" value={impKind} onChange={(e) => setImpKind(e.target.value as ResourceType)}>
                    {RESOURCE_KINDS.map((k) => <option key={k} value={k}>{RESOURCE_KIND_LABEL[k]}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className={labelCls}>名称（无文件时）</label>
                  <input className={inputCls} value={impName} onChange={(e) => setImpName(e.target.value)} placeholder="如：2010-2024 真题" />
                </div>
                <label className={`${ghostCls} grid place-items-center cursor-pointer`}>
                  选择 PDF
                  <input type="file" className="hidden" accept=".pdf,application/pdf" onChange={(e) => { const f = e.target.files?.[0] ?? null; if (f) addResourceEntry(f); e.currentTarget.value = ""; }} />
                </label>
                <button type="button" className={primaryCls} disabled={importing || (!impName.trim())} onClick={() => addResourceEntry(null)}>{importing ? "导入中…" : "添加"}</button>
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

          {/* ─── Step 4 生成学习结构 ─── */}
          {step === 4 && (
            <div>
              <h2 className="text-[18px] font-bold text-[#18181B] mb-1">生成初始学习结构 <span className="text-[12px] font-normal text-[#A1A1AA]">（可跳过）</span></h2>
              <p className="text-[13px] text-[#71717A] mb-4">根据你的科目与资料，生成初始知识图谱与第一阶段任务。</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="p-4 rounded-[10px] border border-[#0F766E] bg-[#F0FDFA]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-[#0F766E] text-white text-[11px] font-bold">演示生成</span>
                    <span className="text-[12px] text-[#0F766E] font-bold">规则版 · 可用</span>
                  </div>
                  <p className="text-[12px] text-[#52525B] mb-3">按科目与资料规则化生成，<b>非 AI 正式分析</b>，用于先跑通结构。</p>
                  <button type="button" className={primaryCls} onClick={runGenerate}>{generated ? "重新生成" : "开始演示生成"}</button>
                </div>
                <div className="p-4 rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA] opacity-70">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-[#A1A1AA] text-white text-[11px] font-bold">AI 正式生成</span>
                    <span className="text-[12px] text-[#A1A1AA] font-bold">接入模型后可用</span>
                  </div>
                  <p className="text-[12px] text-[#71717A] mb-3">真题高频考点提取、七核聚合、图谱与计划——将由真实模型分析。</p>
                  <button type="button" className={primaryCls} disabled>暂不可用</button>
                </div>
              </div>

              {generated && (
                <div className="p-4 rounded-[10px] bg-[#F4F4F5]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-[#0F766E] text-white text-[11px] font-bold">演示生成</span>
                    <strong className="text-[13px] text-[#18181B]">已生成初始结构</strong>
                  </div>
                  <div className="flex gap-6 text-[13px] text-[#52525B]">
                    <span>知识节点 <b className="text-[#18181B]">{generated.nodes.length}</b></span>
                    <span>第一阶段任务 <b className="text-[#18181B]">{generated.tasks.length}</b></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 页脚导航 */}
        <div className="flex items-center gap-3 mt-5">
          {step === 1 ? (
            <button type="button" className="text-[13px] text-[#71717A] hover:text-[#18181B]" onClick={onLoadDemo}>试用示例数据（哈工大 / 828）</button>
          ) : (
            <button type="button" className={ghostCls} onClick={() => setStep((s) => s - 1)}>上一步</button>
          )}
          <div className="flex-1" />
          {(step === 3 || step === 4) && (
            <button type="button" className="text-[13px] text-[#71717A] hover:text-[#18181B]" onClick={() => (step === 4 ? finish() : setStep((s) => s + 1))}>跳过</button>
          )}
          {step < 4 ? (
            <button type="button" className={primaryCls} disabled={(step === 1 && !canNextFrom1) || (step === 2 && !canNextFrom2)} onClick={() => setStep((s) => s + 1)}>下一步</button>
          ) : (
            <button type="button" className={primaryCls} onClick={finish}>完成，进入工作台</button>
          )}
        </div>
      </div>
    </div>
  );
}
