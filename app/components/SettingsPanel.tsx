"use client";

import { useState, useCallback, useMemo } from "react";
import type { ExamGoal, Subject } from "../lib/types";
import { NEW_SUBJECT_TEMPLATE, getDefaultMaxScore } from "../lib/subject-utils";
import styles from "../../styles/components.module.css";

interface SettingsPanelProps {
  exam: ExamGoal;
  subjects: Subject[];
  onUpdateExam: (patch: Partial<ExamGoal>) => void;
  onAddSubject: (subject: Subject) => void;
  onUpdateSubject: (id: string, patch: Partial<Subject>) => void;
  onRemoveSubject: (id: string) => void;
}

export function SettingsPanel({
  exam,
  subjects,
  onUpdateExam,
  onAddSubject,
  onUpdateSubject,
  onRemoveSubject,
}: SettingsPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState<Subject>(NEW_SUBJECT_TEMPLATE());

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
    if (!newSubject.name.trim()) return;
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
  }, [newSubject, onAddSubject]);

  // ─── 删除科目 ───
  const handleConfirmDelete = useCallback((id: string) => {
    onRemoveSubject(id);
    setDeleteConfirmId(null);
  }, [onRemoveSubject]);

  // ─── 单个科目编辑内联 ───
  const EditableSubjectRow = ({ subject }: { subject: Subject }) => {
    const isEditing = editingSubjectId === subject.id;
    const isPendingDelete = deleteConfirmId === subject.id;

    return (
      <div style={{
        padding: "14px",
        border: "1px solid #E4E4E7",
        borderRadius: "8px",
        background: "#fff",
      }}>
        {/* 头部：名称 + 操作按钮 */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}>
          {isEditing ? (
            <input
              className={styles.inputField}
              style={{ width: "160px", fontSize: "13px" }}
              value={subject.name}
              onChange={(e) => onUpdateSubject(subject.id, { name: e.target.value })}
              placeholder="科目名称"
            />
          ) : (
            <strong style={{ fontSize: "14px", color: "#18181B" }}>
              {subject.name || "未命名科目"}
            </strong>
          )}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              className={styles.secondaryBtn}
              style={{ minHeight: "26px", fontSize: "11px", padding: "0 10px" }}
              onClick={() => setEditingSubjectId(isEditing ? null : subject.id)}
            >
              {isEditing ? "完成" : "编辑"}
            </button>
            {isPendingDelete ? (
              <>
                <button
                  className={styles.primaryBtn}
                  style={{ minHeight: "26px", fontSize: "11px", padding: "0 10px", background: "#EF4444" }}
                  onClick={() => handleConfirmDelete(subject.id)}
                >
                  确认删除
                </button>
                <button
                  className={styles.secondaryBtn}
                  style={{ minHeight: "26px", fontSize: "11px", padding: "0 10px" }}
                  onClick={() => setDeleteConfirmId(null)}
                >
                  取消
                </button>
              </>
            ) : (
              <button
                className={styles.secondaryBtn}
                style={{ minHeight: "26px", fontSize: "11px", padding: "0 10px", color: "#EF4444" }}
                onClick={() => setDeleteConfirmId(subject.id)}
              >
                删除
              </button>
            )}
          </div>
        </div>

        {/* 字段网格 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: "8px",
        }}>
          {/* 类型 */}
          <div>
            <div className={styles.inputLabel}>类型</div>
            {isEditing ? (
              <select
                className={styles.selectBox}
                style={{ width: "100%", marginTop: "2px" }}
                value={subject.type}
                onChange={(e) => validateAndUpdateSubject(subject.id, "type", e.target.value)}
              >
                <option value="公共课">公共课</option>
                <option value="专业课">专业课</option>
              </select>
            ) : (
              <div style={{ fontSize: "12px", color: "#71717A", marginTop: "2px" }}>{subject.type}</div>
            )}
          </div>

          {/* 目标分数 / 满分 */}
          <div>
            <div className={styles.inputLabel}>目标分数</div>
            {isEditing ? (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                <input
                  className={styles.inputField}
                  style={{ width: "56px", fontSize: "12px", textAlign: "center", minHeight: "30px" }}
                  type="number"
                  min="0"
                  max={subject.maxScore}
                  value={subject.targetScore}
                  onChange={(e) => validateAndUpdateSubject(subject.id, "targetScore", e.target.value)}
                />
                <span style={{ fontSize: "11px", color: "#A1A1AA" }}>/ {subject.maxScore}</span>
              </div>
            ) : (
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#18181B", marginTop: "2px" }}>
                {subject.targetScore} / {subject.maxScore}
              </div>
            )}
          </div>

          {/* 轮次 */}
          <div>
            <div className={styles.inputLabel}>轮次</div>
            {isEditing ? (
              <select
                className={styles.selectBox}
                style={{ width: "100%", marginTop: "2px" }}
                value={subject.round}
                onChange={(e) => onUpdateSubject(subject.id, { round: e.target.value })}
              >
                {["第一轮", "第二轮", "第三轮", "第四轮", "第五轮", "第六轮"].map(r =>
                  <option key={r} value={r}>{r}</option>
                )}
              </select>
            ) : (
              <div style={{ fontSize: "12px", color: "#71717A", marginTop: "2px" }}>{subject.round}</div>
            )}
          </div>

          {/* 层级 */}
          <div>
            <div className={styles.inputLabel}>层级</div>
            {isEditing ? (
              <select
                className={styles.selectBox}
                style={{ width: "100%", marginTop: "2px" }}
                value={subject.layer}
                onChange={(e) => onUpdateSubject(subject.id, { layer: e.target.value })}
              >
                {["Layer 1", "Layer 2", "Layer 3", "Layer 4"].map(l =>
                  <option key={l} value={l}>{l}</option>
                )}
              </select>
            ) : (
              <div style={{ fontSize: "12px", color: "#71717A", marginTop: "2px" }}>{subject.layer}</div>
            )}
          </div>

          {/* 每周时长 */}
          <div>
            <div className={styles.inputLabel}>每周(h)</div>
            {isEditing ? (
              <input
                className={styles.inputField}
                style={{ width: "100%", fontSize: "12px", marginTop: "2px", minHeight: "30px" }}
                value={subject.weeklyHours}
                onChange={(e) => onUpdateSubject(subject.id, { weeklyHours: e.target.value })}
              />
            ) : (
              <div style={{ fontSize: "12px", color: "#71717A", marginTop: "2px" }}>{subject.weeklyHours}h</div>
            )}
          </div>

          {/* 风险 */}
          <div>
            <div className={styles.inputLabel}>风险状态</div>
            <div style={{ fontSize: "12px", color: subject.risk === "高风险" ? "#EF4444" : "#71717A", marginTop: "2px" }}>
              {subject.risk}
            </div>
          </div>
        </div>

        {/* 当前学习内容（仅在编辑时展开） */}
        {isEditing && (
          <div style={{ marginTop: "8px" }}>
            <div className={styles.inputLabel}>当前学习内容</div>
            <input
              className={styles.inputField}
              style={{ width: "100%", fontSize: "12px", marginTop: "2px", minHeight: "30px" }}
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
      <div style={{ marginBottom: "28px" }}>
        <div className={styles.sectionLabel}>考试信息</div>
        <h2 style={{ margin: "4px 0 16px", fontSize: "20px", fontWeight: 700, color: "#18181B" }}>
          考试与科目设置
        </h2>

        {/* 顶部：总分目标 — 只读汇总 */}
        <div style={{
          padding: "16px",
          borderRadius: "10px",
          background: "#F4F4F5",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: "11px", color: "#71717A", fontWeight: 700 }}>总分目标</div>
            <div style={{ fontSize: "26px", fontWeight: 700, color: totalTargetScore <= totalMaxScore ? "#18181B" : "#EF4444" }}>
              {totalTargetScore}
              <span style={{ fontSize: "16px", color: "#A1A1AA", fontWeight: 400 }}> / {totalMaxScore}</span>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: "12px", color: "#71717A" }}>
            来自 {subjects.length} 个科目 · 总分由各科目标自动相加
          </div>
        </div>

        {/* 考试基本信息网格 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "12px",
        }}>
          <div>
            <div className={styles.inputLabel}>考试名称</div>
            <input
              className={styles.inputField}
              style={{ width: "100%", marginTop: "4px" }}
              value={exam.examName}
              onChange={(e) => onUpdateExam({ examName: e.target.value })}
            />
          </div>
          <div>
            <div className={styles.inputLabel}>目标院校</div>
            <input
              className={styles.inputField}
              style={{ width: "100%", marginTop: "4px" }}
              value={exam.school}
              onChange={(e) => onUpdateExam({ school: e.target.value })}
            />
          </div>
          <div>
            <div className={styles.inputLabel}>学院 / 研究院</div>
            <input
              className={styles.inputField}
              style={{ width: "100%", marginTop: "4px" }}
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
              className={styles.inputField}
              style={{ width: "100%", marginTop: "4px" }}
              value={exam.major}
              onChange={(e) => onUpdateExam({ major: e.target.value })}
              placeholder="如：828 物理化学"
            />
          </div>
          <div>
            <div className={styles.inputLabel}>考试日期</div>
            <input
              className={styles.inputField}
              style={{ width: "100%", marginTop: "4px" }}
              type="date"
              value={exam.examDate}
              onChange={(e) => onUpdateExam({ examDate: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* ═══ 区块2：考试科目 ═══ */}
      <div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}>
          <div>
            <div className={styles.sectionLabel}>科目设置</div>
            <h3 style={{ margin: "2px 0 0", fontSize: "15px", fontWeight: 700, color: "#18181B" }}>
              考试科目（{subjects.length}）
            </h3>
          </div>
          <button
            className={styles.primaryBtn}
            style={{ minHeight: "32px", fontSize: "12px" }}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? "取消" : "+ 添加科目"}
          </button>
        </div>

        {/* 新增科目表单 */}
        {showAddForm && (
          <div style={{
            padding: "14px",
            border: "1px solid #18181B",
            borderRadius: "8px",
            background: "#F4F4F5",
            marginBottom: "12px",
          }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#18181B", marginBottom: "8px" }}>
              新增科目
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "8px",
              marginBottom: "10px",
            }}>
              <div>
                <div className={styles.inputLabel}>科目名称</div>
                <input
                  className={styles.inputField}
                  style={{ width: "100%", marginTop: "2px", minHeight: "30px", fontSize: "12px" }}
                  value={newSubject.name}
                  onChange={(e) => setNewSubject(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="如：政治"
                />
              </div>
              <div>
                <div className={styles.inputLabel}>类型</div>
                <select
                  className={styles.selectBox}
                  style={{ width: "100%", marginTop: "2px" }}
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
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                  <input
                    className={styles.inputField}
                    style={{ width: "50px", fontSize: "12px", textAlign: "center", minHeight: "30px" }}
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
                  <span style={{ fontSize: "11px", color: "#A1A1AA" }}>/ {newSubject.maxScore}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button className={styles.primaryBtn} style={{ minHeight: "30px", fontSize: "12px" }} onClick={handleAddSubject}>
                确认添加
              </button>
              <button className={styles.secondaryBtn} style={{ minHeight: "30px", fontSize: "12px" }} onClick={() => setShowAddForm(false)}>
                取消
              </button>
            </div>
          </div>
        )}

        {/* 科目列表 */}
        {subjects.length === 0 ? (
          <div style={{
            padding: "24px",
            textAlign: "center",
            color: "#A1A1AA",
            fontSize: "13px",
            border: "1px dashed #D4D4D8",
            borderRadius: "8px",
          }}>
            暂无考试科目，点击“+ 添加科目”开始添加
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {subjects.map((subject) => (
              <EditableSubjectRow key={subject.id} subject={subject} />
            ))}
          </div>
        )}

        {/* 底部汇总 */}
        <div style={{
          marginTop: "14px",
          padding: "12px",
          borderRadius: "8px",
          background: "#F4F4F5",
          fontSize: "12px",
          color: "#71717A",
          textAlign: "center",
        }}>
          总分 {totalTargetScore} / {totalMaxScore} · 共 {subjects.length} 个科目 ·
          修改任一科目目标后总分自动更新
        </div>
      </div>
    </div>
  );
}