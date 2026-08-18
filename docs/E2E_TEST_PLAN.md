# E2E 模块化验收测试计划

> 本文档定义主验收标准：模块化 Playwright E2E 测试。
> `tests/acceptance-audit.mjs` 保留为历史诊断脚本，不再作为主验收标准。

## 1. 背景：为什么拆分 acceptance-audit.mjs

`workspace-app/tests/acceptance-audit.mjs` 是早期单页长流程审计脚本，存在以下已过时的职责：

| 问题 | 说明 | 处置 |
| --- | --- | --- |
| 单线程长流程 | 12 个验收点串联在一个页面会话中，后一步依赖前一步遗留状态 | 拆分为 6 个独立 spec |
| 状态互相污染 | Agent 测试改写了任务顺序 → 后续 Dashboard 断言基于脏状态 | 每个 test 清空 localStorage |
| 断言已过时 | `onCreateAnnotation` / `onEditAnnotation` / timer 续计 / review 持久化 均已修复，脚本仍报 BUG | 新 spec 按当前实现断言 |
| Console 无分类 | 仅收集文本数组，无法区分 Runtime / Network / React / 三方 | 五分类统计 + 关键分类失败即报错 |
| 单点失败全断 | 任一步异常导致整个验收中断 | 6 个 spec 独立运行，单个失败不影响其他 |

保留 `acceptance-audit.mjs` 的目的：历史数据来源（stabilization 阶段对比）、诊断排查参考脚本。新功能验收以本计划中的 spec 为准。

## 2. 测试架构

```
workspace-app/
├── playwright.config.ts          # 主配置（并行 spec、超时、reporter）
└── tests/e2e/
    ├── helpers.ts                # 公共工具：freshState / Console 五分类 / 断言
    ├── dashboard.spec.ts         # Dashboard：任务、计时、Agent 快捷入口
    ├── knowledge.spec.ts         # 知识中心：landing 三入口、Resources、图谱
    ├── reader.spec.ts            # 阅读器：翻页、搜索、缩放、批注、PDF 上传
    ├── questions.spec.ts         # 真题数据库：筛选、录入、做题记录、收藏、删除
    ├── cards.spec.ts             # 成长卡片：Tab、快速创建、评分、键盘、管理、删除
    └── review.spec.ts            # 复盘：日/周/月、科目筛选、复盘 Dialog、持久化
```

### 2.1 独立性原则

每个 spec 内的每个 test 在 `beforeEach` 中调用：

```ts
async function freshState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}
```

保证：
- 不依赖前一个测试的遗留状态（localStorage 清空）
- 不依赖其他 spec 的页面状态（每个 test 独立 context）
- 刷新后持久化验证在单 test 内部自证（写入 → reload → 断言恢复）

### 2.2 运行方式

```bash
cd workspace-app

# 全部 spec（4 workers 并行）
npx playwright test

# 单模块
npx playwright test tests/e2e/dashboard.spec.ts
npx playwright test tests/e2e/reader.spec.ts

# 关键词过滤
npx playwright test --grep "批注"

# HTML 报告
npx playwright show-report
```

## 3. Console Error 五分类统计

`helpers.ts` 提供统一采集与分类：

| 分类 | 判定规则 | 是否使测试失败 |
| --- | --- | --- |
| **Runtime Error** | `pageerror`；或 console error 匹配 `TypeError/ReferenceError/RangeError/SyntaxError/Uncaught/is not a function/Cannot read properties/is not defined` | ✅ 是 |
| **Network Error** | `requestfailed`；或 response ≥ 400；或 console 匹配 `net::/Failed to fetch/ERR_/load failed/404/500/NetworkError` | ✅ 是 |
| **React Warning** | 匹配 `Warning:/React does not recognize/Each child in a list/hydration/Hydration failed/react-hooks/set-state-in-effect` | ✅ 是 |
| **Browser Warning** | 匹配 `[Violation]/Autofill/SharedArrayBuffer/Deprecated/Password Manager` 等平台噪音 | ❌ 仅记录 |
| **Third-party** | 匹配 `Next.js DEVELOPMENT MODE/React DevTools/webpack/hot-update/favicon` 等环境噪音 | ❌ 仅记录 |

每个测试执行结束时输出：

