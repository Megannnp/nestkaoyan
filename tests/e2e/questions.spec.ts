import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, waitForStoredData } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

/** 知识中心 → 政治（seed 真题所在科目）→ 真题库 */
async function gotoQuestions(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "知识中心" }).click();
  await expect(page.getByRole("heading", { name: "知识中心" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "政治" }).first().click();
  await page.getByRole("button", { name: "真题库" }).click();
  await expect(page.getByRole("heading", { name: "真题库" })).toBeVisible();
}

test.describe("Questions 真题库", () => {
  test("套卷书架渲染：整套真题以 book-card 展示", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);

    // 真题库是「一套一套真题」书架，不是逐题列表
    await expect(page.locator(".bookshelf-grid .book-card").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "上传真题" })).toBeVisible();
    await expect(page.getByText(/套真题/).first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-shelf");
  });

  test("套卷详情：含年份与题量信息（无逐题七核字段）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);

    const firstPaper = page.locator(".bookshelf-grid .book-card").first();
    await expect(firstPaper).toBeVisible();
    // 展示年份（materialSections 回填）与题目数
    await expect(firstPaper.getByText(/年/).first()).toBeVisible();
    await expect(firstPaper.getByText(/道题|整套直接阅读/)).toBeVisible();
    // 移除逐题七核字段：不渲染 core/branch/knowledge 逐题元数据
    await expect(page.locator(".question-list")).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-shelf-detail");
  });

  test("科目 Tab 切换后真题库按学科隔离（无跨学科套卷）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    await expect(page.locator(".bookshelf-grid .book-card").first()).toBeVisible();

    // 2026-08-14：英语一内置 16 套真题（2010-2025），不跨学科展示政治套卷
    await page.getByRole("button", { name: "← 返回" }).click();
    await page.getByRole("button", { name: "英语一" }).first().click();
    await page.getByRole("button", { name: "真题库" }).click();
    await expect(page.locator(".bookshelf-grid .book-card")).toHaveCount(16);
    await expect(page.locator(".bookshelf-grid .book-card").first()).toContainText("2024 考研英语一真题");

    // 切回政治 → 套卷恢复
    await page.getByRole("button", { name: "← 返回" }).click();
    await page.getByRole("button", { name: "政治" }).first().click();
    await page.getByRole("button", { name: "真题库" }).click();
    await expect(page.locator(".bookshelf-grid .book-card").first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-subject-tab-isolation");
  });

  test("上传真题入口可添加空白真题卷（整套入库）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    await page.getByRole("button", { name: "上传真题" }).click();

    const dialog = page.getByLabel("AI识别资料");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("上传一套真题")).toBeVisible();
    await dialog.getByRole("button", { name: "直接添加空白真题卷" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(/空白真题卷/).first()).toBeVisible();

    // 持久化：整套以 resource + material(past_paper) + materialSections(exam) 入库
    const saved = await waitForStoredData(
      page,
      (data) => {
        const resources = (data.resources as { id?: string; name?: string; type?: string }[]) || [];
        const resource = resources.find((item) => item.name?.includes("空白真题卷") && item.type === "真题");
        if (!resource?.id) return false;
        return ((data.materials as { id?: string; type?: string }[]) || []).some((material) => material.id === resource.id && material.type === "past_paper")
          && ((data.materialSections as { materialId?: string; sectionType?: string }[]) || []).some((section) => section.materialId === resource.id && section.sectionType === "exam");
      },
      "questions-blank-paper"
    );
    const resource = ((saved.resources as { id?: string; name?: string; type?: string }[]) || []).find((item) => item.name?.includes("空白真题卷") && item.type === "真题");
    expect(resource?.id).toBeTruthy();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-add");
  });

  test("套卷可点击直接进入阅读（整套不拆题）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    const firstPaper = page.locator(".bookshelf-grid .book-card").first();
    await firstPaper.click();

    // 点击套卷 → 进入 Reader 阅读整套真题（2026-08-17 真题库支持 readingMode；无 heading，标题在 Reader 顶部栏）
    await expect(page.locator(".readerGrid, [class*=readerGrid]").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "← 返回书架" })).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-open-paper");
  });

  test("删除套卷（⋯ 菜单）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    const beforeCount = await page.locator(".bookshelf-grid .book-card").count();
    expect(beforeCount).toBeGreaterThan(0);

    const firstPaper = page.locator(".bookshelf-grid .book-card").first();
    const deletedTitle = await firstPaper.locator(".book-title").textContent();
    await firstPaper.locator(".more-menu summary").click();
    await firstPaper.getByRole("button", { name: "删除" }).click();

    await expect(page.locator(".bookshelf-grid .book-card")).toHaveCount(beforeCount - 1);
    if (deletedTitle) await expect(page.getByText(deletedTitle)).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-delete");
  });
});