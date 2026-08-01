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

  test("Resources：资料库网格 + Reader 容器", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoKnowledgeSubject(page);
    await page.getByRole("button", { name: "学习资料" }).click();

    await expect(page.getByText("学习资源库")).toBeVisible();
    await expect(page.getByRole("button", { name: "上传资源" })).toBeVisible();
    await expect(page.locator(".bookshelf-grid .book-card").first()).toBeVisible();
    // Reader 容器渲染
    await expect(page.locator(".readerGrid, [class*=readerGrid]").first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-resources");
  });

  test("知识图谱：节点列表与添加知识点", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoKnowledgeSubject(page);
    await page.getByRole("button", { name: "知识图谱" }).click();

    await expect(page.getByText("七核、分支、知识点编辑")).toBeVisible();
    await expect(page.locator(".knowledge-list article").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "添加知识点" })).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-graph");
  });

  test("添加知识点持久化", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoKnowledgeSubject(page);
    await page.getByRole("button", { name: "知识图谱" }).click();
    await page.getByRole("button", { name: "添加知识点" }).click();

    const dialog = page.getByLabel("添加知识点");
    await expect(dialog).toBeVisible();
    await dialog.locator('select[name="subject"]').selectOption("828 物理化学");
    await dialog.locator('input[name="knowledge"]').fill("E2E验收测试知识点");
    await dialog.getByRole("button", { name: "添加知识点" }).click();

    await expect(page.locator(".knowledge-list article", { hasText: "E2E验收测试知识点" })).toBeVisible();

    const saved = await waitForStoredData(
      page,
      (data) => ((data.nodes as { knowledge: string }[]) || []).some((n) => n.knowledge === "E2E验收测试知识点"),
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
    await page.getByRole("button", { name: "← 返回资源总览" }).click();
    await expect(page.getByRole("heading", { name: "知识中心" })).toBeVisible();
    await expect(page.locator(".grid.grid-cols-1.md\\:grid-cols-3 button")).toHaveCount(3);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-breadcrumb");
  });

  test("学科隔离：真题库按当前学科过滤，不跨学科展示", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    // 进入 828 物理化学真题库
    await openQuestionsForSubject(page, "828 物理化学");
    await expect(page.getByRole("button", { name: "录入题目" })).toBeVisible();
    const q828Count = await page.locator(".question-list article").count();
    expect(q828Count).toBeGreaterThan(0);
    // 828 seed 真题 2 道
    await expect(page.locator(".question-list article").first()).toContainText("828 物理化学");

    // 返回 landing 后再切换到 英语一（无 seed 真题）→ 列表应为空，绝不展示 828 题目
    await page.getByRole("button", { name: "← 返回资源总览" }).click();
    await page.getByRole("button", { name: "英语一" }).first().click();
    await page.getByRole("button", { name: "真题数据库" }).click();
    await expect(page.locator(".question-list article")).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "knowledge-subject-isolation");
  });
});