```
[ConsoleStats:dashboard-list]
  Runtime Error: 0
  Network Error: 0
  React Warning: 0
  Browser Warning: 1
  Third-party: 2
[ConsoleStats:end]
```

关键分类（Runtime / Network / React Warning）任一非 0，该测试即失败，失败信息列出分类与原始文本：

```
[ConsoleErrors:dashboard-timer] 1 个关键控制台问题:
[Runtime Error] pageerror: TypeError: Cannot read properties of undefined (reading 'foo')
```

## 4. 各 Spec 覆盖矩阵

| Spec | 覆盖验收点 | 独立状态入口 |
| --- | --- | --- |
| **dashboard.spec.ts** | 任务列表+AI 概览；更多菜单优先级；计时开始/暂停/继续/结束/保存；刷新持久化；重新生成计划；Agent quick prompt；工作流 5 步；Agent 跳转沉淀卡片复习 | `/` + freshState |
| **knowledge.spec.ts** | landing 三入口；Resources 网格+Reader；图谱节点列表；添加知识点持久化；面包屑返回 | `/` + freshState |
| **reader.spec.ts** | 翻页；搜索高亮；缩放切换；演示模式内容；AI 助手折叠；新建批注持久化；批注编辑（prompt）；批注删除（confirm）；PDF 上传→AI 识别→确认保存；刷新后批注恢复 | `/` + freshState |
| **questions.spec.ts** | 筛选条+列表；七核热力学过滤；录入题目持久化；内联做题记录=错误；收藏；删除 | `/` + freshState |
| **cards.spec.ts** | 三个 Tab + CardViewer；快速创建持久化；评分认识；键盘空格/1；管理 Tab 指标+删除；手动创建弹窗；刷新保留 | `/` + freshState |
| **review.spec.ts** | 日/周/月 Tab+科目筛选；AI 总结+笔记；复盘 Dialog 提交持久化；刷新恢复；指标卡联动 | `/` + freshState |

## 5. 与 acceptance-audit.mjs 的关系

| 维度 | acceptance-audit.mjs（历史） | E2E specs（主验收） |
| --- | --- | --- |
| 定位 | 历史诊断脚本，保留不继续修补 | 主验收标准 |
| 运行 | `node tests/acceptance-audit.mjs`（需手动起服务） | `npx playwright test`（自动起服务） |
| 隔离性 | 单页长流程，状态串联 | 每 test freshState，独立上下文 |
| Console | 仅收集，无分类 | 五分类 + 关键分类断言失败 |
| 报告 | JSON 输出 | list + HTML + ConsoleStats 日志 |
| 失败影响 | 单点失败全断 | 单 test 失败不影响其他 |

## 6. 新增/修改文件清单

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `workspace-app/tests/e2e/helpers.ts` | 新增 | 五分类采集器 + freshState + 断言工具 |
| `workspace-app/tests/e2e/dashboard.spec.ts` | 新增 | 8 个 test |
| `workspace-app/tests/e2e/knowledge.spec.ts` | 新增 | 5 个 test |
| `workspace-app/tests/e2e/reader.spec.ts` | 新增 | 9 个 test |
| `workspace-app/tests/e2e/questions.spec.ts` | 新增 | 6 个 test |
| `workspace-app/tests/e2e/cards.spec.ts` | 新增 | 7 个 test |
| `workspace-app/tests/e2e/review.spec.ts` | 新增 | 5 个 test |
| `workspace-app/playwright.config.ts` | 更新 | 并行 4 workers、viewpool 1440×900、trace retain-on-failure、HTML reporter |
| `workspace-app/tests/acceptance-audit.mjs` | 保留 | 历史诊断脚本，不再作为验收标准 |

## 7. 后续维护约定

1. 新增功能验收：优先在对应 spec 内追加 `test()`，而不是扩展独立脚本。
2. 索引/网络类功能：对新入口使用 `attachConsoleCollector` 并加 `expectNoCriticalConsoleIssues`。
3. 分类匹配器扩展：在 `helpers.ts` 的 `IGNORED_PATTERNS` / `REACT_WARNING_PATTERNS` / `NETWORK_FAILURE_PATTERNS` / `RUNTIME_ERROR_PATTERNS` 中维护。
4. 若某个分类被错误归类，优先调整匹配器而非放宽断言。