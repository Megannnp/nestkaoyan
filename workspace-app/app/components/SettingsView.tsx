"use client";

import { SettingsPanel } from "./SettingsPanel";
import { useWorkspace } from "./workspace-context";

/** SettingsView（从 page.tsx 抽出，行为等价）；数据/回调经 useWorkspace() 取用。 */
export function SettingsView() {
  const {
    exam, subjects, appSettings, setExam, setSubjects, setAppSettings, handleExportData, handleImportData,
  } = useWorkspace();
  return (
          <SettingsPanel
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
          />
  );
}
