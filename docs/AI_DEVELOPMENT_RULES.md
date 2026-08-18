# AI 开发规则 (AI Development Rules)

> 所有 AI（Cline、Claude Code、Codex 等）在修改此项目前必须阅读以下规则。
> 违反规则可能导致项目结构损坏或数据不一致。

---

## 0. 首次工作流程

每次 AI 开始工作时，必须：

1. **阅读本文档**
2. 阅读 [`ARCHITECTURE.md`](ARCHITECTURE.md) — 了解项目架构
3. 阅读 [`COMPONENT_GUIDE.md`](COMPONENT_GUIDE.md) — 了解组件边界
4. 阅读 [`DATA_GUIDE.md`](DATA_GUIDE.md) — 了解数据来源
5. 阅读 [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — 了解设计 Token
6. 阅读 [`STORAGE_GUIDE.md`](STORAGE_GUIDE.md) — 了解存储规范
7. 阅读数据审计报告 [`/workspace-app/DATA_PROVENANCE_AUDIT.md`](/workspace-app/DATA_PROVENANCE_AUDIT.md)
8. 查看 `git log --oneline -10`（如果有 git 历史）了解最近修改
9. 确认要修改的组件范围

---

## 1. 修改范围声明

在修改任何文件前，必须明确声明：

```
允许修改：Heatmap.tsx
禁止修改：
- Sidebar 其它组件
- Typography / Colors Token
- CurrentCore
- Settings
- Grid
- Data
- Tasks
如果需要修改其它组件，
必须先说明原因。
```

---

## 2. 绝对禁止

### 2.1 禁止修改 Design Token
- `design-tokens.ts` 中的 **Typography**, **Colors**, **Spacing**, **Card**, **SidebarWidth**
- 除非有 **明确的 Design Review** 要求

### 2.2 禁止修改类型定义
- `types.ts` 中的类型定义
- 除非有新增实体需求

### 2.3 禁止修改默认数据
- `default-data.ts` 中的 seed 数据
- 除非有新增实体需求

### 2.4 禁止硬编码数字
```
❌ const interval = 7;
❌ <span>315</span>
❯ <span>{totalTargetScore}</span>
```

### 2.5 禁止内联样式
```
❌ style={{ fontSize: 14, fontWeight: 600 }}
✅ className={...} 或引用 Token
```

---

## 3. 组件修改规则

### 3.1 Sidebar
- 只能修改当前子区块的 JSX
- 禁止修改 subjects / tasks / nodes 等数据
- 禁止添加数据修改逻辑

### 3.2 模态框 (Dialog)
- 必须使用现有的 `activeDialog` 机制
- 表单必须使用 `<form>` + `onSubmit`
- 提交后必须关闭 Dialog

### 3.3 列表渲染
- 必须使用 `key={item.id}`
- 禁止使用 `key={index}`

### 3.4 事件处理
- 使用 `FormEvent<HTMLFormElement>` 类型
- 函数保持简洁，不超过 30 行

---

## 4. 数据修改规则

### 4.1 所有数字必须有来源
- 显示的数字必须是 computed value
- 禁止直接写数字

### 4.2 所有默认值来自 default-data.ts
- 禁止在 JSX 中使用 fallback 字符串
- 禁止在函数中硬编码 seed 数据

### 4.3 localStorage 操作
- 当前直接操作在 page.tsx，后续必须走 storage.ts

---

## 5. Prompt 模板

### 5.1 功能修改请求
```
修改目标：[组件名]
修改范围：[文件列表]
允许修改：[具体内容]
禁止修改：[禁止的内容]
原因：[修改的原因]
```

### 5.2 Bug 修复请求
```
Bug 描述：[问题现象]
影响范围：[影响的组件/数据]
预期结果：[期望的行为]
关联数据：[涉及的数据类型]
```

### 5.3 新增功能请求
```
新增目标：[功能名称]
涉及组件：[组件列表]
涉及数据类型：[新增/修改的类型]
数据来源：[用户输入 / AI生成 / 计算]
```

---
## 6. 组件重构（Component Refactor）专项规则

### 6.1 核心原则
组件重构是 **等价迁移（Equivalent Migration）**，不是功能重写（Feature Rewrite）。

### 6.2 重构前必须执行

1. **先检查 git status** — 确认当前有可运行的 Git 提交
2. **先列出原页面的完整功能清单**（模块级，每个 JSX 区块对应一行）
3. **声明只修改的文件列表**，禁止修改范围外的文件
4. **禁止一次性修改多个页面**，每次只动一个组件或一个页面

### 6.3 重构中绝对禁止

```
❌ 删除任何已有功能 / JSX / 页面 / 状态 / 交互
❌ 修改 UI 或重新设计
❌ 修改数据结构或类型定义
❌ 修改导航值或组件接口
❌ 添加占位页面（placeholder）
❌ 使用默认值掩盖数据断裂（|| 0, ?? [], = () => {}）
❌ 整文件覆盖（全文 write_to_file），优先使用小范围 patch
❌ 优化旧版逻辑或"顺手简化"代码
❌ 自动进入下一个任务
```

### 6.4 重构必须遵守

```
✅ 拆出前 JSX = 拆出后 JSX（保持一致）
✅ 页面模块数量一致
✅ Props 数据一致
✅ 所有条件渲染分支一致
✅ 所有事件处理函数仍然可达
✅ 拆完后：旧页面功能数 == 新页面功能数
```

### 6.5 重构后必须检查

1. 运行 `npx next build`（TypeScript 编译）
2. 运行 `npm run test`
3. **打开浏览器验证每个页面** — 不仅仅是编译通过
4. 检查浏览器 Console 是否有红色错误
5. 对照原页面输出 **功能完整性对照表**
6. 确认不通过，不允许结束任务

### 6.6 导航值规范

- 导航值必须使用统一类型定义（`ActiveView`）
- Sidebar 和主内容使用同一个常量
- 主内容必须有 fallback 页面，默认不返回空白

### 6.7 命名空间目录结构（渐进式目标）

```
app/components/
├── layout/       # Sidebar, WorkspaceLayout
├── dashboard/    # TodayDashboard, TaskCard, StudyHeatmap
├── agent/        # AIWorkspace, ChatPanel
├── knowledge/    # KnowledgeLanding, ResourceDetail, ReadingWorkspace
├── cards/        # GrowthCardsHome, CardReview
└── settings/     # SettingsPanel
```

每次只拆一个文件到对应子目录，拆完就测试和提交。

---

### 6.8 持久化数据契约兼容性（历史数据保护）

修改持久化数据类型或 lookup map（如 `ANNOTATION_COLORS`）前，必须审计：

1. 旧版本曾写入过哪些值（git 历史 / 旧 form 默认值 / seed 数据）
2. localStorage / 已保存数据中是否可能存在这些历史值
3. lookup map 是否覆盖所有历史合法值
4. 若需"收窄"联合类型，先确认无历史数据会触发 `undefined`，否则需数据迁移或保留旧值

**禁止**用 `?? default` / `color?.border` 掩盖数据契约断裂；应修复类型域与 lookup，使其覆盖历史合法值，并补回归测试。

---
## 7. 修改后检查清单

- [ ] 是否引入了新的硬编码数字？
- [ ] 是否引入了新的内联样式？
- [ ] 是否修改了禁止修改的文件？
- [ ] 是否使用了正确的 `key`？
- [ ] TypeScript 编译是否通过？
- [ ] 测试是否通过？
- [ ] 数据来源是否清晰？
- [ ] 是否更新了相关文档和 CHANGELOG？