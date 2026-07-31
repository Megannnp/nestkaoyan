import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const results = [];
const consoleErrors = [];
const pageErrors = [];
const rec = (name, { entry, steps, expected, actual, status, severity, rootCause }) => results.push({ name, entry, steps, expected, actual, status, severity, rootCause });
const readLS = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("nest-exam-workspace-v3")); } catch { return null; } });

async function timerText(page) {
  // 读"已学习 X 分钟 Y 秒"行中的秒数（最精确：取任务行内 bold 累计文本）
  return page.locator(".task-row").nth(0).locator("span.font-bold").last().textContent().catch(() => "");
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

  // ── 1B-1: Review 保存 + 刷新 ──
  await page.locator("aside button", { hasText: "今日工作台" }).click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "今日复盘" }).click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "填写复盘" }).click();
  await page.locator('[role="dialog"][aria-label="填写复盘"]').waitFor({ state: "visible", timeout: 3000 });
  const dlg = page.locator('[role="dialog"][aria-label="填写复盘"]');
  await dlg.locator("input").nth(0).fill("1B复盘：完成热力学熵变计算");
  await dlg.locator("input").nth(1).fill("1B困难：相平衡判断");
  await dlg.locator("button", { hasText: "提交复盘" }).click();
  await page.waitForTimeout(500);
  const s1 = await readLS(page);
  const reviewSaved = s1?.review?.done?.includes("1B复盘") && s1.review?.hard === "1B困难：相平衡判断";
  await page.locator("button", { hasText: "填写复盘" }).click();
  await page.locator('[role="dialog"][aria-label="填写复盘"]').waitFor({ state: "visible", timeout: 3000 });
  const reopenVal = await page.locator('[role="dialog"] input').nth(0).inputValue().catch(() => "");
  await page.locator('[role="dialog"] button', { hasText: "关闭" }).click().catch(() => {});
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const s2 = await readLS(page);
  const reviewAfterReload = s2?.review?.done?.includes("1B复盘");
  await page.locator("button", { hasText: "今日复盘" }).click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "填写复盘" }).click();
  await page.locator('[role="dialog"][aria-label="填写复盘"]').waitFor({ state: "visible", timeout: 3000 });
  const reopenAfterReload = await page.locator('[role="dialog"] input').nth(0).inputValue().catch(() => "");
  await page.locator('[role="dialog"] button', { hasText: "关闭" }).click().catch(() => {});
  rec("1B-1 Review保存+刷新", { entry: "今日复盘→填写复盘→提交→刷新→再打开", steps: ["填写2字段","提交","再打开","刷新","再打开"], expected: "提交后可见；刷新后内容仍存在", actual: `saved=${reviewSaved} reopen=${reopenVal.includes("1B复盘")} afterReload=${reviewAfterReload} reopen2=${reopenAfterReload.includes("1B复盘")}`, status: (reviewSaved && reviewAfterReload && reopenAfterReload.includes("1B复盘")) ? "PASS" : "BROKEN", severity: "P1", rootCause: !reviewSaved ? "review 未写入 storage" : "刷新后未恢复" });

  // ── 1B-2: 新增题目可见 + 刷新 ──
  await page.locator("aside button", { hasText: "知识中心" }).click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "真题数据库" }).first().click();
  await page.waitForTimeout(300);
  const qBefore = await page.locator(".question-list article").count();
  await page.locator("button", { hasText: "录入题目" }).click();
  await page.locator('[role="dialog"][aria-label="手动录入题目"]').waitFor({ state: "visible", timeout: 3000 });
  const qd = page.locator('[role="dialog"][aria-label="手动录入题目"]');
  await qd.locator('input[name="stem"]').fill("1B验收题目：熵变计算适用条件");
  await qd.locator('input[name="year"]').fill("2031");
  await qd.locator('input[name="number"]').fill("66");
  await qd.locator("button", { hasText: "手动录入题目" }).click();
  await page.waitForTimeout(600);
  const qAfter = await page.locator(".question-list article").count();
  const s3 = await readLS(page);
  const qVisibleNow = await page.locator("text=1B验收题目").count() > 0;
  const qSaved = (s3?.questions || []).some((q) => q.stem.includes("1B验收题目"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.locator("aside button", { hasText: "知识中心" }).click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "真题数据库" }).first().click();
  await page.waitForTimeout(300);
  const qVisibleAfterReload = await page.locator("text=1B验收题目").count() > 0;
  rec("1B-2 新增题目可见+刷新", { entry: "真题数据库→录入题目", steps: ["录1B验收题目","保存","刷新","再看"], expected: "当前科目列表立即可见；刷新后仍可见", actual: `before=${qBefore} after=${qAfter} visibleNow=${qVisibleNow} saved=${qSaved} afterReload=${qVisibleAfterReload}`, status: (qVisibleNow && qSaved && qVisibleAfterReload) ? "PASS" : "BROKEN", severity: "P1", rootCause: !qVisibleNow ? "新题未在当前科目可见" : !qVisibleAfterReload ? "刷新后丢失" : "" });

  // ── 1B-4: Agent 傅献彩跳转 → resources + Reader（demo 无 canvas，验证批注入口/反馈）──
  await page.locator("aside button", { hasText: "AI学习助手" }).click();
  await page.waitForTimeout(300);
  await page.locator(".quick-prompts button", { hasText: "傅献彩哪里讲这个" }).click();
  await page.waitForTimeout(600);
  const resourcesVisible = await page.locator("text=学习资源库").count() > 0;
  const readerVisible = await page.locator("button", { hasText: /📌 批注/ }).count() > 0;
  const noticeVisible = await page.locator("text=/已打开：傅献彩|傅献彩《物理化学》第六版/").count() > 0;
  rec("1B-4 Agent跳转Reader", { entry: "Agent quick prompt 傅献彩哪里讲这个", steps: ["点傅献彩","检查落地"], expected: "到达 resources 面板并打开 Reader（非 landing）；有反馈提示", actual: `resources=${resourcesVisible} reader=${readerVisible} notice=${noticeVisible}`, status: (resourcesVisible && readerVisible && noticeVisible) ? "PASS" : "BROKEN", severity: "P1", rootCause: !resourcesVisible ? "未 setActiveKnowledgePanel(resources)" : !readerVisible ? "Reader 未打开（批注入口缺失）" : "无反馈提示" });

  // ── 1B-3: 计时 开始→暂停冻结→继续增长（读具体秒数）──
  await page.locator("aside button", { hasText: "今日工作台" }).click();
  await page.waitForTimeout(300);
  await page.locator(".task-row").nth(0).locator("button", { hasText: "开始学习" }).first().click();
  await page.waitForTimeout(1600);
  await page.locator(".task-row").nth(0).locator("button", { hasText: "暂停" }).first().click();
  await page.waitForTimeout(300);
  const tPause1 = await timerText(page);
  await page.waitForTimeout(1500);
  const tPause2 = await timerText(page);
  const pausedStable = tPause1 === tPause2;
  await page.locator(".task-row").nth(0).locator("button", { hasText: "继续学习" }).click();
  await page.waitForTimeout(1600);
  const tResume = await timerText(page);
  const resumedGrows = tResume !== tPause2;
  await page.locator(".task-row").nth(0).locator("button", { hasText: "结束学习" }).click().catch(() => {});
  rec("1B-3 计时暂停/继续", { entry: "任务行学习计时", steps: ["开始","暂停等1.5s","继续等1.5s","结束"], expected: "暂停冻结；继续后重新增长", actual: `pause1=${tPause1} pause2=${tPause2} stable=${pausedStable} resume=${tResume} grew=${resumedGrows}`, status: (pausedStable && resumedGrows) ? "PASS" : "BROKEN", severity: "P1", rootCause: !pausedStable ? "暂停后仍在增长" : !resumedGrows ? "继续后 interval 未重启" : "" });

  const output = { results, consoleErrors, pageErrors };
  console.log("===1B:JSON_START===");
  console.log(JSON.stringify(output, null, 2));
  console.log("===1B:JSON_END===");
  await browser.close();
}

main().catch((e) => { console.error("1B_AUDIT_ERROR:", e); process.exit(1); });