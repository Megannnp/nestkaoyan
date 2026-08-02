import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, waitForStoredData } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

/** 进入知识中心并切换到 828 物理化学（seed 数据所在科目） */
async function gotoKnowledgeSubject(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "知识中心" }).click();
  // 等待事件系统稳定（Vite HMR 并行 worker 下 click 事件可能尚未绑定）
  await page.waitForTimeout(300);
  // 等待 landing 渲染稳定（Vite HMR reload 期间避免竞态）
  await expect(page.getByRole("heading", { name: "知识中心" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "828 物理化学" }).first().click();
}

/** 验证纯前端 view 下知识中心按学科隔离（本题库筛选已锁定当前学科） */
async function openQuestionsForSubject(page: import("@playwright/test").Page, subject: string) {
  await page.getByRole("button", { name: "知识中心" }).click();
  await page.waitForTimeout(300);
  await expect(page.getByRole("heading", { name: "知识中心" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: subject }).first().click();
  await page.getByRole("button", { name: "真题数据库" }).click();
}

test.describe("Knowledge 知识中心", () => {
  test("landing 三入口 + 科目 Tab", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await page.getByRole("button", { name: "知识中心" }).click();
    await expect(page.getByRole("heading", { name: "知识中心" })).toBeVisible();

    // 科目 Tab
    await expect(page.getByRole("button", { name: "828 物理化学" }).first()).toBeVisible();

    // 三个入口按钮
    const entries = page.locator(".grid.grid-cols-1.md\\:grid-cols-3 button");
    await expect(entries).toHaveCount(3);
    await expect(entries.nth(0)).toContainText("学习资料");
    await expect(entries.nth(1)).toContainText("真题数据库");
    await expect(entries.nth(2)).toContainText("知识图谱");

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-landing");
  });

  test("Resources：书架页 ⇄ 阅读页（两态）,资料库网格 + Reader", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoKnowledgeSubject(page);
    await page.getByRole("button", { name: "学习资料" }).click();

    // 书架页：只管理与选择，展示资料卡，不内嵌 Reader
    await expect(page.getByText("我的资料库")).toBeVisible();
    await expect(page.getByRole("button", { name: "上传资料" })).toBeVisible();
    await expect(page.locator(".bookshelf-grid .book-card").first()).toBeVisible();
    // 点击书架卡 → 进入独立阅读页（Reader 渲染）
    await page.locator(".bookshelf-grid .book-card").first().click();
    await expect(page.locator(".readerGrid, [class*=readerGrid]").first()).toBeVisible();
    // 阅读页顶部复用知识中心二级页「← 返回」按钮
    await expect(page.getByRole("button", { name: "← 返回" })).toBeVisible();
    await page.getByRole("button", { name: "← 返回" }).click();
    // 返回书架：回到资料管理页
    await expect(page.getByRole("button", { name: "上传资料" })).toBeVisible();
    await expect(page.locator(".readerGrid, [class*=readerGrid]")).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-resources");
  });

  test("Resources：列表视图打开阅读进入 Reader", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoKnowledgeSubject(page);
    await page.getByRole("button", { name: "学习资料" }).click();
    await page.getByRole("button", { name: "☰ 列表" }).click();
    await page.getByRole("button", { name: "打开阅读" }).first().click();

    await expect(page.locator(".readerGrid, [class*=readerGrid]").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "← 返回" })).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-resources-list-open");
  });

  test("知识图谱：节点列表与编辑入口", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoKnowledgeSubject(page);
    await page.getByRole("button", { name: "知识图谱" }).click();

    await expect(page.getByRole("heading", { name: "828 物理化学 知识图谱" })).toBeVisible();
    await expect(page.getByText("知识点由 AI 从已上传资料自动识别")).toBeVisible();
    await expect(page.locator(".knowledge-list article").first()).toBeVisible();
    await expect(page.locator(".knowledge-list article").first().locator("summary", { hasText: "编辑" })).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-graph");
  });

  test("知识点风险编辑持久化", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoKnowledgeSubject(page);
    await page.getByRole("button", { name: "知识图谱" }).click();
    const firstNode = page.locator(".knowledge-list article").first();
    await firstNode.locator("summary", { hasText: "编辑" }).click();
    await firstNode.locator("select").selectOption("进度落后");
    await expect(firstNode).toContainText("进度落后");

    const saved = await waitForStoredData(
      page,
      (data) => ((data.nodes as { reviewRisk: string }[]) || []).some((n) => n.reviewRisk === "进度落后"),
      "knowledge-add-node"
    );
    expect(saved).toBeTruthy();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-add-node");
  });

  test("返回资源总览面包屑", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoKnowledgeSubject(page);
    await page.getByRole("button", { name: "学习资料" }).click();
    await page.getByRole("button", { name: "← 返回" }).click();
    await expect(page.getByRole("heading", { name: "知识中心" })).toBeVisible();
    await expect(page.locator(".grid.grid-cols-1.md\\:grid-cols-3 button")).toHaveCount(3);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-breadcrumb");
  });

  test("学科隔离：真题库按当前学科过滤，不跨学科展示", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    // 进入 828 物理化学真题库
    await openQuestionsForSubject(page, "828 物理化学");
    await expect(page.getByRole("button", { name: "上传真题" })).toBeVisible();
    const q828Count = await page.locator(".question-list article").count();
    expect(q828Count).toBeGreaterThan(0);
    // 828 seed 真题 2 道
    await expect(page.locator(".question-list article").first()).toContainText("828 物理化学");

    // 返回 landing 后再切换到 英语一（无 seed 真题）→ 列表应为空，绝不展示 828 题目
    await page.getByRole("button", { name: "← 返回" }).click();
    await page.getByRole("button", { name: "英语一" }).first().click();
    await page.getByRole("button", { name: "真题数据库" }).click();
    await expect(page.locator(".question-list article")).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-subject-isolation");
  });
});
