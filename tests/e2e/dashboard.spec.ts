import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, STORAGE_KEY } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

/** 进入 AI 学习助手（Agent）页面 */
async function gotoAgent(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "AI学习助手" }).click();
}

test.describe("Dashboard 今日任务", () => {
  test("任务列表与 AI 概览渲染", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await expect(page.getByText("今日建议")).toBeVisible();
    await expect(page.getByText("任务与完成记录")).toBeVisible();
    const taskRows = page.locator(".task-row");
    await expect(taskRows.first()).toBeVisible();
    const count = await taskRows.count();
    expect(count).toBeGreaterThan(0);
    // 今日任务/今日复盘 Tab
    await expect(page.getByRole("button", { name: "今日任务" })).toBeVisible();
    await expect(page.getByRole("button", { name: "今日复盘" })).toBeVisible();

    await page.waitForTimeout(300);
    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "dashboard-list");
  });

  test("更多菜单：提高优先级改变任务顺序", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    const titlesBefore = await page.locator(".task-row strong").allTextContents();
    expect(titlesBefore.length).toBeGreaterThan(1);

    // 对第二个任务点「提高优先级」→ 与第一个任务交换
    const secondRow = page.locator(".task-row").nth(1);
    await secondRow.locator("summary", { hasText: "•••" }).click();
    const moreItems = page.locator(".more-items button").filter({ visible: true });
    await expect(moreItems).toHaveCount(4);
    await moreItems.nth(0).click();
    await page.waitForTimeout(200);

    const titlesAfter = await page.locator(".task-row strong").allTextContents();
    expect(titlesAfter[0]).toBe(titlesBefore[1]);
    expect(titlesAfter[1]).toBe(titlesBefore[0]);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "dashboard-more-menu");
  });

  test("更多菜单：队首提高优先级给出反馈", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    const firstRow = page.locator(".task-row").first();
    await firstRow.locator("summary", { hasText: "•••" }).click();
    await page.locator(".more-items button").filter({ visible: true }).nth(0).click();
    await expect(page.getByText("已经是最高优先级")).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "dashboard-more-menu-boundary");
  });

  test("学习计时：开始→暂停→继续→结束→保存", async ({ page }) => {
    const collector = attachConsoleCollector(page);
    const firstTaskRow = page.locator(".task-row").first();

    // 开始学习
    await firstTaskRow.getByRole("button", { name: "开始学习" }).click();
    await expect(firstTaskRow.getByText("● 学习中")).toBeVisible();

    // 暂停 → 状态变为暂停
    await firstTaskRow.getByRole("button", { name: "暂停" }).click();
    await expect(page.getByText("● 已暂停")).toBeVisible();

    // 继续学习
    await firstTaskRow.getByRole("button", { name: "继续学习" }).click();
    await expect(page.getByText("● 学习中")).toBeVisible();

    // 结束学习 → Completion Modal
    await firstTaskRow.getByRole("button", { name: "结束学习" }).click();
    await expect(page.getByLabel("记录学习结果")).toBeVisible();

    // 编辑时间为 15 分钟
    await page.getByRole("button", { name: "✏ 编辑" }).click();
    const minutesInput = page.getByLabel("记录学习结果").locator("input").first();
    await minutesInput.fill("15");
    await page.getByLabel("记录学习结果").getByRole("button", { name: "保存并完成" }).click();

    // 任务勾选完成
    await expect(firstTaskRow.locator('input[type="checkbox"]')).toBeChecked();

    // 持久化检查
    await page.waitForTimeout(600);
    const saved = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }, STORAGE_KEY);
    expect(saved).not.toBeNull();
    const doneTask = (saved.tasks || []).find((t: { done?: boolean }) => t.done === true);
    expect(doneTask).toBeTruthy();
    expect(String(doneTask.actualMinutes)).toBe("15");

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "dashboard-timer");
  });

  test("刷新后任务顺序与状态持久化", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    const firstTitleBefore = await page.locator(".task-row").first().locator("strong").first().textContent();

    await page.reload();
    await expect(page.locator(".task-row").first()).toBeVisible();
    const firstTitleAfter = await page.locator(".task-row").first().locator("strong").first().textContent();

    expect(firstTitleAfter).toBe(firstTitleBefore);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "dashboard-reload");
  });

  test("重新生成今日计划", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await page.getByRole("button", { name: "重新生成今日计划" }).click();
    await expect(page.locator(".task-row").first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "dashboard-plan");
  });

  test("首页入口：直接进入我的资料库", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await page.getByRole("button", { name: "我的资料库" }).click();
    await expect(page.getByRole("heading", { name: "我的资料库" })).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "dashboard-material-entry");
  });

  test("热力图日期点击进入复盘", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await page.getByRole("button", { name: /学习记录 2026-07-30/ }).click();
    await expect(page.getByRole("heading", { name: "学习复盘" })).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "dashboard-heatmap-click");
  });
});

