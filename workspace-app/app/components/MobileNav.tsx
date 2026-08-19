"use client";

import type { WorkspaceView } from "../lib/types";

/**
 * 移动端底部导航（2026-08-19 新增）
 *
 * 背景：Sidebar 为 `hidden lg:flex`（≥1024px 才显示），此前 <1024px 视口
 * （手机/平板）无任何导航入口 → 知识中心/沉淀卡片/设置等核心功能不可达。
 * 此组件在 <lg 时以固定底部导航栏补齐 5 个一级入口，与 Sidebar 导航完全同源。
 *
 * 说明：默认不渲染任何内容（lg 以上不出现）；底部留白由
 * workspace.module.css 的 `@media (max-width: 1023px)` 补足（padding-bottom）。
 */

const NAV_ITEMS: { key: WorkspaceView; label: string; icon: string }[] = [
  { key: "dashboard", label: "今日工作台", icon: "📋" },
  { key: "agent", label: "AI学习助手", icon: "🤖" },
  { key: "knowledge", label: "知识中心", icon: "📚" },
  { key: "cards", label: "沉淀卡片", icon: "🗂️" },
  { key: "settings", label: "设置", icon: "⚙️" },
];

export function MobileNav({
  activeView,
  setActiveView,
}: {
  activeView: WorkspaceView;
  setActiveView: (view: WorkspaceView) => void;
}) {
  return (
    <nav
      aria-label="移动端导航"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[90] bg-white/95 backdrop-blur-[18px] border-t border-[#E4E4E7] px-2 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition-colors ${isActive ? "text-[#18181B] font-semibold" : "text-[#71717A] hover:text-[#18181B]"}`}
              onClick={() => setActiveView(item.key)}
            >
              <span className="text-[18px] leading-none" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
