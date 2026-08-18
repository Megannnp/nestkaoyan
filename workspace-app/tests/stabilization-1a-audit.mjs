import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const results = [];
const consoleErrors = [];
const pageErrors = [];

function rec(name, { entry, steps, expected, actual, status, severity, rootCause }) {
  results.push({ name, entry, steps, expected, actual, status, severity, rootCause });
}

function pdf2() {
  return Buffer.from(
    "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 7 0 R>>>>/Contents 8 0 R>>endobj\n" +
    "4 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 7 0 R>>>>/Contents 9 0 R>>endobj\n" +
    "7 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
    "8 0 obj<</Length 44>>stream\nBT /F1 24 Tf 100 700 Td (Page One) Tj ET\nendstream\nendobj\n" +
    "9 0 obj<</Length 44>>stream\nBT /F1 24 Tf 100 700 Td (Page Two) Tj ET\nendstream\nendobj\n" +
    "trailer<</Root 1 0 R/Size 10>>\n%%EOF"
  );
}

const readLS = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("nest-exam-workspace-v3")); } catch { return null; } });

const readIDB = (page) => page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const q = indexedDB.open("nest-exam-pdf-files", 1); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  return await new Promise((res, rej) => { const tx = db.transaction("files", "readonly"); const q = tx.objectStore("files").getAll(); q.onsuccess = () => res(q.result.map((r) => ({ key: r.fileStorageKey, size: r.size }))); q.onerror = () => rej(q.error); });
});

const pageInputValue = (page) => page.locator("[class*=paginationBar] input").first().inputValue().catch(() => "");

async function clickCardRead(page, name) {
  const card = page.locator(".book-card", { hasText: name });
  if (await card.count() > 0) { await card.locator("button", { hasText: "📖 阅读" }).click(); await page.waitForTimeout(900); }
}