test.describe("Agent AI 学习助手（标准聊天界面）", () => {
  test("首次进入显示欢迎界面（不展示大量系统消息）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAgent(page);
    // 欢迎提示（限定在聊天面板内，避免与 Sidebar 文本冲突）
    await expect(page.locator("#ai-chat-panel").getByText("你好，我是你的 AI 学习助手。")).toBeVisible();
    // 输入框固定可见且自动聚焦（无需滚动即可输入）
    const input = page.getByTestId("chat-input");
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "agent-welcome");
  });

  test("输入框发送消息：Enter 发送 + 自动滚动 + 时间显示", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAgent(page);
    const panel = page.locator("#ai-chat-panel");
    const scroll = panel.getByTestId("chat-scroll");
    const input = panel.getByTestId("chat-input");
    await input.fill("今天只有两个小时，我该学什么？");
    await input.press("Enter");
    // 用户消息 + AI 回复都出现（限定在会话滚动区内，避免顶栏标题 strict mode 冲突）
    await expect(scroll.getByText("今天只有两个小时，我该学什么？")).toBeVisible();
    // 2026-08-02：runPrompt 已接 plan-generate 真 AI——有 key 时显示「今日计划（AI 正式 · DeepSeek）」；
    // 无 key 时降级为「演示回复…已按风险知识点生成今日任务」。两者任一可见即通过。
    await expect(scroll.getByText(/今日计划（AI 正式 · DeepSeek）|演示回复（.*）：已按风险知识点生成今日任务/)).toBeVisible();
    // 消息时间已显示（当天 HH:mm 格式）
    await expect(scroll.getByText(/^\d{2}:\d{2}$/).first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "agent-send");
  });

  test("新建对话 + 历史对话分 Session", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAgent(page);
    const panel = page.locator("#ai-chat-panel");
    const scroll = panel.getByTestId("chat-scroll");
    // 新建对话 → 创建新 Session（不删除历史）
    await panel.getByRole("button", { name: "新建会话" }).click();
    const input = panel.getByTestId("chat-input");
    await input.fill("帮我制定今天的学习计划");
    await input.press("Enter");
    // 限定会话滚动区（顶栏标题也会包含该文本，避免 strict mode）
    await expect(scroll.getByText("帮我制定今天的学习计划")).toBeVisible();

    // 历史对话面板（该文本同时出现在顶栏标题/历史列表按钮/消息气泡，故用 role button 精确定位）
    await panel.getByRole("button", { name: "历史会话" }).click();
    await expect(panel.getByRole("button", { name: /帮我制定今天的学习计划/ }).first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "agent-session");
  });

  test("工作流：分析最近三套真题 + 系统记录折叠", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAgent(page);
    const input = page.getByTestId("chat-input");
    await input.fill("分析最近三套真题，更新图谱并重排计划");
    await input.press("Enter");

    // 系统操作反馈进入「系统记录」折叠区（不与 AI 对话混排）
    await expect(page.getByText(/系统记录（[12]）/)).toBeVisible({ timeout: 10000 });

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "agent-workflow");
  });

  test("Agent 真题检索接通本地真题库", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAgent(page);
    const input = page.getByTestId("chat-input");
    await input.fill("找熵变真题");
    await input.press("Enter");

    await expect(page.getByRole("heading", { name: "真题数据库" })).toBeVisible();
    await expect(page.getByText("2025 828 物理化学 第 3 题")).toBeVisible();
    await expect(page.getByText(/已检索真题库，找到 1 道相关真题/)).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "agent-question-search");
  });

  test("傅献彩跳知识中心 Reader", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAgent(page);
    const input = page.getByTestId("chat-input");
    await input.fill("傅献彩哪里讲这个");
    await input.press("Enter");
    await expect(page.getByText("我的资料库")).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "agent-knowledge-jump");
  });
});
