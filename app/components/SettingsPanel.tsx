"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import type { AppSettings, ExamGoal, Subject } from "../lib/types";
import { NEW_SUBJECT_TEMPLATE, getDefaultMaxScore } from "../lib/subject-utils";
import { getStoredApiKey, setStoredApiKey } from "../lib/ai/chat-complete";
import { chatCompleteStream, chatErrorReason } from "../lib/ai/chat-complete";
import styles from "../../styles/components.module.css";

interface SettingsPanelProps {
  exam: ExamGoal;
  subjects: Subject[];
  appSettings: AppSettings;
  onUpdateExam: (patch: Partial<ExamGoal>) => void;
  onAddSubject: (subject: Subject) => void;
  onUpdateSubject: (id: string, patch: Partial<Subject>) => void;
  onRemoveSubject: (id: string) => void;
  onUpdateAppSettings: (patch: Partial<AppSettings>) => void;
  onExportData: () => void;
  onImportData: (file: File) => Promise<void>;
}

/** 设置二级页 id（null = 设置首页） */
type SettingsPage = "goal" | "ai" | "data" | "method" | null;

export function SettingsPanel({
  exam,
  subjects,
  appSettings,
  onUpdateExam,
  onAddSubject,
  onUpdateSubject,
  onRemoveSubject,
  onUpdateAppSettings,
  onExportData,
  onImportData,
}: SettingsPanelProps) {
  const [page, setPage] = useState<SettingsPage>(null);
  // 考试信息编辑态：false=展示信息；true=显示输入框
  const [examEditing, setExamEditing] = useState(false);
  // 科目编辑态：正在编辑的科目 id（null=全部展示态）
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubject, setNewSubject] = useState<Subject>(NEW_SUBJECT_TEMPLATE());
  const [subjectNameError, setSubjectNameError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ─── API Key 配置（与初始化向导一致：保存 + 真实 SSE 连接测试） ───
  const [apiKey, setApiKey] = useState(() => getStoredApiKey());
  const [testingKey, setTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const handleTestApiKey = useCallback(async () => {
    setTestingKey(true);
    setKeyStatus(null);
    try {
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
        : { ok: false, text: `连接失败（${chatErrorReason(result.error)}），密钥已保存` });
    } catch {
      setKeyStatus({ ok: false, text: "测试出错，密钥已保存" });
    } finally {
      setTestingKey(false);
    }
  }, [apiKey]);

  const totalTargetScore = useMemo(() =>
    subjects.reduce((sum, s) => sum + (Number(s.targetScore) || 0), 0),
    [subjects]
  );

  const handleAddSubject = useCallback(() => {
    if (!newSubject.name.trim()) {
      setSubjectNameError("科目名称不能为空");
      return;
    }
    if (subjects.some((s) => s.name.trim() === newSubject.name.trim())) {
      setSubjectNameError("已存在同名科目");
      return;
    }
    setSubjectNameError(null);
    const maxScore = getDefaultMaxScore(newSubject.type);
    const targetScore = Math.min(
      Number(newSubject.targetScore) || 70,
      Number(maxScore)
    ).toString();
    onAddSubject({
      ...newSubject,
      maxScore,
      targetScore,
    });
    setNewSubject(NEW_SUBJECT_TEMPLATE());
    setShowAddForm(false);
  }, [newSubject, subjects, onAddSubject]);

  const handleConfirmDelete = useCallback((id: string) => {
    onRemoveSubject(id);
    setDeleteConfirmId(null);
    setEditingSubjectId(null);
  }, [onRemoveSubject]);

  const toggleAISetting = useCallback((field: keyof AppSettings) => {
    onUpdateAppSettings({ [field]: !appSettings[field] } as Partial<AppSettings>);
  }, [appSettings, onUpdateAppSettings]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onImportData(file);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [onImportData]);

  const aiToggleRow = (label: string, field: keyof AppSettings) => (
    <label className={styles.aiToggleRow}>
      <div className={styles.aiToggleLabel}>{label}</div>
      <input
        type="checkbox"
        checked={Boolean(appSettings[field])}
        onChange={() => toggleAISetting(field)}
        className={styles.aiToggleCheckbox}
      />
    </label>
  );

  // ─── 单个科目卡：默认展示信息，点击「编辑」才出现输入框 ───
  const EditableSubjectRow = ({ subject }: { subject: Subject }) => {
    const isEditing = editingSubjectId === subject.id;
    const isPendingDelete = deleteConfirmId === subject.id;

    return (
      <div data-testid={`subject-row-${subject.id}`} className={styles.subjectCardCompact}>
        {/* 展示态：名称 + 目标/每周信息 + 编辑按钮 */}
        {!isEditing && (
          <>
            <div className={styles.subjectCardCompactHead}>
              <strong className={styles.subjectCardCompactName}>
                {subject.name || "未命名科目"}
              </strong>
              <button
                className={`${styles.secondaryBtn} ${styles.btnCompact}`}
                onClick={() => setEditingSubjectId(subject.id)}
              >
                编辑
              </button>
            </div>
            <div className={styles.subjectCardCompactStats}>
              <span>
                目标 <span className={styles.subjectCardCompactStatValue}>{subject.targetScore}</span>分
              </span>
              <span>
                每周 <span className={styles.subjectCardCompactStatValue}>{subject.weeklyHours}</span>小时
              </span>
            </div>
          </>
        )}

        {/* 编辑态：输入框 + 保存 / 删除 */}
        {isEditing && (
          <>
            <div className={styles.subjectCardCompactHead}>
              <strong className={styles.subjectCardCompactName}>
                编辑 {subject.name || "未命名科目"}
              </strong>
              <div className={styles.subjectActions}>
                <button
                  className={`${styles.primaryBtn} ${styles.btnCompact}`}
                  onClick={() => setEditingSubjectId(null)}
                >
                  保存
                </button>
                {isPendingDelete ? (
                  <>
                    <button
                      className={`${styles.primaryBtn} ${styles.btnCompact} ${styles.btnDanger}`}
                      onClick={() => handleConfirmDelete(subject.id)}
                    >
                      确认删除
                    </button>
                    <button
                      className={`${styles.secondaryBtn} ${styles.btnCompact}`}
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    className={`${styles.secondaryBtn} ${styles.btnCompact} ${styles.btnDangerText}`}
                    onClick={() => setDeleteConfirmId(subject.id)}
                  >
                    删除
                  </button>
                )}
              </div>
            </div>

            <div className={styles.subjectEditFields}>
              <div className={styles.inputLabel}>科目名称</div>
              <input
                className={`${styles.inputField} ${styles.subjectRowInput} ${styles.settingsInputMarginSm}`}
                value={subject.name}
                onChange={(e) => {
                  const name = e.target.value;
                  if (!name.trim()) {
                    setSubjectNameError("科目名称不能为空");
                    return;
                  }
                  setSubjectNameError(null);
                  onUpdateSubject(subject.id, { name });
                }}
                placeholder="科目名称"
              />

              <div className={`${styles.inputLabel} ${styles.inputLabelMarginTop}`}>目标分数（满分 {subject.maxScore}）</div>
              <div className={styles.scorePair}>
                <input
                  className={`${styles.inputField} ${styles.scoreInput}`}
                  type="number"
                  min="0"
                  max={subject.maxScore}
                  value={subject.targetScore}
                  onChange={(e) => {
                    const value = e.target.value;
                    const num = Number(value);
                    if (value !== "" && (isNaN(num) || num < 0)) return;
                    if (num > Number(subject.maxScore)) {
                      onUpdateSubject(subject.id, { targetScore: subject.maxScore });
                      return;
                    }
                    onUpdateSubject(subject.id, { targetScore: value });
                  }}
                />
                <span className={styles.scoreSlash}>/ {subject.maxScore} 分</span>
              </div>

              <div className={`${styles.inputLabel} ${styles.inputLabelMarginTop}`}>每周时长（小时）</div>
              <input
                className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMarginSm}`}
                value={subject.weeklyHours}
                onChange={(e) => onUpdateSubject(subject.id, { weeklyHours: e.target.value })}
              />

              {subjectNameError && (
                <div className={styles.addFormError}>⚠️ {subjectNameError}</div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // ─── 二级页：考试设置（默认展示信息，点击「编辑」出现输入框） ───
  const goalView = (
    <>
      <div className={styles.settingsDetailHeader}>
        <div className={styles.settingsDetailTitle}>考试设置</div>
        <div className={styles.subjectActions}>
          <button className={styles.settingsCloseBtn} onClick={() => setPage(null)} aria-label="关闭">✕</button>
        </div>
      </div>

      {/* 考试信息：展示态 / 编辑态 */}
      {!examEditing ? (
        <div className={styles.profileExamInfoList}>
          <div className={styles.examInfoRow}>
            <span className={styles.examInfoLabel}>考试</span>
            <span className={styles.examInfoValue}>{exam.examName || "未命名考试"}</span>
          </div>
          <div className={styles.examInfoRow}>
            <span className={styles.examInfoLabel}>报考专业</span>
            <span className={styles.examInfoValue}>{exam.school && exam.major ? `${exam.school} · ${exam.major}` : exam.school || exam.major || "未填写"}</span>
          </div>
          <div className={styles.examInfoRow}>
            <span className={styles.examInfoLabel}>考试日期</span>
            <span className={styles.examInfoValue}>{exam.examDate || "未设置"}</span>
          </div>
          <div className={styles.examInfoActions}>
            <button
              className={`${styles.secondaryBtn} ${styles.btnCompact}`}
              onClick={() => setExamEditing(true)}
            >
              编辑
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.settingsSection}>
          <div className={styles.sectionLabel}>我的考试</div>
          <div className={styles.settingsGridExam}>
            <div>
              <div className={styles.inputLabel}>考试名称</div>
              <input
                className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMargin}`}
                value={exam.examName}
                onChange={(e) => onUpdateExam({ examName: e.target.value })}
                placeholder="如：2027 考研初试"
              />
            </div>
            <div>
              <div className={styles.inputLabel}>目标院校</div>
              <input
                className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMargin}`}
                value={exam.school}
                onChange={(e) => onUpdateExam({ school: e.target.value })}
                placeholder="如：哈尔滨工业大学"
              />
            </div>
            <div>
              <div className={styles.inputLabel}>报考专业</div>
              <input
                className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMargin}`}
                value={exam.major}
                onChange={(e) => onUpdateExam({ major: e.target.value })}
                placeholder="如：数学二"
              />
            </div>
            <div>
              <div className={styles.inputLabel}>考试日期</div>
              <input
                className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMargin}`}
                type="date"
                value={exam.examDate}
                onChange={(e) => onUpdateExam({ examDate: e.target.value })}
              />
            </div>
          </div>
          <div className={styles.examEditActions}>
            <button
              className={`${styles.primaryBtn} ${styles.btnSmall}`}
              onClick={() => setExamEditing(false)}
            >
              保存
            </button>
            <button
              className={`${styles.secondaryBtn} ${styles.btnSmall}`}
              onClick={() => setExamEditing(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 目标总分摘要 */}
      <div className={styles.profileExamCard}>
        <div className={styles.totalTargetLabel}>目标总分</div>
        <div className={styles.totalTargetValuePlain}>
          {totalTargetScore}<span className={styles.totalTargetUnit}>分</span>
        </div>
      </div>

      {/* 考试科目列表 */}
      <div>
        <div className={styles.sectionLabel}>考试科目</div>
        <div className={`${styles.subjectList} ${styles.subjectListMarginTop}`}>
          {subjects.length === 0 ? (
            <div className={styles.subjectEmpty}>
              暂无考试科目，点击下方「+ 添加科目」
            </div>
          ) : (
            subjects.map((subject) => (
              <EditableSubjectRow key={subject.id} subject={subject} />
            ))
          )}
        </div>

        {/* 添加科目（弱化按钮，放列表底部） */}
        {!showAddForm ? (
          <button
            className={`${styles.secondaryBtn} ${styles.btnMedium}`}
            onClick={() => setShowAddForm(true)}
          >
            + 添加科目
          </button>
        ) : (
          <div className={styles.addFormBox}>
            <div className={styles.addFormTitle}>新增科目</div>
            {subjectNameError && (
              <div className={styles.addFormError}>⚠️ {subjectNameError}</div>
            )}
            <div className={styles.settingsGridAddForm}>
              <div>
                <div className={styles.inputLabel}>科目名称</div>
                <input
                  className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMarginSm}`}
                  value={newSubject.name}
                  onChange={(e) => setNewSubject(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="如：政治"
                />
              </div>
              <div>
                <div className={styles.inputLabel}>类型</div>
                <select
                  className={`${styles.selectBox} ${styles.subjectSelectFull} ${styles.settingsInputMarginSm}`}
                  value={newSubject.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    const maxScore = getDefaultMaxScore(type);
                    setNewSubject(prev => ({
                      ...prev,
                      type,
                      maxScore,
                      targetScore: String(Math.min(Number(prev.targetScore) || 70, Number(maxScore))),
                    }));
                  }}
                >
                  <option value="公共课">公共课</option>
                  <option value="专业课">专业课</option>
                </select>
              </div>
              <div>
                <div className={styles.inputLabel}>目标分数</div>
                <div className={styles.scorePair}>
                  <input
                    className={`${styles.inputField} ${styles.scoreInputSm}`}
                    type="number"
                    min="0"
                    max={newSubject.maxScore}
                    value={newSubject.targetScore}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = Number(v);
                      const max = Number(newSubject.maxScore);
                      if (num > max) {
                        setNewSubject(prev => ({ ...prev, targetScore: max.toString() }));
                      } else {
                        setNewSubject(prev => ({ ...prev, targetScore: v }));
                      }
                    }}
                  />
                  <span className={styles.scoreSlash}>/ {newSubject.maxScore} 分</span>
                </div>
              </div>
            </div>
            <div className={styles.addFormActions}>
              <button className={`${styles.primaryBtn} ${styles.btnSmall}`} onClick={() => { setSubjectNameError(null); handleAddSubject(); }}>
                确认添加
              </button>
              <button className={`${styles.secondaryBtn} ${styles.btnSmall}`} onClick={() => setShowAddForm(false)}>
                取消
              </button>
            </div>
          </div>
        )}

        <div className={styles.subjectSummary}>
          目标总分 {totalTargetScore} 分 · 共 {subjects.length} 个科目
        </div>
      </div>
    </>
  );

  // ─── 二级页：AI 学习助手（精简开关） ───
  const aiView = (
    <>
      <div className={styles.settingsDetailHeader}>
        <div className={styles.settingsDetailTitle}>AI 学习助手</div>
        <button className={styles.settingsCloseBtn} onClick={() => setPage(null)} aria-label="关闭">✕</button>
      </div>

      {/* 扁平化布局（2026-08-05 用户反馈：去掉模块套模块，延续极简风格） */}
      <div className={styles.settingsSection}>
        {/* API Key */}
        <div className={styles.inputLabel}>DeepSeek API Key</div>
        <input
          className={`${styles.inputField} ${styles.settingsInputMarginSm}`}
          type="password"
          autoComplete="off"
          placeholder="sk-…（在 https://platform.deepseek.com/api_keys 申请）"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setKeyStatus(null); }}
        />
        <div className={styles.dataActions}>
          <button className={`${styles.primaryBtn} ${styles.btnSmall}`} disabled={!apiKey.trim() || testingKey} onClick={handleTestApiKey}>
            {testingKey ? "测试连接中…" : "保存并测试连接"}
          </button>
          {apiKey.trim() && (
            <button
              className={`${styles.secondaryBtn} ${styles.btnSmall}`}
              onClick={() => { setApiKey(""); setStoredApiKey(""); setKeyStatus(null); }}
            >
              清除
            </button>
          )}
        </div>
        {keyStatus && (
          <p className={`text-[13px] mb-2 font-bold ${keyStatus.ok ? "text-[#18181B]" : "text-[#EF4444]"}`}>
            {keyStatus.text}
          </p>
        )}
      </div>

      <div className={styles.settingsSection}>
        {/* AI 回答详细程度 */}
        <div className={styles.aiDetailRow}>
          <span className={styles.aiDetailLabel}>AI 回答详细程度</span>
          <div className={styles.aiDetailButtons}>
            {(["简洁", "标准", "详细"] as const).map((level) => (
              <button
                key={level}
                onClick={() => onUpdateAppSettings({ aiAnswerDetail: level })}
                className={`${styles.navTab} ${(appSettings.aiAnswerDetail || "标准") === level ? styles.navTabActive : styles.navTabInactive}`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.settingsSection}>
        {/* AI 行为开关：扁平列表，不做嵌套卡片 */}
        {aiToggleRow("自动安排学习", "aiEnabled")}
        {aiToggleRow("修改前询问", "aiConfirmBeforeAction")}
        {aiToggleRow("识别资料后确认", "aiConfirmAfterRecognition")}
        {aiToggleRow("参考已上传资料", "aiReadUploads")}
        {aiToggleRow("参考学习记录", "aiReadStudyRecords")}
        {aiToggleRow("自动调整计划", "aiAdjustPlan")}
      </div>
    </>
  );

  // ─── 二级页：数据管理 ───
  const dataView = (
    <>
      <div className={styles.settingsDetailHeader}>
        <div className={styles.settingsDetailTitle}>数据管理</div>
        <button className={styles.settingsCloseBtn} onClick={() => setPage(null)} aria-label="关闭">✕</button>
      </div>

      <div className={styles.settingsSection}>
        <p className={styles.dataMgmtHint}>
          数据保存在本机浏览器（localStorage / IndexedDB），换设备或清理浏览器缓存会丢失。建议定期导出备份。
        </p>
        <div className={styles.dataActions}>
          <button className={`${styles.primaryBtn} ${styles.btnMedium}`} onClick={onExportData}>
            ⬇️ 导出学习档案
          </button>
          <button className={`${styles.secondaryBtn} ${styles.btnMedium}`} onClick={() => fileInputRef.current?.click()}>
            ⬆️ 导入数据
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className={styles.hiddenFileInput}
            onChange={handleFileChange}
          />
        </div>
      </div>
    </>
  );

  // ─── 二级页：学习方法（内置学习系统说明，7 个区块） ───
  const methodView = (
    <>
      <div className={styles.settingsDetailHeader}>
        <div className={styles.settingsDetailTitle}>学习方法</div>
        <button className={styles.settingsCloseBtn} onClick={() => setPage(null)} aria-label="关闭">✕</button>
      </div>

      <div className={styles.settingsSection}>
        <p className={styles.methodIntro}>
          这套系统不只是「打卡 + 记事本」，它内置了一套完整的学习方法。先看目标要什么，再层层展开、逐轮巩固，
          每一步都有 AI 帮你盯着。下面从头讲清楚它是怎么帮你学的。
        </p>
      </div>

      {/* 1. 逆向设计 */}
      <div className={styles.methodSection}>
        <div className={styles.methodTitle}>1 · 逆向设计：先看目标，再安排学习</div>
        <p className={styles.methodBody}>
          传统学习是「拿到教材从第一章开始」，这套系统反过来：先看考试要什么，再回头安排学习。
          真题和大纲定方向——告诉你考什么、怎么考；教材帮助理解——把考点讲透；教辅拓展深化——补充练习与延伸。
          所有材料按「谁服务谁」组织，优先学真题反复考、分值大的内容，而不是平均用力。
        </p>
      </div>

      {/* 2. 7 核 */}
      <div className={styles.methodSection}>
        <div className={styles.methodTitle}>2 · 7 核：一周走一遍全局</div>
        <p className={styles.methodBody}>
          从真题中抽出统领全科的七个核心，一天攻克一个，一周走完一遍。
          快速摸清整门课的骨架，避免「第一章学了三周、后面没时间」的失衡。
          之后每一轮复习都可以用 7 核作为主线反复加固。
        </p>
      </div>

      {/* 3. 4 层 */}
      <div className={styles.methodSection}>
        <div className={styles.methodTitle}>3 · 4 层：从「知道」到「会用」</div>
        <p className={styles.methodBody}>
          每个知识点按四层递进学习：理解（看懂是什么）→ 展开（弄清来龙去脉）→ 练习（会做基础题）→ 综合（能用于整卷答题）。
          四周四层，一层一过关，不赶进度，每层都留足练习时间。
        </p>
      </div>

      {/* 4. 6 轮 */}
      <div className={styles.methodSection}>
        <div className={styles.methodTitle}>4 · 6 轮：循环推进，一轮比一轮快</div>
        <p className={styles.methodBody}>
          整门课整体过 6 轮：打底 → 连线 → 补漏 → 提速 → 真题 → 冲刺，一月一轮是标准节奏。
          每一轮都在上一轮基础上加快，前几轮慢而全，后几轮快而准。
          时间紧也没关系：按剩余天数倒推轮次，压缩到能做几轮就做几轮，系统会重新排期。
        </p>
      </div>

      {/* 5. 知识图谱 + 学习者模型 */}
      <div className={styles.methodSection}>
        <div className={styles.methodTitle}>5 · 知识图谱 + 学习者模型：学没学会，有数</div>
        <p className={styles.methodBody}>
          所有知识点被连成一张「谁依赖谁」的网：先修知识点没掌握，后续内容学了也容易塌。
          每个知识点都有一张掌握度快照：当前掌握度、近期变化、遗忘风险、下次复习时间。
          该复习哪个、哪些可以跳过，系统按你的真实状态算，不靠感觉。
        </p>
      </div>

      {/* 6. 动态计划 + Agent 闭环 */}
      <div className={styles.methodSection}>
        <div className={styles.methodTitle}>6 · 动态计划 + Agent 闭环：AI 每天帮你推理</div>
        <p className={styles.methodBody}>
          计划不是排一次就死掉：AI 综合你的目标、知识图谱状态、剩余时间，推理今天到底该做什么，
          每天都给出可执行的任务。学习前明确学什么，学习中随时记录，学习后 AI 分析效果并更新状态，
          形成「计划 → 执行 → 反馈 → 调整」的闭环。
        </p>
      </div>

      {/* 7. 适合哪些考试 */}
      <div className={styles.methodSection}>
        <div className={styles.methodTitle}>7 · 适合哪些考试</div>
        <ul className={styles.methodList}>
          <li><strong>最适合：</strong>成体系、需要背诵的科目（专业课、政治等）——图谱和掌握度模型作用最大。</li>
          <li><strong>部分适合：</strong>英语等需要长期积累的科目——背单词、长难句可以用 7 核与多轮循环，但手感型内容需额外配合刷题。</li>
          <li><strong>不适合：</strong>靠临场手感发挥的题型——系统不擅长替代「大量随机练习」建立的手感。</li>
        </ul>
      </div>
    </>
  );

  // ══════════════════════════════════════
  // 设置首页：入口列表
  // ══════════════════════════════════════
  if (page === null) {
    return (
      <div className={styles.workspacePane}>
        <div className={styles.profileTitle}>设置</div>
        <div className={styles.profileSubtitle}>选择你要调整的内容</div>

        <div className={styles.settingsNavList}>
          <button className={styles.settingsNavItem} onClick={() => setPage("goal")}>
            <span className={styles.settingsNavIcon}>🎯</span>
            <span className={styles.settingsNavBody}>
              <span className={styles.settingsNavTitle}>我的目标</span>
              <span className={styles.settingsNavDesc}>
                考试、院校、科目分数 · 目标总分 {totalTargetScore} 分 · 考试日期 {exam.examDate ? "已设置" : "未设置"}
              </span>
            </span>
            <span className={styles.settingsNavArrow}>›</span>
          </button>

          <button className={styles.settingsNavItem} onClick={() => setPage("ai")}>
            <span className={styles.settingsNavIcon}>🤖</span>
            <span className={styles.settingsNavBody}>
              <span className={styles.settingsNavTitle}>AI 学习助手</span>
              <span className={styles.settingsNavDesc}>
                AI 参与学习规划 · 当前{appSettings.aiEnabled ? "已开启" : "已关闭"}
              </span>
            </span>
            <span className={styles.settingsNavArrow}>›</span>
          </button>

          <button className={styles.settingsNavItem} onClick={() => setPage("data")}>
            <span className={styles.settingsNavIcon}>📦</span>
            <span className={styles.settingsNavBody}>
              <span className={styles.settingsNavTitle}>数据管理</span>
              <span className={styles.settingsNavDesc}>导出 / 导入学习档案</span>
            </span>
            <span className={styles.settingsNavArrow}>›</span>
          </button>

          <button className={styles.settingsNavItem} onClick={() => setPage("method")}>
            <span className={styles.settingsNavIcon}>🧭</span>
            <span className={styles.settingsNavBody}>
              <span className={styles.settingsNavTitle}>学习方法</span>
              <span className={styles.settingsNavDesc}>7核 · 4层 · 6轮 · 这套系统怎么帮你学</span>
            </span>
            <span className={styles.settingsNavArrow}>›</span>
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  // 弹窗渲染
  // ══════════════════════════════════════
  return (
    <div className={styles.modalBackdrop} onClick={() => setPage(null)}>
      <div className={styles.settingsModalPanel} onClick={(e) => e.stopPropagation()}>
        {page === "goal" && goalView}
        {page === "ai" && aiView}
        {page === "data" && dataView}
        {page === "method" && methodView}
      </div>
    </div>
  );
}