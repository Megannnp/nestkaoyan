"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import type { AppSettings, ExamGoal, Subject } from "../lib/types";
import { NEW_SUBJECT_TEMPLATE, getDefaultMaxScore } from "../lib/subject-utils";
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState<Subject>(NEW_SUBJECT_TEMPLATE());
  // P3 交互修复（2026-08-01）：科目空名校验提示
  const [subjectNameError, setSubjectNameError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── 计算总分 ───
  const totalTargetScore = useMemo(() =>
    subjects.reduce((sum, s) => sum + (Number(s.targetScore) || 0), 0),
    [subjects]
  );
  const totalMaxScore = useMemo(() =>
    subjects.reduce((sum, s) => sum + (Number(s.maxScore) || 0), 0),
    [subjects]
  );

  // ─── 字段编辑辅助 ───
  const validateAndUpdateSubject = useCallback((
    id: string,
    field: string,
    value: string
  ) => {
    if (field === "targetScore") {
      const subject = subjects.find(s => s.id === id);
      if (!subject) return;
      const num = Number(value);
      const max = Number(subject.maxScore);
      // 不允许超过满分
      if (value !== "" && (isNaN(num) || num < 0)) return;
      if (num > max) {
        onUpdateSubject(id, { targetScore: subject.maxScore });
        return;
      }
    }
    if (field === "type") {
      const newMax = getDefaultMaxScore(value);
      onUpdateSubject(id, { type: value, maxScore: newMax });
      return;
    }
    onUpdateSubject(id, { [field]: value } as Partial<Subject>);
  }, [subjects, onUpdateSubject]);

  // ─── 新增科目 ───
  const handleAddSubject = useCallback(() => {
    // P3 交互修复：空名校验 + 重名校验，给出可见提示（不再静默 return）
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

  // ─── 删除科目 ───
  const handleConfirmDelete = useCallback((id: string) => {
    onRemoveSubject(id);
    setDeleteConfirmId(null);
  }, [onRemoveSubject]);

  // ─── AI 配置：布尔开关切换 ───
  const toggleAISetting = useCallback((field: keyof AppSettings) => {
    onUpdateAppSettings({ [field]: !appSettings[field] } as Partial<AppSettings>);
  }, [appSettings, onUpdateAppSettings]);

  // ─── 数据导入：选中文件 → 交给 page.tsx 处理 ───
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onImportData(file);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [onImportData]);

  const aiToggleRow = (label: string, field: keyof AppSettings, desc: string) => (
    <label className={styles.aiToggleRow}>
      <div>
        <div className={styles.aiToggleLabel}>{label}</div>
        <div className={styles.aiToggleDesc}>{desc}</div>
      </div>
      <input
        type="checkbox"
        checked={Boolean(appSettings[field])}
        onChange={() => toggleAISetting(field)}
        className={styles.aiToggleCheckbox}
      />
    </label>
  );

  // ─── 单个科目编辑内联 ───
  const EditableSubjectRow = ({ subject }: { subject: Subject }) => {
    const isEditing = editingSubjectId === subject.id;
    const isPendingDelete = deleteConfirmId === subject.id;

    return (
      <div data-testid={`subject-row-${subject.id}`} className={styles.subjectRowCard}>
        {/* 头部：名称 + 操作按钮 */}
        <div className={styles.subjectRowHead}>
          {isEditing ? (
            <input
              className={`${styles.inputField} ${styles.subjectRowInput}`}
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
          ) : (
            <strong className={styles.subjectRowName}>
              {subject.name || "未命名科目"}
            </strong>
          )}
          <div className={styles.subjectActions}>
            <button
              className={`${styles.secondaryBtn} ${styles.btnCompact}`}
              onClick={() => setEditingSubjectId(isEditing ? null : subject.id)}
            >
              {isEditing ? "完成" : "编辑"}
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

        {/* 字段网格 */}
        <div className={styles.settingsGridSubject}>
          {/* 类型 */}
          <div>
            <div className={styles.inputLabel}>类型</div>
            {isEditing ? (
              <select
                className={`${styles.selectBox} ${styles.subjectSelectFull} ${styles.settingsInputMarginSm}`}
                value={subject.type}
                onChange={(e) => validateAndUpdateSubject(subject.id, "type", e.target.value)}
              >
                <option value="公共课">公共课</option>
                <option value="专业课">专业课</option>
              </select>
            ) : (
              <div className={styles.valueSmall}>{subject.type}</div>
            )}
          </div>

          {/* 目标分数 / 满分 */}
          <div>
            <div className={styles.inputLabel}>目标分数</div>
            {isEditing ? (
              <div className={styles.scorePair}>
                <input
                  className={`${styles.inputField} ${styles.scoreInput}`}
                  type="number"
                  min="0"
                  max={subject.maxScore}
                  value={subject.targetScore}
                  onChange={(e) => validateAndUpdateSubject(subject.id, "targetScore", e.target.value)}
                />
                <span className={styles.scoreSlash}>/ {subject.maxScore}</span>
              </div>
            ) : (
              <div className={styles.valueStrong}>
                {subject.targetScore} / {subject.maxScore}
              </div>
            )}
          </div>

          {/* 轮次 */}
          <div>
            <div className={styles.inputLabel}>轮次</div>
            {isEditing ? (
              <select
                className={`${styles.selectBox} ${styles.subjectSelectFull} ${styles.settingsInputMarginSm}`}
                value={subject.round}
                onChange={(e) => onUpdateSubject(subject.id, { round: e.target.value })}
              >
                {["第一轮", "第二轮", "第三轮", "第四轮", "第五轮", "第六轮"].map(r =>
                  <option key={r} value={r}>{r}</option>
                )}
              </select>
            ) : (
              <div className={styles.valueSmall}>{subject.round}</div>
            )}
          </div>

          {/* 层级 */}
          <div>
            <div className={styles.inputLabel}>层级</div>
            {isEditing ? (
              <select
                className={`${styles.selectBox} ${styles.subjectSelectFull} ${styles.settingsInputMarginSm}`}
                value={subject.layer}
                onChange={(e) => onUpdateSubject(subject.id, { layer: e.target.value })}
              >
                {["Layer 1", "Layer 2", "Layer 3", "Layer 4"].map(l =>
                  <option key={l} value={l}>{l}</option>
                )}
              </select>
            ) : (
              <div className={styles.valueSmall}>{subject.layer}</div>
            )}
          </div>

          {/* 每周时长 */}
          <div>
            <div className={styles.inputLabel}>每周(h)</div>
            {isEditing ? (
              <input
                className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMarginSm}`}
                value={subject.weeklyHours}
                onChange={(e) => onUpdateSubject(subject.id, { weeklyHours: e.target.value })}
              />
            ) : (
              <div className={styles.valueSmall}>{subject.weeklyHours}h</div>
            )}
          </div>

          {/* 风险 */}
          <div>
            <div className={styles.inputLabel}>风险状态</div>
            <div className={`${styles.valueSmall} ${subject.risk === "高风险" ? styles.valueDanger : ""}`}>
              {subject.risk}
            </div>
          </div>
        </div>

        {/* 当前学习内容（仅在编辑时展开） */}
        {isEditing && (
          <div className={styles.currentProgressBlock}>
            <div className={styles.inputLabel}>当前学习内容</div>
            <input
              className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMarginSm}`}
              value={subject.currentProgress}
              onChange={(e) => onUpdateSubject(subject.id, { currentProgress: e.target.value })}
              placeholder="如：热力学第二定律"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.workspacePane}>
      {/* ═══ 区块1：考试基本信息 ═══ */}
      <div className={styles.settingsSection}>
        <div className={styles.sectionLabel}>考试信息</div>
        <h2 className={styles.settingsH2}>
          考试与科目设置
        </h2>

        {/* 顶部：总分目标 — 只读汇总 */}
        <div className={styles.totalTargetCard}>
          <div>
            <div className={styles.totalTargetLabel}>总分目标</div>
            <div className={`${styles.totalTargetValue} ${totalTargetScore <= totalMaxScore ? styles.totalTargetValueOk : styles.totalTargetValueDanger}`}>
              {totalTargetScore}
              <span className={styles.totalTargetSlash}> / {totalMaxScore}</span>
            </div>
          </div>
          <div className={styles.totalTargetSpacer} />
          <div className={styles.totalTargetNote}>
            来自 {subjects.length} 个科目 · 总分由各科目标自动相加
          </div>
        </div>

        {/* 考试基本信息网格 */}
        <div className={styles.settingsGridExam}>
          <div>
            <div className={styles.inputLabel}>考试名称</div>
            <input
              className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMargin}`}
              value={exam.examName}
              onChange={(e) => onUpdateExam({ examName: e.target.value })}
            />
          </div>
          <div>
            <div className={styles.inputLabel}>目标院校</div>
            <input
              className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMargin}`}
              value={exam.school}
              onChange={(e) => onUpdateExam({ school: e.target.value })}
            />
          </div>
          <div>
            <div className={styles.inputLabel}>学院 / 研究院</div>
            <input
              className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMargin}`}
              value={exam.major?.split(" ")[0] || ""}
              onChange={(e) => {
                const parts = exam.major?.split(" ") || [];
                parts[0] = e.target.value;
                onUpdateExam({ major: parts.join(" ") });
              }}
              placeholder="如：重庆研究院"
            />
          </div>
          <div>
            <div className={styles.inputLabel}>报考方向 / 专业</div>
            <input
              className={`${styles.inputField} ${styles.subjectSelectFull} ${styles.settingsInputMargin}`}
              value={exam.major}
              onChange={(e) => onUpdateExam({ major: e.target.value })}
              placeholder="如：828 物理化学"
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
      </div>

      {/* ═══ 区块2：考试科目 ═══ */}
      <div>
        <div className={styles.subjectRowHead}>
          <div>
            <div className={styles.sectionLabel}>科目设置</div>
            <h3 className={styles.settingsH3}>
              考试科目（{subjects.length}）
            </h3>
          </div>
          <button
            className={`${styles.primaryBtn} ${styles.btnMedium}`}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? "取消" : "+ 添加科目"}
          </button>
        </div>

        {/* 新增科目表单 */}
        {showAddForm && (
          <div className={styles.addFormBox}>
            <div className={styles.addFormTitle}>
              新增科目
            </div>
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
                  <span className={styles.scoreSlash}>/ {newSubject.maxScore}</span>
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

        {/* 科目列表 */}
        {subjects.length === 0 ? (
          <div className={styles.subjectEmpty}>
            暂无考试科目，点击“+ 添加科目”开始添加
          </div>
        ) : (
          <div className={styles.subjectList}>
            {subjects.map((subject) => (
              <EditableSubjectRow key={subject.id} subject={subject} />
            ))}
          </div>
        )}

        {/* 底部汇总 */}
        <div className={styles.subjectSummary}>
          总分 {totalTargetScore} / {totalMaxScore} · 共 {subjects.length} 个科目 ·
          修改任一科目目标后总分自动更新
        </div>
      </div>

      {/* ═══ 区块3：AI 助手配置（PRD 3.5）═══ */}
      <div className={styles.settingsSection}>
        <div className={styles.sectionLabel}>AI 助手配置</div>
        <h3 className={styles.settingsH3}>
          权限与行为（{appSettings.aiEnabled ? "已启用" : "已禁用"}）
        </h3>

        <div className={styles.aiConfigBox}>
          {aiToggleRow("启用 AI 学习助手", "aiEnabled", "关闭后 AI 建议与自动操作不再生效")}
          {aiToggleRow("AI 执行修改前需确认", "aiConfirmBeforeAction", "生成任务/更新图谱等操作前先征求用户同意")}
          {aiToggleRow("AI 识别后需用户确认", "aiConfirmAfterRecognition", "资料/真题识别结果不直接写入，等待确认")}
          {aiToggleRow("允许 AI 读取已上传资料", "aiReadUploads", "AI 可参考你上传的 PDF 与资料内容")}
          {aiToggleRow("允许 AI 参考学习记录", "aiReadStudyRecords", "AI 可读取学习时长、做题与复习记录")}
          {aiToggleRow("允许 AI 调整学习计划", "aiAdjustPlan", "AI 可根据掌握度自动重排每日任务")}
        </div>

        {/* 回答详细程度 */}
        <div className={styles.aiDetailRow}>
          <span className={styles.aiDetailLabel}>回答详细程度</span>
          <div className={styles.aiDetailButtons}>
            {(["简洁", "标准", "详细"] as const).map((detail) => (
              <button
                key={detail}
                className={`${appSettings.aiAnswerDetail === detail ? styles.primaryBtn : styles.secondaryBtn} ${styles.btnSmaller}`}
                onClick={() => onUpdateAppSettings({ aiAnswerDetail: detail })}
              >
                {detail}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.aiEngineNote}>
          当前引擎：{appSettings.aiProvider} · {appSettings.modelName} · 数据源：{appSettings.retrievalMode}
        </div>
      </div>

      {/* ═══ 区块4：数据管理（PRD 3.5 导入导出）═══ */}
      <div>
        <div className={styles.sectionLabel}>数据管理</div>
        <h3 className={styles.settingsH3}>
          JSON 备份与恢复
        </h3>

        <div className={styles.dataBox}>
          <p className={styles.dataDesc}>
            导出完整的考试目标、科目、资料、真题、卡片、任务与复习记录为 JSON 文件；
            导入后覆盖当前数据（导入前请先导出备份）。
          </p>
          <div className={styles.dataActions}>
            <button className={`${styles.primaryBtn} ${styles.btnMedium}`} onClick={onExportData}>
              ⬇️ 导出数据 (JSON)
            </button>
            <button className={`${styles.secondaryBtn} ${styles.btnMedium}`} onClick={() => fileInputRef.current?.click()}>
              ⬆️ 导入数据 (JSON)
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
      </div>
    </div>
  );
}
