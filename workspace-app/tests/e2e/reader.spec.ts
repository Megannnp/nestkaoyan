import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, waitForStoredData } from "./helpers";

const DEMO_PDF = Buffer.from(
  "%PDF-1.4\n%验收测试\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
);

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

/** 知识中心 → 政治 → 学习资料（Reader） */
async function gotoReader(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "知识中心" }).click();
  // 等待事件系统稳定（Vite HMR 并行 worker 下 click 事件可能尚未绑定）
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "政治" }).first().click();
  await page.getByRole("button", { name: "学习资料" }).click();
  await expect(page.locator(".bookshelf-grid .book-card").first()).toBeVisible();
  await page.locator(".bookshelf-grid .book-card").first().click();
  await expect(page.locator(".readerGrid, [class*=readerGrid]").first()).toBeVisible();
}

test.describe("Reader 阅读器", () => {
  test("翻页 + 页码输入框变化", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);

    const pageInput = page.locator(".paginationBar input, [class*=paginationBar] input").first();
    await expect(pageInput).toBeVisible();
    const pageBefore = await pageInput.inputValue();

    await page.getByRole("button", { name: "下一页 ›" }).click();
    // 用 toHaveValue 自动轮询等待页码变化（固定 waitForTimeout 在并发/HMR 下偶发读旧值，导致 flaky）
    await expect(pageInput).not.toHaveValue(pageBefore);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-page-nav");
  });

  test("搜索输入接管控制", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);

    const searchInput = page.locator("input[placeholder='🔍 搜索']").first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("现代化");
    await expect(searchInput).toHaveValue("现代化");
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

  test("内置真题 PDF 原卷渲染", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);

    // 政治 2024 有 staticPdf → pdf.js 渲染真实原卷 canvas（不再是演示概览）
    await expect(page.locator("[class*=pdfPageWrap], [class*=readerCanvas]").first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-pdf-render");
  });

  test("AI 阅读助手折叠展开", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);

    const aiSummary = page.locator("[class*=aiAssistantSummary]").first();
    await aiSummary.click();
    // 展开后展示资料信息与操作按钮（不再断言模型流式输出文本，输出内容随 DeepSeek 变化）
    await expect(page.getByText(/资料：/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "📄 找真题" })).toBeVisible();

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

    // 编辑（内联表单，替代原生 prompt）
    const myEditItem = page
      .locator("[class*=annotationItem]")
      .filter({ has: page.locator("[class*=annotationText]").filter({ hasText: "待编辑批注" }) })
      .first();
    await myEditItem.getByRole("button", { name: "编辑" }).click();
    // 内联输入框出现：填入新 note 并保存
    const inlineInput = myEditItem.locator("input[placeholder='批注备注']");
    await expect(inlineInput).toBeVisible();
    await inlineInput.fill("编辑后的批注");
    await myEditItem.getByRole("button", { name: "保存" }).click();
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

    // 删除（两阶段确认，替代原生 confirm）：点击「删除」→ 出现「确认删除」→ 点击确认
    const myDeleteItem = page
      .locator("[class*=annotationItem]")
      .filter({ has: page.locator("[class*=annotationText]").filter({ hasText: "待删除批注" }) })
      .first();
    await myDeleteItem.getByRole("button", { name: "删除" }).click();
    await expect(myDeleteItem.getByRole("button", { name: "确认删除" })).toBeVisible();
    await myDeleteItem.getByRole("button", { name: "确认删除" }).click();
    await expect(page.locator(".annotationText, [class*=annotationText]").filter({ hasText: "待删除批注" })).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "reader-annotation-delete");
  });

  test("PDF 上传 → AI 自动识别 → 资源入库", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReader(page);
    await page.getByRole("button", { name: "← 返回书架" }).click();
    await page.getByRole("button", { name: "上传真题" }).click();

    const dialog = page.getByLabel("AI识别资料");
    await expect(dialog).toBeVisible();
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "politics-2025.pdf",
      mimeType: "application/pdf",
      buffer: DEMO_PDF,
    });

    // 2026-08-03 起上传即自动 AI 识别入库（不再进入待确认队列）
    // 等待上传完成消息（验证上传链路与自动识别）
    await expect(page.getByText(/批量上传完成|AI 自动识别完成/).first()).toBeVisible({ timeout: 10000 });

    // 持久化（按 fileName 检查原始文件名）
    await waitForStoredData(
      page,
      (data) => ((data.resources as { fileName: string }[]) || []).some((r) => r.fileName === "politics-2025.pdf"),
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