async function waitCanvas(page) {
  for (let i = 0; i < 30; i++) {
    const cw = await page.locator("canvas").first().getAttribute("width").catch(() => null);
    if (cw && Number(cw) > 0) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("main");
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await page.locator("aside button", { hasText: "知识中心" }).click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "学习资料" }).click();
  await page.waitForTimeout(300);

  // ① 导入 + IndexedDB
  await page.locator("button", { hasText: "上传资源" }).click();
  await page.locator('[role="dialog"][aria-label="AI识别资料"]').waitFor({ state: "visible", timeout: 3000 });
  await page.locator('input[type="file"]').setInputFiles({ name: "stabilization-1a-test.pdf", mimeType: "application/pdf", buffer: pdf2() });
  await page.waitForTimeout(3200);
  await page.locator('button[type="submit"]', { hasText: "确认保存" }).click();
  await page.waitForTimeout(800);
  const s1 = await readLS(page);
  const res = (s1?.resources || []).find((r) => r.fileName === "stabilization-1a-test.pdf" && r.kind === "pdf");
  const idb = await readIDB(page);
  const idbHit = idb.some((f) => f.key === res?.fileStorageKey && f.size > 0);
  rec("①导入+IndexedDB持久化", { entry: "上传PDF→确认保存", steps: ["上传2页PDF", "识别", "保存"], expected: "kind=pdf + fileStorageKey 命中 IndexedDB", actual: `kind=${!!res} key=${res?.fileStorageKey || "无"} idb=${idbHit}`, status: (res && idbHit) ? "PASS" : "BROKEN", severity: "P0", rootCause: !res ? "无 pdf 资源" : "IndexedDB 未命中" });

  // ② 打开 + 翻页 + canvas（CSS Module 类名混淆：用属性前缀匹配）
  await clickCardRead(page, "stabilization-1a-test");
  const canvasOk = await waitCanvas(page);
  const totalPages = await page.locator("[class*=pageTotal]").first().textContent().catch(() => "");
  const p0 = await pageInputValue(page);
  await page.locator("button", { hasText: "下一页 ›" }).click();
  await page.waitForTimeout(900);
  const p1 = await pageInputValue(page);
  rec("②打开+翻页", { entry: "资源卡📖阅读", steps: ["打开", "等canvas", "下一页"], expected: "canvas渲染 + 总页数≥2 + 翻页页码+1", actual: `canvas=${canvasOk} total=${totalPages} page0=${p0} page1=${p1}`, status: (canvasOk && totalPages.includes("2") && p1 === String(Number(p0) + 1)) ? "PASS" : "BROKEN", severity: "P0", rootCause: !canvasOk ? "canvas未渲染（worker/渲染失败）" : "翻页/页数不符" });

  // ③ 批注创建
  const newBtn = page.locator("button", { hasText: "✏ 新建" });
  const newVisible = await newBtn.isVisible().catch(() => false);
  if (newVisible) { await newBtn.click(); await page.waitForTimeout(300); }
  const formShown = await page.locator("text=✏ 新建批注").count();
  await page.locator("textarea").first().fill("1A验收批注：熵增原理适用条件").catch(() => {});
  await page.locator("button", { hasText: "确认添加" }).click().catch(() => {});
  await page.waitForTimeout(600);
  const s3 = await readLS(page);
  const created = (s3?.annotations || []).some((a) => a.selection.includes("1A验收批注") && a.resourceId === res?.id);
  await page.locator("button", { hasText: /📌 批注/ }).click().catch(() => {});
  await page.waitForTimeout(300);
  rec("③批注创建", { entry: "✏新建", steps: ["新建","输入","确认","开面板"], expected: "按钮可见+表单+storage+面板可见", actual: `btn=${newVisible} form=${formShown} saved=${created}`, status: (newVisible && created) ? "PASS" : "BROKEN", severity: "P0", rootCause: !newVisible ? "onCreateAnnotation未接线" : "未持久化" });

  // ④a 编辑
  page.once("dialog", (d) => d.accept("编辑后的内容"));
  await page.locator("button", { hasText: "编辑" }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const s4a = await readLS(page);
  const edited = (s4a?.annotations || []).some((a) => a.selection.includes("1A验收批注") && a.note === "编辑后的内容" && a.updatedAt);
  rec("④a编辑", { entry: "批注面板编辑", steps: ["编辑","prompt输入"], expected: "note更新+updatedAt", actual: `edited=${edited}`, status: edited ? "PASS" : "BROKEN", severity: "P1", rootCause: "onEditAnnotation未生效" });

  // ④b 刷新恢复
  const before = (s4a?.annotations || []).filter((a) => a.selection.includes("1A验收批注")).length;
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator("aside button", { hasText: "知识中心" }).click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "学习资料" }).click();
  await page.waitForTimeout(300);
  await clickCardRead(page, "stabilization-1a-test");
  await page.locator("button", { hasText: /📌 批注/ }).click().catch(() => {});
  await page.waitForTimeout(300);
  const s4b = await readLS(page);
  const after = (s4b?.annotations || []).filter((a) => a.selection.includes("1A验收批注")).length;
  rec("④b刷新恢复", { entry: "刷新→重开PDF", steps: ["刷新","重进","打开","看批注"], expected: "批注数不变+重开可见", actual: `before=${before} after=${after}`, status: (before === after && after > 0) ? "PASS" : "BROKEN", severity: "P0", rootCause: "批注未持久化/未恢复" });

  // ④c 删除
  page.once("dialog", (d) => d.accept());
  await page.locator("button", { hasText: "删除" }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const s4c = await readLS(page);
  const afterDel = (s4c?.annotations || []).filter((a) => a.selection.includes("1A验收批注")).length;
  rec("④c删除", { entry: "批注面板删除", steps: ["删除","确认"], expected: "annotations移除", actual: `afterDel=${afterDel}`, status: afterDel === 0 ? "PASS" : "BROKEN", severity: "P1", rootCause: "onDeleteAnnotation未生效" });

  const output = { results, consoleErrors, pageErrors };
  console.log("===1A:JSON_START===");
  console.log(JSON.stringify(output, null, 2));
  console.log("===1A:JSON_END===");
  await browser.close();
}

main().catch((e) => { console.error("1A_AUDIT_ERROR:", e); process.exit(1); });