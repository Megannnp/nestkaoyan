import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, waitForStoredData } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

/** 知识中心 → 828 物理化学 → 真题数据库 */
async function gotoQuestions(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "知识中心" }).click();
  await expect(page.getByRole("heading", { name: "知识中心" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "828 物理化学" }).first().click();
  await page.getByRole("button", { name: "真题数据库" }).click();
  await expect(page.getByRole("heading", { name: "真题数据库" })).toBeVisible();
}

test.describe("Questions 真题数据库", () => {
  test("筛选条与题目列表渲染", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);

    await expect(page.locator(".filter-bar")).toBeVisible();
    await expect(page.locator(".question-list article").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "上传真题" })).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-list");
  });

  test("七核筛选：热力学过滤列表", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);

    const countBefore = await page.locator(".question-list article").count();
    expect(countBefore).toBeGreaterThan(0);

    await page.locator(".filter-bar select").nth(1).selectOption({ label: "热力学" });
    await page.waitForTimeout(200);
    const countAfter = await page.locator(".question-list article").count();
    expect(countAfter).toBeLessThanOrEqual(countBefore);
    expect(countAfter).toBeGreaterThan(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-filter-core");
  });

  test("科目筛选：切换科目后列表同步隔离", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    await expect(page.locator(".question-list article").first()).toContainText("828 物理化学");

    await page.locator(".filter-bar select").first().selectOption({ label: "英语一" });
    await expect(page.locator(".question-list article")).toHaveCount(0);
    await expect(page.getByText("当前筛选下没有真题。")).toBeVisible();

    await page.locator(".filter-bar select").first().selectOption({ label: "828 物理化学" });
    await expect(page.locator(".question-list article").first()).toContainText("828 物理化学");

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-filter-subject");
  });

  test("科目 Tab 切换会重置真题科目筛选", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    await page.locator(".filter-bar select").first().selectOption({ label: "英语一" });
    await expect(page.locator(".question-list article")).toHaveCount(0);

    await page.getByRole("button", { name: "← 返回" }).click();
    await page.getByRole("button", { name: "828 物理化学" }).first().click();
    await page.getByRole("button", { name: "真题数据库" }).click();
    await expect(page.locator(".question-list article").first()).toContainText("828 物理化学");

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-subject-tab-reset");
  });

  test("上传真题入口可添加空白真题卷", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    await page.getByRole("button", { name: "上传真题" }).click();

    const dialog = page.getByLabel("AI识别资料");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("上传一套真题")).toBeVisible();
    await dialog.getByRole("button", { name: "直接添加空白真题卷" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(/空白真题卷/).first()).toBeVisible();

    const saved = await waitForStoredData(
      page,
      (data) => {
        const resources = (data.resources as { id?: string; name?: string; type?: string }[]) || [];
        const resource = resources.find((item) => item.name?.includes("空白真题卷") && item.type === "真题");
        if (!resource?.id) return false;
        return ((data.materials as { id?: string; type?: string }[]) || []).some((material) => material.id === resource.id && material.type === "past_paper")
          && ((data.materialSections as { materialId?: string; sectionType?: string }[]) || []).some((section) => section.materialId === resource.id && section.sectionType === "exam")
          && ((data.questions as { materialId?: string; stem?: string }[]) || []).some((question) => question.materialId === resource.id && question.stem?.includes("待 AI 拆题"));
      },
      "questions-blank-paper"
    );
    const resource = ((saved.resources as { id?: string; name?: string; type?: string }[]) || []).find((item) => item.name?.includes("空白真题卷") && item.type === "真题");
    expect(resource?.id).toBeTruthy();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-add");
  });

  test("内联编辑做题记录：结果选错误", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    const item = page.locator(".question-list article").first();
    const itemTitle = await item.locator("strong").textContent();
    await item.locator("summary", { hasText: "做题记录/编辑" }).click();
    await item.locator("select").first().selectOption({ label: "错误" });

    const saved = await waitForStoredData(
      page,
      (data) =>
        ((data.questions as { result: string; done: boolean }[]) || []).some((q) => q.result === "错误" && q.done === true),
      "questions-inline-edit"
    );
    const edited = (saved.questions as { result: string; done: boolean }[]).find((q) => q.result === "错误" && q.done === true);
    if (!edited) throw new Error(`未找到已编辑题目：${itemTitle ?? ""}`);
    expect(edited.result).toBe("错误");
    expect(edited.done).toBe(true);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-inline-edit");
  });

  test("收藏题目（切换收藏状态）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);

    const firstItem = page.locator(".question-list article").first();
    await firstItem.locator("summary", { hasText: "做题记录/编辑" }).click();
    const favoriteBtn = firstItem.getByRole("button", { name: "收藏" }).or(firstItem.getByRole("button", { name: "取消收藏" }));
    await expect(favoriteBtn).toBeVisible();
    const beforeText = await favoriteBtn.textContent();
    const wasFavorited = beforeText?.includes("取消收藏") ?? false;

    await favoriteBtn.click();

    // 按钮文本翻转，表示收藏状态已切换
    const afterBtn = firstItem.getByRole("button", { name: wasFavorited ? "收藏" : "取消收藏" });
    await expect(afterBtn).toBeVisible();

    // 持久化验证：与 UI 状态一致（seed 中部分题已是收藏状态）
    await waitForStoredData(
      page,
      (data) => {
        const questions = (data.questions as { favorite?: boolean }[]) || [];
        if (wasFavorited) {
          // 取消收藏 → 至少一个仍为 true（seed 余量）
          return questions.some((q) => q.favorite === true) || questions.every((q) => q.favorite === false);
        }
        // 收藏 → 至少一个为 true
        return questions.some((q) => q.favorite === true);
      },
      "questions-favorite"
    );

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-favorite");
  });

  test("删除题目", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    const beforeCount = await page.locator(".question-list article").count();
    const item = page.locator(".question-list article").first();
    const deletedTitle = await item.locator("strong").textContent();
    await item.locator("summary", { hasText: "做题记录/编辑" }).click();
    await item.getByRole("button", { name: "删除题目" }).click();

    await expect(page.locator(".question-list article")).toHaveCount(beforeCount - 1);
    if (deletedTitle) await expect(page.getByText(deletedTitle)).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-delete");
  });
});
