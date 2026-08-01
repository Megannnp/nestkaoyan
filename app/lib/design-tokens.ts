/**
 * Design Tokens — 筑巢考研工作台
 *
 * 所有 UI 相关的字号、字重、行高、间距统一在此定义。
 * 颜色 Token 统一从 ./colors 引用。
 * 组件中禁止使用 text-xl、font-bold、mb-6 等任意数值样式，
 * 必须引用此文件中的 Token。
 */

// 颜色 Token 从统一文件导入
export { Colors } from './colors';

// ============================================================
// Typography
// ============================================================
export const Typography = {
  /** 品牌标志、大数字（143天倒计时） */
  Logo: { size: 16, weight: 600, lineHeight: 1.2 },
  /** 倒计时数字（唯一可使用 18px 的地方） */
  CountdownDigit: { size: 18, weight: 600, lineHeight: 1.2 },
  /** 模块标题 — "学习记录"、"当前核心"、"核心工作区"、"设置" */
  ModuleTitle: { size: 13, weight: 500, lineHeight: 1.4 },
  /** 正文 — 院校名称、核心名称等主要内容 */
  Body: { size: 14, weight: 500, lineHeight: 1.4 },
  /** 重点数值 — 315、57% 等 */
  NumberValue: { size: 15, weight: 600, lineHeight: 1.35 },
  /** 辅助文字 — Learning Agent、轮次、副标题 */
  Caption: { size: 12, weight: 400, lineHeight: 1.4 },
  /** 弱辅助文字 — Label、说明 */
  Small: { size: 11, weight: 500, lineHeight: 1.4 },
  /** 专业名称（品牌色强调） */
  Major: { size: 13, weight: 500, lineHeight: 1.4 },
} as const;

// ============================================================
// Spacing (统一间距系统 — 全站单一来源)
// ============================================================
//
// UX Sprint（全局间距系统统一）：Sidebar、页面卡片、弹窗、工具栏、
// 聊天区域统一使用同一套间距变量，禁止在页面中随意写 margin/padding。
//
export const Spacing = {
  /** 最小留白（图标与文字、标签内间距） */
  xs: 4,
  /** 紧凑间距（快捷功能、消息内部） */
  sm: 8,
  /** 常规间距（模块标题与内容、功能块之间） */
  md: 12,
  /** 模块间间距（Sidebar 模块 gap、分割线上下） */
  lg: 16,
  /** 大间距（页面外层 padding、标题区与功能区） */
  xl: 24,
  /** 超大间距（主要区块边界） */
  xxl: 32,
  /** 模块间间距（兼容旧 token） */
  module: 20,           // mt-5
  /** 模块标题与内容 */
  titleContent: 8,      // mb-2 / mt-2
  /** 内容内元素 */
  contentInner: 4,      // mt-1 / gap-1
  /** 紧凑内容 */
  tight: 2,             // mt-0.5 / gap-0.5
} as const;

// ============================================================
// Card
// ============================================================
export const Card = {
  /** 四宫格卡片高度 */
  gridHeight: 82,
  /** 圆角 */
  radius: 14,
  /** 图标大小 */
  iconSize: 20,
  /** 文字大小 */
  labelSize: 14,
  /** 文字字重 */
  labelWeight: 500,
  /** 图标与文字间距 */
  iconLabelGap: 8,
} as const;

// ============================================================
// Sidebar Width
// ============================================================
export const SidebarWidth = 288;