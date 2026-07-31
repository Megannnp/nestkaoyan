/**
 * CSS 样式工具 — 为 page.tsx 中的内联样式提供标准化替代
 * 
 * 统一使用语义化命名，避免散布的内联 style={{fontSize:..., fontWeight:..., color:'#...'}}。
 * 
 * 用法：在 JSX 中 <div style={s.title}> 替代 <div style={{fontSize:16, fontWeight:600, lineHeight:1.2, color:'#18181B'}}>
 */

/** 侧栏与通用样式 */
export const s = {
  // === 侧栏 Logo + 标题 ===
  logoText: { fontSize: 18, fontWeight: 600, lineHeight: 1.2 as const, color: '#18181B' },
  logoSub: { fontSize: 12, fontWeight: 400, lineHeight: 1.4 as const, color: '#71717A', marginTop: 2 },

  // === 侧栏倒计时 ===
  countdownNum: { fontSize: 21, fontWeight: 700, lineHeight: 1.2 as const, color: '#18181B' },
  countdownUnit: { fontSize: 13, fontWeight: 500, lineHeight: 1.4 as const, color: '#71717A' },

  // === 目标信息 ===
  schoolName: { fontSize: 15, fontWeight: 600, lineHeight: 1.4 as const, color: '#18181B' },
  majorName: { fontSize: 13, fontWeight: 600, lineHeight: 1.4 as const, color: '#71717A', marginTop: 2 },

  // === 进度 ===
  progressLabel: { fontSize: 12, fontWeight: 400, lineHeight: 1.4 as const, color: '#71717A' },
  progressValue: { fontSize: 15, fontWeight: 600, lineHeight: 1.35 as const, color: '#18181B' },

  // === 热力图月份标签 ===
  heatmapMonth: { fontSize: 9, lineHeight: 'none' as const, color: '#71717A' },
  heatmapDayLabel: { fontSize: 9, lineHeight: 'none' as const, color: '#71717A' },

  // === Tooltip 弹出框 ===
  tooltipBox: {
    position: 'absolute' as const,
    pointerEvents: 'none' as const,
    zIndex: 50,
    backgroundColor: '#27272A',
    color: '#ffffff',
    padding: '6px 10px',
    maxWidth: '190px',
    minWidth: '0',
    borderRadius: '6px',
  },
  tooltipDate: { fontSize: 13, fontWeight: 500, lineHeight: 1.3 as const, color: 'rgba(255,255,255,0.9)' },
  tooltipData: { fontSize: 12, lineHeight: 1.3 as const, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  // === 侧栏四宫格按钮 ===
  gridBtnActive: { height: '82px', border: '1px solid #E4E4E7', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)' },
  gridBtnInactive: { height: '82px', border: '1px solid #E4E4E7', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.05)' },
  gridIcon: { fontSize: 20, lineHeight: 1 as const },
  gridLabel: (active: boolean) => ({ fontSize: 14, fontWeight: 500, lineHeight: 1.2 as const, marginTop: 8, color: '#18181B' }),

  // === 设置导航按钮 ===
  navIcon: { fontSize: 14, lineHeight: 1 as const },
  navText: { fontSize: 13, fontWeight: 600, lineHeight: 1.4 as const },

  // === 阅读器标题 ===
  readerZoomText: { fontSize: 16 },
  readerZoomSmall: { fontSize: 14 },
  readerZoomLarge: { fontSize: 20 },
} as const;

/** 掌握度进度条样式 */
export function masteryBarStyle(before: number, after: number) {
  return {
    before: { width: `${before}%` },
    after: { width: `${after - before}%` },
  };
}

/** 核心知识点掌握度 meter 样式 */
export function meterStyle(score: number) {
  return { width: `${score}%` };
}

/** 任务详情对话框阴影 */
export const drawerShadow = { boxShadow: '-4px 0 24px rgba(0,0,0,0.08)' };