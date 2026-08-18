# 功能清单 (Feature Inventory)

> 回答"系统有什么功能"，与 ARCHITECTURE.md（回答"功能应放哪里"）配合。
> 每次 Refactor：Inventory → Dependency Audit → Refactor → Inventory Check。

## Dashboard（今日工作台）
- ✅ 导航 Tab（今日任务/今日复盘）
- ✅ 今日 AI 概览卡（预计时间/完成数/掌握度提升）
- ✅ 任务列表（AI 推荐/掌握度条/AI 推荐原因/详情折叠）
- ✅ 学习计时（开始/暂停/继续/结束）
- ✅ Completion Modal（实际分钟可编辑/掌握程度/正确率/状态/错因/保存）
- ✅ 更多菜单（提高/降低优先级/延期/暂停）
- ⚠️ 数据读写：tasks、studyDays、nodes（低正确率降掌握度）、logs
- ⚠️ 跨页：quick prompt 跳 Agent/Knowledge/Cards

## Agent（AI 学习助手）
- ✅ 对话气泡 + 输入发送
- ✅ 7 个 quick prompts（统一走 runPrompt）
- ✅ Agent 工作流展示（5 步）
- ✅ runPrompt 10 分支（计划/分析/工作流/检索/错因/笔记/复习/卡片/轮次/兜底）
- ⚠️ 数据读写：chat、agentSteps、pending、notes、logs
- ⚠️ 跨页：跳 knowledge(真题库)/cards(卡片、复习)

## Knowledge Center
- ✅ landing（科目 Tab + 三入口）
- ✅ Resources（网格/列表、上传+AI识别状态机、编辑、删除、Reader）
- ✅ Reader（分页/缩放/搜索/批注分组/新建批注/AI 助手/关联真题/相关知识点）
- ✅ Questions（筛选条/录入/内联编辑做题记录/收藏/删除）
- ✅ Graph（添加/内联编辑掌握度风险/删除）
- ⚠️ 数据读写：resources、questions、nodes、annotations、pending、questionFilter、resourceView
- ⚠️ 跨页：跳 cards(批注生成卡片)；被 Agent(真题检索)、Cards(来源/真题) 进入

## Growth Cards
- ✅ 复习/管理/新建三个 Tab
- ✅ 快速创建表单（正/背面/类型）
- ✅ 科目 Tab（计数）
- ✅ 复习（CardViewer：翻转/导航/评分/来源/真题）
- ✅ 专注模式
- ✅ 管理（评分/收藏/来源/真题/删除）
- ✅ 手动创建弹窗
- ⚠️ 数据读写：cards、annotations(批注生成标记)、chat(pushAssistant)
- ⚠️ 跨页：跳 knowledge(openCardSource/showRelatedQuestions)；被 Agent(复习/卡片) 进入

## Review
- ✅ 日/周/月 Tab
- ✅ 科目筛选
- ✅ 概览指标（时长/完成/重点/真题/卡片/掌握度）
- ✅ AI 总结展示
- ✅ 复盘历史面板（P4 Phase1）
- ⚠️ 数据读写：tasks、questions、cards、nodes、notes
- ⚠️ 跨页：onOpenReviewDialog 打开 ReviewDialog

## Settings
- ✅ 考试基本信息（名称/院校/研究院/专业/日期）
- ✅ 总分目标只读汇总（各科目标相加）
- ✅ 科目卡（类型/目标/满分/轮次/层级/每周时长/风险/编辑）
- ✅ 添加科目（类型→默认满分、目标≤满分）
- ✅ 删除科目（二次确认）
- ⚠️ 数据读写：exam、subjects
- ⚠️ 跨页：subjects 被 Sidebar/Knowledge/Cards/Review 共享

## 已知未完成/待验证项
- ⚠️ Playwright E2E：3 条草稿测试未验证（Chromium revision 1234 未安装）
- ⚠️ Completion Task Drawer（state 已恢复，UI 待补）
- ⚠️ Dashboard 历史 Quick Prompt 完整行为（部分依赖 Agent 运行时）
- ⚠️ 新增批注（onCreateAnnotation）未在 page.tsx 接线（ReaderPanel 有 UI）