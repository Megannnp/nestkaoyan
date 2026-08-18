# UI 规范 (UI Guidelines)

---

## 1. 布局

### 桌面端 (≥1024px)
- **Sidebar**: 左侧固定 288px，全高
- **主内容区**: `lg:pl-[288px]`，max-w-7xl，水平居中
- **模块间间距**: `Spacing.module` (20px / mt-5)

### 移动端 (<1024px)
- Sidebar 隐藏
- 主内容区全宽
- (未来) 底部导航栏替代 Sidebar

---

## 2. 通用样式

### 底色
- 页面背景: `bg-[#f7f9f8]`
- 卡片背景: `bg-white` (带阴影)
- Sidebar 背景: `rgba(255,253,248,0.82)` + `backdrop-blur-[18px]`

### 文字
- 主文字: `#1F2937` (`Colors.textPrimary`)
- 辅助文字: `#6B7280` (`Colors.textSecondary`)
- 品牌色强调: `#0F766E` (`Colors.brand`)
- 浅色辅助: `#66746e` (侧栏辅助文字专用)

### 分割线
- `border-[rgba(217,224,220,0.4)]` (`Colors.divider`)

### 圆角
- 卡片: 14px (`Card.radius`)
- 按钮: 10px
- 输入框: 8px
- 热力图单元格: 2px

---

## 3. 组件样式规范

### 按钮
| 类型 | 样式 | 用途 |
|------|------|------|
| 主按钮 (primary) | `bg-[#0F766E] text-white` | Modal 提交 |
| 次按钮 (secondary) | `bg-white border text-[#0F766E]` | 打开 Modal |
| 文字按钮 (text) | `text-[#0F766E] hover:underline` | 内联操作 |
| 宽按钮 (wide) | 全宽、圆角 | 生成计划等 |

### 模态框 (Dialog)
- 背景遮罩: `bg-black/30 backdrop-blur-sm`
- 面板: `.modal-panel` (白色卡片，圆角，阴影)
- 标题栏: `.modal-head` (flex 布局)
- 表单: `.form-grid` (grid 两列) 或 `.mini-form` (单列)

### 输入框
- 已定义的 CSS 类: `.field`, `.wide-field`, `.check-pill`
- 最小高度: `min-h-[36px]` 或 `min-h-[38px]`
- 标签统一使用 11px 字号 + 600 字重

### 标签/选项卡
- `.subject-tabs`: 科目切换标签
- `.subnav`: 子面板切换
- `.mode-toggle`: 卡片模式切换
- 活动态: `bg-[#0F766E] text-white` 或 `bg-[#eaf4f0] text-[#0F766E]`

### 数据网格
- `.metric-grid`: 4 列统计数据显示
- `.card-grid`: 成长卡片网格
- `.core-grid`: 知识图谱节点网格

---

## 4. 状态颜色

| 状态 | 颜色 | 用途 |
|------|------|------|
| 正常 | `#0F766E` 或 默认 | 正常风险、已确认 |
| 警告 | 橙色 | 需要关注 |
| 危险 | 红色 | 高风险、错误 |
| 禁用 | `#66746e` 浅色 | 不可操作状态 |

---

## 5. 交互规范

### 悬停效果
- 卡片按钮: `hover:-translate-y-[1px]` + 背景色变化
- 链接按钮: `hover:underline`
- 科目切换: 激活态下划线

### 动画
- 进度条: `transition-all duration-300`
- 按钮: `transition-all duration-200`
- 模态框: (当前无动画，未来添加)

### Toast 通知
- 位置: 页面顶部
- 自动消失: 3 秒
- 显示内容: 操作反馈文本
- 撤销操作: 删除操作后显示"撤销"按钮

---

## 6. 响应式设计

| 断点 | 行为 |
|------|------|
| <1024px | Sidebar 隐藏，主内容区全宽 |
| ≥1024px | Sidebar 固定显示 |
| ≥1280px | 设置页双列布局 |

---

## 7. 当前全局 CSS 类

定义在 `globals.css` 中的主要类：

- `.toast-notice` — 顶部通知
- `.breadcrumb` — 面包屑导航
- `.section-label` / `.section-heading` — 区块标题
- `.modal-backdrop` / `.modal-panel` / `.modal-head` — 模态框
- `.form-grid` / `.mini-form` / `.modal-form` — 表单布局
- `.field` / `.wide-field` / `.check-pill` — 输入字段
- `.subject-tabs` / `.subnav` / `.mode-toggle` — 标签切换
- `.metric-grid` — 统计网格
- `.resource-list` / `.question-list` / `.confirm-table` / `.card-grid` — 列表容器
- `.agent-panel` / `.chat-window` / `.prompt-bar` — AI 面板
- `.task-stack` / `.task-row` — 任务列表
- `.reader-grid` / `.reader-panel` / `.reader-toolbar` — 阅读器
- `.review-grid` / `.review-panel` — 复盘面板
- `.settings-group` / `.settings-form` — 设置页

### 样式改进计划

- [ ] 停止在 `page.tsx` 中使用 `style={{}}` 内联样式
- [ ] 将 `globals.css` 中 ~37000 行 CSS 分解为模块 CSS
- [ ] 所有颜色引用 `design-tokens.ts` 的 `Colors` 对象
- [ ] 所有间距引用 `design-tokens.ts` 的 `Spacing` 对象