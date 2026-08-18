# Design System — 筑巢考研工作台

> 所有 UI 相关的字号、字重、行高、颜色、间距统一在此定义。
> 组件中**禁止**使用 `text-xl`、`font-bold`、`mb-6` 等任意数值样式，
> **必须**引用此文件中的 Token。

**源文件**: [`/workspace-app/app/lib/design-tokens.ts`](/workspace-app/app/lib/design-tokens.ts)

---

## 1. Typography

| Token | Size | Weight | LineHeight | 用途 |
|-------|------|--------|------------|------|
| `Typography.Logo` | 16px | 600 | 1.2 | 品牌标志、大数字（143天倒计时） |
| `Typography.CountdownDigit` | 18px | 600 | 1.2 | 倒计时数字（唯一可使用 18px 的地方） |
| `Typography.ModuleTitle` | 13px | 500 | 1.4 | 模块标题 — "学习记录"、"当前核心"等 |
| `Typography.Body` | 14px | 500 | 1.4 | 正文 — 院校名称、核心名称等主要内容 |
| `Typography.NumberValue` | 15px | 600 | 1.35 | 重点数值 — 315、57% 等 |
| `Typography.Caption` | 12px | 400 | 1.4 | 辅助文字 — Learning Agent、轮次、副标题 |
| `Typography.Small` | 11px | 500 | 1.4 | 弱辅助文字 — Label、说明 |
| `Typography.Major` | 13px | 500 | 1.4 | 专业名称（品牌色强调） |

### 使用规则

```typescript
// ✅ 正确
<span style={{ fontSize: Typography.ModuleTitle.size, fontWeight: Typography.ModuleTitle.weight }}>
  当前核心
</span>

// ❌ 禁止
<span className="text-base font-bold">当前核心</span>
```

---

## 2. Colors

| Token | Value | 用途 |
|-------|-------|------|
| `Colors.textPrimary` | `#1F2937` | 主文字色 |
| `Colors.textSecondary` | `#6B7280` | 辅助文字色 |
| `Colors.brand` | `#0F766E` | 品牌强调色 |
| `Colors.brandBg` | `#EAF4F0` | 品牌浅色背景 |
| `Colors.brandBorder` | `rgba(15, 118, 110, 0.08)` | 品牌浅色边框 |
| `Colors.divider` | `rgba(217, 224, 220, 0.4)` | 分割线 |
| `Colors.shadowLight` | `0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.05)` | 卡片阴影（轻） |
| `Colors.shadowActive` | `0 2px 6px rgba(15, 118, 110, 0.08)` | 卡片阴影（激活态） |

### 使用规则

```typescript
// ✅ 正确 — 引用 Token
const cardStyle = {
  border: `1px solid ${Colors.brandBorder}`,
  boxShadow: isActive ? Colors.shadowActive : Colors.shadowLight,
};

// ❌ 禁止 — 硬编码颜色值
style={{ border: '1px solid rgba(15, 118, 110, 0.08)' }}
```

### 热力图颜色系统

| Level | Class | Color | 条件 |
|-------|-------|-------|------|
| 0 | `bg-[#eef2ef]` | #eef2ef | 无记录或未来 |
| 1 | `bg-[#c6e0d2]` | #c6e0d2 | completed >= 1 |
| 2 | `bg-[#8ec9a3]` | #8ec9a3 | completed >= 2 |
| 3 | `bg-[#4da775]` | #4da775 | completed >= 3 |
| 4 | `bg-[#1f6f54]` | #1f6f54 | completed >= 4 |

---

## 3. Spacing (8pt Grid System)

| Token | Value | Tailwind 对应 | 用途 |
|-------|-------|---------------|------|
| `Spacing.module` | 20px | mt-5 | 模块间间距 |
| `Spacing.titleContent` | 8px | mb-2 / mt-2 | 模块标题与内容 |
| `Spacing.contentInner` | 4px | mt-1 / gap-1 | 内容内元素 |
| `Spacing.tight` | 2px | mt-0.5 / gap-0.5 | 紧凑内容 |

---

## 4. Card

| Token | Value | 说明 |
|-------|-------|------|
| `Card.gridHeight` | 82px | 四宫格卡片高度 |
| `Card.radius` | 14px | 圆角 |
| `Card.iconSize` | 20px | 图标大小 |
| `Card.labelSize` | 14px | 文字大小 |
| `Card.labelWeight` | 500 | 文字字重 |
| `Card.iconLabelGap` | 8px | 图标与文字间距 |

---

## 5. Sidebar

| Token | Value |
|-------|-------|
| `SidebarWidth` | 288px |
| 背景色 | `rgba(255,253,248,0.82)` + `backdrop-blur-[18px]` |
| 边框 | 右侧 `1px solid rgba(23,32,28,0.1)` |
| 内边距 | `p-4` (16px) |

---

## 6. 禁止项

| 禁止 | 理由 | 替代方案 |
|------|------|---------|
| `text-xl`, `text-lg`, `text-base` | 字号不统一 | `Typography.*` |
| `font-bold`, `font-semibold` | 字重不一致 | `Typography.*.weight` |
| `mb-8`, `mt-6`, `gap-4` | 间距随意 | `Spacing.*` |
| `style={{}}` | 不可维护 | Tailwind 类或 Token |
| 硬编码颜色值 `#xxxxxx` | 主题不可控 | `Colors.*` |

---

## 7. 主题未来扩展

当前所有 Token 定义在 `design-tokens.ts`。后续主题化只需：

1. 创建 `design-tokens-dark.ts` 覆盖颜色值
2. 在 layout 层根据 `prefers-color-scheme` 切换导入