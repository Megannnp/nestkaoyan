# -*- coding: utf-8 -*-
"""精确修补 page.tsx：插入导入导出函数 + 接线 SettingsPanel 新 props + 卡片多模式切换"""
import re

PATH = "app/page.tsx"

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

changed = []

# ─────────────────────────────────────────────
# 1. 插入 handleExportData / handleImportData 函数
#    锚点：restoreLastDeleted 之后、Onboarding 之前
# ─────────────────────────────────────────────
anchor1 = '''    setLastDeleted(null);
    setNotice(`已恢复：${backup.label}`);
  }

  // ─── Onboarding：完成向导'''

functions = '''    setLastDeleted(null);
    setNotice(`已恢复：${backup.label}`);
  }

  // ─── 数据导出（PRD 3.5 JSON 备份）───
  function handleExportData() {
    try {
      const snapshot = {
        exportedAt: new Date().toISOString(),
        appName: "筑巢考研工作台",
        storageVersion: 6,
        exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject,
        resources, materials, materialSections, questions, nodes, tasks, pending, notes, cards,
        annotations, studyDays, agentSteps, logs, chatSessions, activeSessionId, review, structuredReviews,
        cardCategories: categories,
      };
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kaoyan-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setNotice("已导出完整数据备份 (JSON)");
    } catch (error) {
      console.error("[Export] 导出失败", error);
      setNotice("导出失败，请重试");
    }
  }

  // ─── 数据导入（PRD 3.5 JSON 恢复）：写入 localStorage 后刷新，由 mount hydrate 统一恢复 ───
  async function handleImportData(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      if (!data || typeof data !== "object" || !Array.isArray(data.subjects)) {
        setNotice("导入失败：不是有效的备份文件（缺少 subjects 字段）");
        return;
      }
      const written = saveWorkspace({
        ...(data as Record<string, unknown>),
        storageVersion: 6,
        onboardingCompleted: data.onboardingCompleted ?? true,
      } as never);
      if (!written) {
        setNotice("导入失败：无法写入本地存储（可能磁盘版本更高或配额已满）");
        return;
      }
      setNotice("导入成功，正在刷新恢复数据…");
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      console.error("[Import] 导入失败", error);
      setNotice("导入失败：文件不是有效的 JSON 备份");
    }
  }

  // ─── Onboarding：完成向导'''

if anchor1 in content:
    content = content.replace(anchor1, functions, 1)
    changed.append("导入导出函数已插入")
else:
    print("ERROR: 锚点1未找到（导入导出函数）")

# ─────────────────────────────────────────────
# 2. cardMode：常量 → 可切换状态
# ─────────────────────────────────────────────
old_card_mode = 'const [cardMode] = useState("背诵");'
new_card_mode = 'const [cardMode, setCardMode] = useState("背诵");'
if old_card_mode in content:
    content = content.replace(old_card_mode, new_card_mode, 1)
    changed.append("cardMode setter 已添加")
else:
    print("ERROR: cardMode 声明未找到")

# ─────────────────────────────────────────────
# 3. 接线 SettingsPanel：新增 appSettings / onUpdateAppSettings / onExportData / onImportData
# ─────────────────────────────────────────────
old_settings = '''          <SettingsPanel
            exam={exam}
            subjects={subjects}
            onUpdateExam={(patch) => setExam((prev) => ({ ...prev, ...patch }))}
            onAddSubject={(subject) => setSubjects((prev) => [...prev, subject])}
            onUpdateSubject={(id, patch) => setSubjects((prev) =>
              prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
            )}
            onRemoveSubject={(id) => setSubjects((prev) => prev.filter((s) => s.id !== id))}
          />'''

new_settings = '''          <SettingsPanel
            exam={exam}
            subjects={subjects}
            appSettings={appSettings}
            onUpdateExam={(patch) => setExam((prev) => ({ ...prev, ...patch }))}
            onAddSubject={(subject) => setSubjects((prev) => [...prev, subject])}
            onUpdateSubject={(id, patch) => setSubjects((prev) =>
              prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
            )}
            onRemoveSubject={(id) => setSubjects((prev) => prev.filter((s) => s.id !== id))}
            onUpdateAppSettings={(patch) => setAppSettings((prev) => ({ ...prev, ...patch }))}
            onExportData={handleExportData}
            onImportData={handleImportData}
          />'''

if old_settings in content:
    content = content.replace(old_settings, new_settings, 1)
    changed.append("SettingsPanel 新 props 已接线")
else:
    print("ERROR: SettingsPanel 调用处未找到")

# ─────────────────────────────────────────────
# 4. 卡片多模式切换 UI：在卡片复习器上方添加模式切换条
#    锚点：CardViewer 渲染处 "待复习（状态=待复习）→ 卡片复习器"
# ─────────────────────────────────────────────
anchor2 = '''                {/* 待复习（状态=待复习）→ 卡片复习器（仅当前卡片组范围） */}'''
mode_ui = '''                {/* 多模式学习（PRD 3.4）：背诵 / 填空 / 推导 / 条件辨析 */}
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-[11px] font-bold text-[#A1A1AA] mr-0.5">模式</span>
                  {(["背诵", "填空", "推导", "条件辨析"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`min-h-[28px] px-3 rounded-[8px] font-bold text-[12px] ${cardMode === mode ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`}
                      onClick={() => setCardMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* 待复习（状态=待复习）→ 卡片复习器（仅当前卡片组范围） */}'''

if anchor2 in content:
    content = content.replace(anchor2, mode_ui, 1)
    changed.append("卡片多模式切换 UI 已添加")
else:
    print("ERROR: 卡 片复习器锚点未找到")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("=== 完成 ===")
for item in changed:
