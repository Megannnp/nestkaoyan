import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, waitForStoredData } from "./helpers";

const DEMO_PDF = Buffer.from(
  "%PDF-1.4\n%验收测试\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
);

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

/** 知识中心 → 828 物理化学 → 学习资料（Reader） */
async function gotoReader(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "知识中心" }).click();
  // 等待事件系统稳定（Vite HMR 并行 worker 下 click 事件可能尚未绑定）
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "828 物理化学" }).first().click();
  await page.getByRole("button", { name: "学习资料" }).click();
}

test.describe("Reader 阅读器", () => {
  test("翻页 + 页码输入框变化", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);

    const pageInput = page.locator(".paginationBar input, [class*=paginationBar] input").first();
    await expect(pageInput).toBeVisible();
    const pageBefore = await pageInput.inputValue();

    await page.getByRole("button", { name: "下一页 ›" }).click();
    await page.waitForTimeout(200);
    const pageAfter = await pageInput.inputValue();
    expect(pageAfter).not.toBe(pageBefore);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-page-nav");
  });

  test("搜索输入接管控制", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);

    const searchInput = page.locator("input[placeholder='🔍 搜索']").first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("熵变");
    await expect(searchInput).toHaveValue("熵变");
    // 输入不被清空，且页面不崩溃（seed 批注存在时内容区被批注覆盖，不强制高亮）
    await expect(page.locator(".readerGrid, [class*=readerGrid]").first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-search");
  });

  test("缩放切换 80%/100%/125%", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);
    // 等待事件系统稳定（Vite HMR 并行 worker 下点击可能尚未绑定）
    await page.waitForTimeout(300);

    const zoomSelect = page.locator(".readerZoomSelect, [class*=readerZoomSelect]").first();
    await expect(zoomSelect).toBeVisible();
    await zoomSelect.selectOption("80%");
    await expect(zoomSelect).toHaveValue("80%");
    await zoomSelect.selectOption("125%");
    await expect(zoomSelect).toHaveValue("125%");

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-zoom");
  });

  test("演示模式内容渲染", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);

    await expect(page.getByText("演示模式（Demo）")).toBeVisible();
    await expect(page.locator("[class*=readerContent] p").first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-demo-content");
  });

  test("AI 阅读助手折叠展开", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);

    const aiSummary = page.locator("[class*=aiAssistantSummary]").first();
    await aiSummary.click();
    await expect(page.getByText("本页重点：")).toBeVisible();
    await expect(page.getByText("考频：")).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-ai-assistant");
  });

  test("新建批注并持久化", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);
    await expect(page.locator(".readerGrid, [class*=readerGrid]").first()).toBeVisible();

    // 打开批注面板
    await page.getByRole("button", { name: /📌 批注/ }).click();
    await page.getByRole("button", { name: "✏ 新建" }).click();
    await expect(page.getByText("✏ 新建批注")).toBeVisible();

    const textarea = page.locator("textarea").first();
    await textarea.fill("E2E验收测试批注");
    await page.getByRole("button", { name: "确认添加" }).click();

    // 批注列表出现（避免 strict mode：注解在内容区和面板各一处 + toast）
    await expect(page.locator(".annotationText, [class*=annotationText]").filter({ hasText: "E2E验收测试批注" }).first()).toBeVisible();

    // 持久化
    await waitForStoredData(
      page,
      (data) => ((data.annotations as { selection: string }[]) || []).some((a) => a.selection === "E2E验收测试批注"),
      "reader-annotation-create"
    );

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-annotation-create");
  });

  test("批注编辑", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    // 先创建一条批注
    await gotoReader(page);
    await page.getByRole("button", { name: /📌 批注/ }).click();
    await page.getByRole("button", { name: "✏ 新建" }).click();
    await page.locator("textarea").first().fill("待编辑批注");
    await page.getByRole("button", { name: "确认添加" }).click();
    await expect(page.locator(".annotationText, [class*=annotationText]").filter({ hasText: "待编辑批注" }).first()).toBeVisible();

    // 编辑（prompt 对话框）—— 定位到包含测试批注的条目
    page.once("dialog", (dialog) => dialog.accept("编辑后的批注"));
    const myEditItem = page
      .locator("[class*=annotationItem]")
      .filter({ has: page.locator("[class*=annotationText]").filter({ hasText: "待编辑批注" }) })
      .first();
    await myEditItem.getByRole("button", { name: "编辑" }).click();
    // onEditAnnotation 更新的是 note（.annotationNote），selection 不变
    await expect(myEditItem.locator("[class*=annotationNote]").filter({ hasText: "编辑后的批注" }).first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-annotation-edit");
  });

  test("批注删除", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);
    await page.getByRole("button", { name: /📌 批注/ }).click();
    await page.getByRole("button", { name: "✏ 新建" }).click();
    await page.locator("textarea").first().fill("待删除批注");
    await page.getByRole("button", { name: "确认添加" }).click();

    page.once("dialog", (dialog) => dialog.accept());
    const myDeleteItem = page
      .locator("[class*=annotationItem]")
      .filter({ has: page.locator("[class*=annotationText]").filter({ hasText: "待删除批注" }) })
      .first();
    await myDeleteItem.getByRole("button", { name: "删除" }).click();
    await expect(page.locator(".annotationText, [class*=annotationText]").filter({ hasText: "待删除批注" })).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-annotation-delete");
  });

  test("PDF 上传 → AI 识别 → 确认保存", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);
    await page.getByRole("button", { name: "上传资源" }).click();

    const dialog = page.getByLabel("AI识别资料");
    await expect(dialog).toBeVisible();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "傅献彩物理化学E2E.pdf",
      mimeType: "application/pdf",
      buffer: DEMO_PDF,
    });

    // AI 识别状态机推进到 done
    await expect(dialog.getByText("AI 识别结果")).toBeVisible({ timeout: 5000 });
    await dialog.getByRole("button", { name: "确认保存" }).click();

    // 资源卡出现（inferResource 会把文件名规范化为 傅献彩《物理化学》）
    await expect(page.locator(".book-card", { hasText: "傅献彩《物理化学》" }).first()).toBeVisible();

    // 持久化（按 fileName 检查原始文件名）
    await waitForStoredData(
      page,
      (data) => ((data.resources as { fileName: string }[]) || []).some((r) => r.fileName === "傅献彩物理化学E2E.pdf"),
      "reader-pdf-upload"
    );

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-pdf-upload");
  });

  test("刷新后重新打开：Reader 与批注恢复", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    // 创建批注
    await gotoReader(page);
    await page.getByRole("button", { name: /📌 批注/ }).click();
    await page.getByRole("button", { name: "✏ 新建" }).click();
    await page.locator("textarea").first().fill("刷新持久化批注");
    await page.getByRole("button", { name: "确认添加" }).click();
    await expect(page.locator(".annotationText, [class*=annotationText]").filter({ hasText: "刷新持久化批注" }).first()).toBeVisible();
    await waitForStoredData(
      page,
      (data) => ((data.annotations as { selection: string }[]) || []).some((a) => a.selection === "刷新持久化批注"),
      "reader-reload-save"
    );

    // 刷新并重新进入
    await page.reload();
    await gotoReader(page);

    await expect(page.locator(".readerGrid, [class*=readerGrid]").first()).toBeVisible();
    await page.getByRole("button", { name: /📌 批注/ }).click();
    await expect(page.locator(".annotationText, [class*=annotationText]").filter({ hasText: "刷新持久化批注" }).first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-reload-restore");
  });
});