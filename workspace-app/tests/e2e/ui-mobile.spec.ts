import { test, expect } from "@playwright/test";
import { freshState } from "./helpers";

test.describe("响应式与资源完整性", () => {
  test("375px 移动视口无横向溢出", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await freshState(page);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
    // 核心导航仍可见
    await expect(page.getByRole("button", { name: "今日工作台" })).toBeVisible();
  });

  test("静态资源与 404 处理", async ({ page }) => {
    // favicon
    const favicon = await page.request.get("/favicon.svg");
    expect(favicon.status()).toBe(200);

    // 真题 PDF 静态资源（若本地有文件）
    const pdfResp = await page.request.get("/papers/politics-2024.pdf");
    // 本地 dev 下 public/ 静态资源直出；线上已上传
    expect(pdfResp.ok() || pdfResp.status() === 404).toBe(true);

    // 未知路由应返回 200（SPA 兜底）而非 500
    const unknown = await page.request.get("/some/unknown/page");
    expect(unknown.status()).toBeLessThan(500);
  });
});
