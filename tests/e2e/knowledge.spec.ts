import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, waitForStoredData } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

/** 进入知识中心并切换到政治（seed 真题所在科目） */
async function gotoKnowledgeSubject(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "知识中心" }).click();
  // 等待事件系统稳定（Vite HMR 并行 worker 下 click 事件可能尚未绑定）
  await page.waitForTimeout(300);
  // 等待 landing 渲染稳定（Vite HMR reload 期间避免竞态）
  await expect(page.getByRole("heading", { name: "知识中心" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "政治" }).first().click();
}

/** 验证纯前端 view 下知识中心按学科隔离（本题库筛选已锁定当前学科） */
async function openQuestionsForSubject(page: import("@playwright/test").Page, subject: string) {
  await page.getByRole("button", { name: "知识中心" }).click();
  await page.waitForTimeout(300);
  await expect(page.getByRole("heading", { name: "知识中心" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: subject }).first().click();
  await page.getByRole("button", { name: "真题库" }).click();
}

test.describe("Knowledge 知识中心", () => {
  test("landing 三入口 + 科目 Tab", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await page.getByRole("button", { name: "知识中心" }).click();
    await expect(page.getByRole("heading", { name: "知识中心" })).toBeVisible();

    // 科目 Tab
    await expect(page.getByRole("button", { name: "政治" }).first()).toBeVisible();

    // 三个入口卡片（div role=button，与沉淀卡片入口一致带边框）
    const entries = page.locator(".grid.grid-cols-1.md\\:grid-cols-3 [role='button']");
    await expect(entries).toHaveCount(3);
    await expect(entries.nth(0)).toContainText("真题库");
    await expect(entries.nth(1)).toContainText("学习资料");
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
    // 点击书架卡（真题）→ 进入真题库阅读页（Reader；2026-08-17 真题库支持 readingMode）
    await page.locator(".bookshelf-grid .book-card").first().click();
    await expect(page.locator(".readerGrid, [class*=readerGrid]").first()).toBeVisible();
    // 阅读页顶部「← 返回书架」（真题库面板的返回按钮在 Reader 外，选择器需精确）
    await expect(page.getByRole("button", { name: "← 返回书架" })).toBeVisible();
    await page.getByRole("button", { name: "← 返回书架" }).click();
    // 返回真题库书架
    await expect(page.getByRole("button", { name: "上传真题" })).toBeVisible();
    await expect(page.locator(".readerGrid, [class*=readerGrid]")).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-resources");
  });

  test("Resources：书架卡点击进入 Reader（信息架构精简后仅网格视图）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoKnowledgeSubject(page);
    await page.getByRole("button", { name: "学习资料" }).click();
    // 列表视图已移除（2026-08-01），仅保留网格书架；点击书卡直接进入 Reader
    await expect(page.locator(".bookshelf-grid .book-card").first()).toBeVisible();
    await page.locator(".bookshelf-grid .book-card").first().click();

    await expect(page.locator(".readerGrid, [class*=readerGrid]").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "← 返回书架" })).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-resources-grid-open");
  });

  test("知识图谱：节点列表与编辑入口", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoKnowledgeSubject(page);
    await page.getByRole("button", { name: "知识图谱" }).click();

    await expect(page.getByRole("heading", { name: "知识图谱" })).toBeVisible();
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
    await expect(page.locator(".grid.grid-cols-1.md\\:grid-cols-3 [role='button']")).toHaveCount(3);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-breadcrumb");
  });

  test("政治真题导入：知识中心展示考研政治真题套卷", async ({ page }) => {
    const collector = attachConsoleCollector(page);
    await openQuestionsForSubject(page, "政治");
    await expect(page.getByRole("button", { name: "上传真题" })).toBeVisible();
    // 政治内置真题：24 套（2003-2026）→ 套卷书架 24 张书卡
    await expect(page.locator(".bookshelf-grid .book-card")).toHaveCount(24);
    await expect(page.locator(".bookshelf-grid .book-card").first()).toContainText("考研政治");
    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-politics-import");
  });

  test("学科隔离：真题库按当前学科过滤，不跨学科展示", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    // 进入 政治 真题库（内置 24 套真题）
    await openQuestionsForSubject(page, "政治");
    await expect(page.getByRole("button", { name: "上传真题" })).toBeVisible();
    await expect(page.locator(".bookshelf-grid .book-card")).toHaveCount(24);

    // 返回 landing 后再切换到 英语一（内置 16 套真题 2010-2025，绝不跨学科展示政治套卷）
    await page.getByRole("button", { name: "← 返回" }).click();
    await page.getByRole("button", { name: "英语一" }).first().click();
    await page.getByRole("button", { name: "真题库" }).click();
    await expect(page.locator(".bookshelf-grid .book-card")).toHaveCount(16);
    await expect(page.locator(".bookshelf-grid .book-card").first()).toContainText("2024 考研英语一真题");
    await expect(page.getByText("暂无真题套卷")).not.toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-subject-isolation");
  });
});
