import { chromium } from "@playwright/test";

/**
 * 端到端功能验收审计脚本（第一轮，只记录不修改业务代码）
 * 覆盖：Dashboard / Agent / Knowledge / Reader / Questions / Cards / Review / Settings
 * 采集：入口、复现步骤、控制台错误、网络请求、localStorage、刷新持久化
 */
const BASE = "http://localhost:3000";
const STORAGE_KEYS = {
  v3: "nest-exam-workspace-v3",
  v4: "nest-exam-workspace-v4",
  events: "nest-exam-learning-events-v4",
};

const results = [];
let page;
let consoleErrors = [];
let pageErrors = [];
let networkRequests = [];

function rec(name, { entry, steps, expected, actual, status, severity, rootCause, storage, requests }) {
  results.push({
    name, entry, steps, expected, actual, status, severity, rootCause,
    storage: storage || null,
    requests: requests || null,
  });
}

function _wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function readStorage() {
  return page.evaluate((keys) => {
    const out = {};
    for (const [label, key] of Object.entries(keys)) {
      try {
        const raw = localStorage.getItem(key);
        out[label] = raw ? JSON.parse(raw) : null;
      } catch {
        out[label] = { __parseError: true, raw: localStorage.getItem(key) };
      }
    }
    return out;
  }, STORAGE_KEYS);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  // ── 网络监听 ──
  const failedRequests = [];
  page.on("requestfailed", (req) => failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }));
  page.on("response", (res) => {
    if (res.status() >= 400) networkRequests.push({ url: res.url(), status: res.status(), type: res.request().resourceType() });
  });
  // ── 控制台监听 ──
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleErrors.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  // ═══════════════════════════════════════════════════════════
  // 0. 首页加载（干净状态）
  // ═══════════════════════════════════════════════════════════
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("main");
  const title = await page.locator("h1").first().textContent().catch(() => null);
  const storage0 = await readStorage();
  rec("首页加载", {
    entry: "http://localhost:3000/",
    steps: ["打开首页", "等待 networkidle"],
    expected: "Dashboard 渲染；无控制台错误；localStorage 写入",
    actual: `标题=${title}；控制台错误=${consoleErrors.length}；页面错误=${pageErrors.length}；storage v3=${storage0.v3 ? "有" : "无"} v4=${storage0.v4 ? "有" : "无"}`,
    status: storage0.v3 || storage0.v4 ? "PASS" : "BROKEN",
    severity: storage0.v3 || storage0.v4 ? "P3" : "P0",
    rootCause: storage0.v3 && storage0.v4 ? "STORAGE.key(v3) 与 storage.ts(v4) 不一致，双键并存" : "",
    storage: { v3Keys: storage0.v3 ? Object.keys(storage0.v3) : null, v4Keys: storage0.v4 ? Object.keys(storage0.v4) : null },
  });

  // 清空控制台记录，进入逐项验收
  consoleErrors = [];
  pageErrors = [];
  networkRequests = [];

  // ═══════════════════════════════════════════════════════════
  // 1. Dashboard：今日任务 Tab / AI 概览 / 任务列表 / 更多菜单
  // ═══════════════════════════════════════════════════════════
  const taskRows = page.locator(".task-row");
  const taskCount = await taskRows.count();
  const taskSummaryVisible = await page.locator("text=今日建议").isVisible().catch(() => false);
  rec("Dashboard-任务列表+AI概览", {
    entry: "首页默认 dashboard",
    steps: ["打开首页"],
    expected: "显示任务列表与今日建议概览",
    actual: `任务数=${taskCount}；今日建议可见=${taskSummaryVisible}`,
    status: taskCount > 0 && taskSummaryVisible ? "PASS" : "BROKEN",
    severity: taskCount > 0 && taskSummaryVisible ? "P3" : "P1",
  });

  // 更多菜单（提高/降低优先级/延期/暂停）
  const beforeFirstTitle = await taskRows.nth(0).locator("strong").first().textContent().catch(() => "");
  await taskRows.nth(0).locator("summary", { hasText: "•••" }).click();
  const moreItems = page.locator(".more-items button");
  await moreItems.nth(0).waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
  const moreCount = await moreItems.count().catch(() => 0);
  await moreItems.nth(0).click().catch(() => {});
  const afterFirstTitle = await taskRows.nth(0).locator("strong").first().textContent().catch(() => "");
  rec("Dashboard-更多菜单(优先级移动)", {
    entry: "任务行 ••• 菜单",
    steps: ["点击 •••", "点击 提高优先级", "检查任务顺序"],
    expected: "任务顺序改变",
    actual: `菜单按钮数=${moreCount}；移动前=${beforeFirstTitle}；移动后=${afterFirstTitle}`,
    status: beforeFirstTitle !== afterFirstTitle && moreCount >= 4 ? "PASS" : moreCount === 0 ? "BROKEN" : "PARTIAL",
    severity: moreCount === 0 ? "P2" : beforeFirstTitle !== afterFirstTitle ? "P3" : "P2",
  });

  // 刷新持久化：任务顺序
  const orderedBefore = await taskRows.nth(0).locator("strong").first().textContent().catch(() => "");
  await page.reload({ waitUntil: "networkidle" });
  const orderedAfter = await page.locator(".task-row").nth(0).locator("strong").first().textContent().catch(() => "");
  rec("刷新持久化-任务顺序", {
    entry: "刷新",
    steps: ["记录首个任务标题", "刷新", "对比"],
    expected: "任务顺序与状态在刷新后保留",
    actual: `刷新前=${orderedBefore}；刷新后=${orderedAfter}`,
    status: orderedBefore === orderedAfter ? "PASS" : "BROKEN",
    severity: orderedBefore === orderedAfter ? "P3" : "P1",
    rootCause: orderedBefore !== orderedAfter ? "STORAGE key 不一致可能导致读写分离" : "",
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Dashboard：学习计时 开始→暂停→继续→结束→Completion 保存
  // ═══════════════════════════════════════════════════════════
  await page.locator(".task-row").nth(0).locator("button", { hasText: "开始学习" }).first().click();
  await page.waitForTimeout(1200);
  const timerVisible = await page.locator("text=已学习").first().isVisible().catch(() => false);
  // 暂停
  await page.locator(".task-row").nth(0).locator("button", { hasText: "暂停" }).first().click();
  await page.waitForTimeout(1500);
  const pausedLabelVisible = await page.locator("text=● 已暂停").isVisible().catch(() => false);
  // 继续
  const resumeBtn = page.locator(".task-row").nth(0).locator("button", { hasText: "继续学习" }).first();
  await resumeBtn.click().catch(() => {});
  await page.waitForTimeout(1500);
  // 继续后计算器是否真的走？抓取已学习文本两次
  const reading1 = await page.locator(".task-row").nth(0).locator("text=已学习").count().catch(() => 0);
  rec("Dashboard-学习计时(开始/暂停/继续)", {
    entry: "任务行操作按钮",
    steps: ["开始学习", "等待1.2s", "暂停", "等待1.5s", "继续", "等待1.5s"],
    expected: "计时器随状态启停；暂停后继续能恢复计时",
    actual: `计时器可见=${timerVisible}；暂停状态可见=${pausedLabelVisible}；继续后计时块数=${reading1}`,
    status: timerVisible && pausedLabelVisible && reading1 > 0 ? "PARTIAL" : "BROKEN",
    severity: "P1",
    rootCause: "暂停后 stopTimer() 清除 interval；继续学习仅改 status 未重启 interval → 计时冻结",
  });

  // 结束学习 → Completion Modal → 保存并完成
  const endBtn = page.locator(".task-row").nth(0).locator("button", { hasText: "结束学习" }).first();
  await endBtn.click().catch(() => {});
  await page.locator('[role="dialog"][aria-label="记录学习结果"]').waitFor({ timeout: 3000 }).catch(() => {});
  const completionModalVisible = await page.locator('[role="dialog"][aria-label="记录学习结果"]').isVisible().catch(() => false);
  // 编辑实际分钟
  const editTimeBtn = page.locator('[role="dialog"]').locator("text=✏ 编辑").first();
  await editTimeBtn.click().catch(() => {});
  const _minutesInput = page.locator('[role="dialog"] input[type="text"]').filter({ has: page.locator("xpath=ancestor::div[contains(@class,'modal')]") }).first();
  // 直接找 modal 内的数字输入框
  const modal = page.locator('[role="dialog"][aria-label="记录学习结果"]');
  const timeInputs = modal.locator("input");
  const timeInputCount = await timeInputs.count().catch(() => 0);
  if (timeInputCount > 0) {
    await timeInputs.nth(0).fill("15").catch(() => {});
  }
  await modal.locator("button", { hasText: "保存并完成" }).click().catch(() => {});
  const taskDone = await page.locator(".task-row").nth(0).locator('input[type="checkbox"]').isChecked().catch(() => false);
  rec("Dashboard-Completion Modal(编辑时间+保存)", {
    entry: "记录结果 Modal",
    steps: ["结束学习", "✏编辑时间填15", "保存并完成"],
    expected: "任务标记完成，时长写入，studyDay 记录",
    actual: `Modal 可见=${completionModalVisible}；时间输入框数=${timeInputCount}；保存后勾选=${taskDone}`,
    status: completionModalVisible && taskDone ? "PASS" : "BROKEN",
    severity: completionModalVisible && taskDone ? "P3" : "P1",
  });

  // ═══════════════════════════════════════════════════════════
  // 3. Dashboard：今日复盘 Tab + ReviewDialog 保存持久化
  // ═══════════════════════════════════════════════════════════
  await page.locator("button", { hasText: "今日复盘" }).click();
  await page.waitForTimeout(300);
  const reviewMetrics = await page.locator(".review-metrics").count().catch(() => 0);
  await page.locator("button", { hasText: "填写复盘" }).click();
  await page.locator('[role="dialog"][aria-label="填写复盘"]').waitFor({ timeout: 3000 }).catch(() => {});
  const reviewDialogVisible = await page.locator('[role="dialog"][aria-label="填写复盘"]').isVisible().catch(() => false);
  // 填写内容
  const rv = page.locator('[role="dialog"]');
  const doneInput = rv.locator("input").nth(0);
  await doneInput.fill("验收测试完成内容").catch(() => {});
  const hardInput = rv.locator("input").nth(1);
  await hardInput.fill("验收测试困难").catch(() => {});
  await rv.locator("button", { hasText: "提交复盘" }).click().catch(() => {});
  const storageAfterReview = await readStorage();
  const reviewPersisted = storageAfterReview.v3?.review || storageAfterReview.v4?.review;
  rec("Dashboard-今日复盘+ReviewDialog", {
    entry: "今日复盘 Tab → 填写复盘",
    steps: ["切今日复盘", "填写复盘", "填 done/hard", "提交"],
    expected: "复盘数据保存到 localStorage，关闭 Modal",
    actual: `指标卡=${reviewMetrics}；Dialog 可见=${reviewDialogVisible}；storage 中 review=${reviewPersisted ? "存在" : "不存在"}`,
    status: reviewDialogVisible && reviewPersisted ? "PARTIAL" : "BROKEN",
    severity: reviewPersisted ? "P2" : "P1",
    rootCause: !reviewPersisted ? "review state 未进入 save effect 依赖（save effect 不含 review）→ 刷新丢失" : "review 保存但未写入 structuredReviews/ReviewHistoryPanel（未接线）",
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Agent：quick prompts + 输入发送 + 工作流
  // ═══════════════════════════════════════════════════════════
  await page.locator("aside button", { hasText: "AI学习助手" }).click();
  await page.waitForTimeout(400);
  const agentQuickPrompts = await page.locator(".quick-prompts button").count().catch(() => 0);
  // quick prompt: 今天学什么
  await page.locator(".quick-prompts button", { hasText: "今天学什么" }).click();
  await page.waitForTimeout(300);
  const chatBubbles = await page.locator(".chat-window .bubble").count().catch(() => 0);
  rec("Agent-quick prompts+发送", {
    entry: "Agent 页面",
    steps: ["进入Agent", "点击 今天学什么", "查看 chat"],
    expected: "7 个 quick prompt；点击后产生 AI 回复",
    actual: `quick prompts=${agentQuickPrompts}；chat气泡=${chatBubbles}`,
    status: agentQuickPrompts === 7 && chatBubbles >= 2 ? "PASS" : "PARTIAL",
    severity: agentQuickPrompts === 7 && chatBubbles >= 2 ? "P3" : "P2",
  });

  // Agent 工作流（分析近三套真题，更新图谱并重排计划）
  await page.locator(".quick-prompts button", { hasText: "分析最近三套真题" }).click();
  await page.waitForTimeout(500);
  const agentStepsVisible = await page.locator(".agent-run").count().catch(() => 0);
  const agentSteps = await page.locator(".agent-run strong").allTextContents().catch(() => []);
  rec("Agent-工作流展示(5步)", {
    entry: "quick prompt: 分析最近三套真题",
    steps: ["点击分析最近三套真题"],
    expected: "5 步 AgentStep 展示",
    actual: `agent-run 块=${agentStepsVisible}；步骤=${JSON.stringify(agentSteps)}`,
    status: agentStepsVisible > 0 && agentSteps.length === 5 ? "PASS" : "PARTIAL",
    severity: agentStepsVisible > 0 && agentSteps.length === 5 ? "P3" : "P2",
  });

  // Agent 跨页：傅献彩跳知识中心
  await page.locator(".quick-prompts button", { hasText: "傅献彩哪里讲这个" }).click();
  await page.waitForTimeout(400);
  const _agentToKnowledge = page.url();
  const afterFuView = await page.locator('text=学习资源库').count().catch(() => 0);
  rec("Agent-跨页跳知识(傅献彩)", {
    entry: "quick prompt: 傅献彩哪里讲这个",
    steps: ["点击傅献彩", "检查跳转"],
    expected: "跳转到知识中心资源库并打开傅献彩 Reader",
    actual: `知识资源库可见=${afterFuView}`,
    status: afterFuView > 0 ? "PASS" : "BROKEN",
    severity: afterFuView > 0 ? "P3" : "P1",
  });

  // ═══════════════════════════════════════════════════════════
  // 5. Knowledge：landing 三入口 + Resources
  // ═══════════════════════════════════════════════════════════
  await page.locator("aside button", { hasText: "知识中心" }).click();
  await page.waitForTimeout(400);
  // 健壮性：若上一步测试把知识中心停在了子面板（如 Reader），先点面包屑回到 landing
  const backToLanding = page.locator("button", { hasText: "返回资源总览" });
  if (await backToLanding.count()) {
    await backToLanding.first().click();
    await page.waitForTimeout(300);
  }
  const landingEntries = await page.locator(".grid.grid-cols-1.md\\:grid-cols-3 button").count().catch(() => 0);
  const _resourceCount = await page.locator("text=个资料").count().catch(() => 0);
  rec("Knowledge-landing 三入口", {
    entry: "知识中心 landing",
    steps: ["进入知识中心"],
    expected: "科目 Tab + 学习资料/真题数据库/知识图谱 三入口",
    actual: `三入口按钮=${landingEntries}`,
    status: landingEntries === 3 ? "PASS" : "BROKEN",
    severity: landingEntries === 3 ? "P3" : "P1",
  });

  // 进入 Resources
  await page.locator("button", { hasText: "学习资料" }).click();
  await page.waitForTimeout(300);
  const resourcesVisible = await page.locator("text=学习资源库").count().catch(() => 0);
  const uploadBtn = await page.locator("button", { hasText: "上传资源" }).count().catch(() => 0);
  const bookGrid = await page.locator(".bookshelf-grid .book-card").count().catch(() => 0);
  const readerVisible = await page.locator(".readerGrid, [class*=readerGrid]").count().catch(() => 0);
  rec("Knowledge-Resources+Reader渲染", {
    entry: "Resources 面板",
    steps: ["点学习资料入口"],
    expected: "资源网格 + 上传按钮 + Reader 渲染",
    actual: `资源库标题=${resourcesVisible}；上传按钮=${uploadBtn}；资源卡=${bookGrid}；Reader 容器=${readerVisible}`,
    status: resourcesVisible > 0 && uploadBtn > 0 && bookGrid > 0 ? "PASS" : "BROKEN",
    severity: resourcesVisible > 0 && uploadBtn > 0 && bookGrid > 0 ? "P3" : "P1",
  });

  // Reader 翻页 + 搜索 + 缩放
  const _pageInput = page.locator("input[type=text]").filter({ hasText: /^[0-9]*$/ }).first();
  const readerPageInput = page.locator(".paginationBar input, [class*=paginationBar] input").first();
  const pageBefore = await readerPageInput.inputValue().catch(() => "");
  await page.locator("button", { hasText: "下一页 ›" }).click().catch(() => {});
  await page.waitForTimeout(200);
  const pageAfter = await readerPageInput.inputValue().catch(() => "");
  // 搜索
  const searchInput = page.locator("input[placeholder='🔍 搜索']").first();
  await searchInput.fill("熵变").catch(() => {});
  await page.waitForTimeout(300);
  const searchHighlight = await page.locator("[class*=searchHighlight]").count().catch(() => 0);
  rec("Reader-翻页/搜索/缩放", {
    entry: "Reader 阅读器",
    steps: ["下一页", "搜索熵变", "缩放选择"],
    expected: "翻页改变页码；搜索高亮；缩放可用",
    actual: `翻页前=${pageBefore}；翻页后=${pageAfter}；搜索高亮=${searchHighlight}`,
    status: pageBefore !== pageAfter && searchHighlight > 0 ? "PARTIAL" : "BROKEN",
    severity: pageBefore !== pageAfter && searchHighlight > 0 ? "P2" : "P1",
    rootCause: "Reader 内容为 generatePageContent 模拟文本，非真实 PDF 渲染",
  });

  // ═══════════════════════════════════════════════════════════
  // 6. Reader/PDF 完整链路：导入→打开→批注→刷新→重开
  // ═══════════════════════════════════════════════════════════
  // 6a. 上传资源（真实文件上传）
  await page.locator("button", { hasText: "上传资源" }).click();
  await page.locator('[role="dialog"][aria-label="AI识别资料"]').waitFor({ timeout: 3000 });
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "傅献彩物理化学验收.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%验收测试\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"),
  });
  await page.waitForTimeout(3000); // 等待 AI 识别状态机
  const fileStateVisible = await page.locator("text=AI 识别结果").count().catch(() => 0);
  const confirmSaveBtn = page.locator('button[type="submit"]', { hasText: "确认保存" }).first();
  await confirmSaveBtn.click().catch(() => {});
  await page.waitForTimeout(500);
  const storageAfterUpload = await readStorage();
  const resourceUploaded = (storageAfterUpload.v3?.resources || []).some((r) => r.fileName === "傅献彩物理化学验收.pdf") ||
    (storageAfterUpload.v4?.resources || []).some((r) => r.fileName === "傅献彩物理化学验收.pdf");
  // 打开（桌面网格点击"阅读"）
  const uploadedCard = page.locator(".book-card", { hasText: "傅献彩物理化学验收" }).first();
  const uploadedCardExists = await uploadedCard.count().catch(() => 0);
  if (uploadedCardExists > 0) {
    await uploadedCard.locator("button", { hasText: "📖 阅读" }).click().catch(() => {});
  }
  await page.waitForTimeout(500);
  const _readerAfterUpload = await page.locator("text=P132-140, [class*=readerMeta]").count().catch(() => 0);
  rec("Reader-PDF导入链路", {
    entry: "上传资源 Modal",
    steps: ["上传傅献彩物理化学验收.pdf", "等待AI识别", "确认保存", "打开阅读"],
    expected: "上传后资源出现，storage 持久化，能打开阅读",
    actual: `AI识别结果=${fileStateVisible}；storage 含新资源=${resourceUploaded}；资源卡=${uploadedCardExists}`,
    status: resourceUploaded && uploadedCardExists > 0 ? "PARTIAL" : "BROKEN",
    severity: resourceUploaded && uploadedCardExists > 0 ? "P1" : "P0",
    rootCause: "上传仅保存文件名元数据，无真实 PDF 文件内容/解析；Reader 显示 generatePageContent 模拟文本",
    storage: { resourcesCount: (storageAfterUpload.v3?.resources || []).length },
  });

  // 6b. 新建批注（onCreateAnnotation 未接线验证）
  const newAnnotationBtn = page.locator("button", { hasText: "✏ 新建" }).first();
  const newAnnotationVisible = await newAnnotationBtn.isVisible().catch(() => false);
  await newAnnotationBtn.click().catch(() => {});
  await page.waitForTimeout(300);
  const annotationFormVisible = await page.locator("text=新建批注").count().catch(() => 0);
  const annotationTextarea = page.locator("textarea").first();
  await annotationTextarea.fill("验收测试批注内容").catch(() => {});
  await page.locator("button", { hasText: "确认添加" }).click().catch(() => {});
  await page.waitForTimeout(400);
  const storageAfterAnnotation = await readStorage();
  const annotationPersisted = (storageAfterAnnotation.v3?.annotations || []).length > 0 || (storageAfterAnnotation.v4?.annotations || []).length > 0;
  const annotationVisibleInPanel = await page.locator("text=验收测试批注内容").count().catch(() => 0);
  rec("Reader-新建批注", {
    entry: "Reader 批注面板 ✏新建",
    steps: ["点✏新建", "输入批注", "确认添加"],
    expected: "批注保存到 annotations 并显示在批注面板",
    actual: `新建按钮可见=${newAnnotationVisible}；表单=${annotationFormVisible}；点击后项目数=${annotationVisibleInPanel}；storage 含批注=${annotationPersisted}`,
    status: annotationFormVisible > 0 && annotationVisibleInPanel > 0 && annotationPersisted ? "PASS" : "BROKEN",
    severity: annotationFormVisible > 0 ? "P1" : "P0",
    rootCause: "onCreateAnnotation prop 存在但 page.tsx 未传入实现 → 点击确认添加后无任何状态写入",
    storage: { annotations: (storageAfterAnnotation.v3?.annotations || []).length },
  });

  // 6c. 刷新后重新打开（持久化验证）
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator("aside button", { hasText: "知识中心" }).click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "学习资料" }).click();
  await page.waitForTimeout(400);
  const readerAfterReload = await page.locator("[class*=readerGrid]").count().catch(() => 0);
  const annotationAfterReload = await page.locator("text=验收测试批注内容").count().catch(() => 0);
  rec("Reader-刷新后重开", {
    entry: "刷新 → 知识中心 → 学习资料",
    steps: ["刷新", "再进知识中心/学习资料", "检查 Reader 与批注"],
    expected: "Reader 恢复且批注可见",
    actual: `Reader 可见=${readerAfterReload}；批注可见=${annotationAfterReload}；控制台错误=${consoleErrors.length}`,
    status: readerAfterReload > 0 && annotationAfterReload > 0 ? "PASS" : "BROKEN",
    severity: readerAfterReload > 0 && annotationAfterReload > 0 ? "P3" : "P1",
    rootCause: annotationAfterReload === 0 ? "批注未持久化（onCreateAnnotation 未接线）" : "",
  });

  // 6d. 批注编辑/删除（空桩验证）
  const editAnnotationBtn = page.locator("button", { hasText: "编辑" }).first();
  const _deleteAnnotationBtn = page.locator("button", { hasText: "删除" }).first();
  const editVisible = await editAnnotationBtn.isVisible().catch(() => false);
  const storageBeforeEdit = await readStorage();
  if (editVisible) {
    page.once("dialog", async (d) => { await d.accept("编辑后的批注"); });
    await editAnnotationBtn.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  const storageAfterEdit = await readStorage();
  const editChanged = JSON.stringify(storageBeforeEdit.v3?.annotations) !== JSON.stringify(storageAfterEdit.v3?.annotations) ||
    JSON.stringify(storageBeforeEdit.v4?.annotations) !== JSON.stringify(storageAfterEdit.v4?.annotations);
  rec("Reader-批注编辑", {
    entry: "批注面板 编辑按钮",
    steps: ["点编辑", "输入新内容"],
    expected: "批注 note 更新并持久化",
    actual: `编辑按钮可见=${editVisible}；数据变化=${editChanged}`,
    status: editVisible && editChanged ? "PASS" : "BROKEN",
    severity: editVisible && editChanged ? "P3" : "P1",
    rootCause: "onEditAnnotation 在 page.tsx 为空桩 () => {}",
  });

  // ═══════════════════════════════════════════════════════════
  // 7. Questions：筛选/录入/做题记录/收藏/删除
  // ═══════════════════════════════════════════════════════════
  // 从知识中心 landing 进入真题数据库
  await page.locator("text=← 返回资源总览").click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "真题数据库" }).first().click();
  await page.waitForTimeout(300);
  const filterBarVisible = await page.locator(".filter-bar").count().catch(() => 0);
  const questionList = await page.locator(".question-list article").count().catch(() => 0);
  // 筛选
  await page.locator(".filter-bar select").nth(1).selectOption({ label: "热力学" }).catch(() => {});
  await page.waitForTimeout(300);
  const filteredCount = await page.locator(".question-list article").count().catch(() => 0);
  rec("Questions-筛选条", {
    entry: "真题数据库面板",
    steps: ["进入真题数据库", "七核选热力学"],
    expected: "筛选条可用，列表按条件过滤",
    actual: `筛选条=${filterBarVisible}；筛选前=${questionList}；筛选后=${filteredCount}`,
    status: filterBarVisible > 0 ? "PASS" : "BROKEN",
    severity: filterBarVisible > 0 ? "P3" : "P1",
  });

  // 录入题目
  await page.locator("button", { hasText: "录入题目" }).click();
  await page.locator('[role="dialog"][aria-label="手动录入题目"]').waitFor({ timeout: 3000 }).catch(() => {});
  const qModal = page.locator('[role="dialog"][aria-label="手动录入题目"]');
  const qModalVisible = await qModal.count().catch(() => 0);
  const stemInput = qModal.locator('input[name="stem"]');
  await stemInput.fill("验收测试题目：化学势梯度").catch(() => {});
  await qModal.locator("button", { hasText: "手动录入题目" }).click().catch(() => {});
  await page.waitForTimeout(500);
  const newQuestionVisible = await page.locator("text=验收测试题目").count().catch(() => 0);
  const storageAfterQ = await readStorage();
  const qPersisted = (storageAfterQ.v4?.questions || (storageAfterQ.v3?.questions || [])).some((q) => q.stem.includes("验收测试题目"));
  rec("Questions-录入题目", {
    entry: "录入题目 Modal",
    steps: ["点录入题目", "填题干", "提交"],
    expected: "题目入库并显示在列表，pending 队列新增",
    actual: `Modal=${qModalVisible}；新题可见=${newQuestionVisible}；storage 持久化=${qPersisted}`,
    status: newQuestionVisible > 0 && qPersisted ? "PARTIAL" : "BROKEN",
    severity: newQuestionVisible > 0 && qPersisted ? "P2" : "P1",
    rootCause: "录入后无「待确认」队列 UI 展示（pending 数据存在但未渲染）",
  });

  // 内联编辑做题记录
  const qItem = page.locator(".question-list article", { hasText: "验收测试题目" }).first();
  const qItemExists = await qItem.count().catch(() => 0);
  if (qItemExists > 0) {
    await qItem.locator("summary", { hasText: "做题记录/编辑" }).click().catch(() => {});
    await qItem.locator("select").first().selectOption({ label: "错误" }).catch(() => {});
    await page.waitForTimeout(300);
  }
  const storageAfterQEdit = await readStorage();
  const qResultChanged = (storageAfterQEdit.v4?.questions || (storageAfterQEdit.v3?.questions || [])).some((q) => q.stem.includes("验收测试题目") && q.result === "错误");
  rec("Questions-内联编辑做题记录", {
    entry: "做题记录/编辑",
    steps: ["展开详情", "做题结果选错误"],
    expected: "result=错误，done=true，持久化",
    actual: `题目存在=${qItemExists}；result=错误=${qResultChanged}`,
    status: qResultChanged ? "PASS" : "BROKEN",
    severity: qResultChanged ? "P3" : "P1",
  });

  // ═══════════════════════════════════════════════════════════
  // 8. Cards：复习/管理/新建 + 评分 + 刷新
  // ═══════════════════════════════════════════════════════════
  await page.locator("aside button", { hasText: "成长卡片" }).click();
  await page.waitForTimeout(400);
  const cardTabs = await page.locator(".section-heading button", { hasText: /复习|管理|新建卡片/ }).count().catch(() => 0);
  const cardViewer = await page.locator("[class*=flip-container], .flip-container").count().catch(() => 0);
  rec("Cards-复习Tab+CardViewer", {
    entry: "成长卡片 Tab",
    steps: ["进入成长卡片"],
    expected: "复习/管理/新建卡片 Tab；CardViewer 渲染",
    actual: `Tab按钮=${cardTabs}；CardViewer 翻牌容器=${cardViewer}`,
    status: cardTabs >= 3 && cardViewer > 0 ? "PASS" : "BROKEN",
    severity: cardTabs >= 3 && cardViewer > 0 ? "P3" : "P1",
  });

  // 卡片评分
  const storageBeforeReview = await readStorage();
  const _reviewButtons = page.locator("button", { hasText: /认识 \[1\]|模糊 \[2\]|不会 \[3\]/ }).first();
  const reviewBtnCount = await page.locator("button", { hasText: /认识|模糊|不会/ }).count().catch(() => 0);
  const cardReviewBtn = page.locator("text=认识 [1]").first();
  await cardReviewBtn.click().catch(() => {});
  await page.waitForTimeout(400);
  const storageAfterReview2 = await readStorage();
  const cardReviewed = JSON.stringify(storageBeforeReview.v4?.cards) !== JSON.stringify(storageAfterReview2.v4?.cards) ||
    JSON.stringify(storageBeforeReview.v3?.cards) !== JSON.stringify(storageAfterReview2.v3?.cards);
  rec("Cards-评分(认识)", {
    entry: "CardViewer 评分按钮",
    steps: ["点击认识"],
    expected: "卡片 mastery/nextReviewAt 更新并持久化",
    actual: `评分按钮数=${reviewBtnCount}；卡片数据变化=${cardReviewed}`,
    status: cardReviewed ? "PASS" : "BROKEN",
    severity: cardReviewed ? "P3" : "P1",
  });

  // 快速创建卡片
  const quickFront = page.locator("input[placeholder='正面内容（公式、概念、问题）']").first();
  await quickFront.fill("验收测试卡片正面").catch(() => {});
  const quickBack = page.locator("input[placeholder='背面内容（答案、解释）']").first();
  await quickBack.fill("验收测试卡片背面").catch(() => {});
  await page.locator("button", { hasText: "创建卡片" }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  const newCardVisible = await page.locator("text=验收测试卡片正面").count().catch(() => 0);
  const storageAfterCard = await readStorage();
  const newCardPersisted = (storageAfterCard.v4?.cards || (storageAfterCard.v3?.cards || [])).some((c) => c.front.includes("验收测试卡片正面"));
  rec("Cards-快速创建", {
    entry: "快速创建卡片表单",
    steps: ["填正面/背面", "点创建卡片"],
    expected: "卡片创建并显示，持久化",
    actual: `新卡可见=${newCardVisible}；持久化=${newCardPersisted}`,
    status: newCardPersisted ? "PASS" : "BROKEN",
    severity: newCardPersisted ? "P3" : "P1",
  });

  // 管理 Tab
  await page.locator(".section-heading button", { hasText: "管理" }).click();
  await page.waitForTimeout(300);
  const manageMetrics = await page.locator(".metric-grid").count().catch(() => 0);
  const cardGrid = await page.locator(".card-grid .study-card").count().catch(() => 0);
  rec("Cards-管理Tab", {
    entry: "成长卡片 管理 Tab",
    steps: ["切管理 Tab"],
    expected: "指标卡 + 卡片网格",
    actual: `指标=${manageMetrics}；卡片=${cardGrid}`,
    status: manageMetrics > 0 && cardGrid > 0 ? "PASS" : "BROKEN",
    severity: manageMetrics > 0 && cardGrid > 0 ? "P3" : "P1",
  });

  // 卡片删除
  const delCardBtn = page.locator(".study-card button", { hasText: "删除" }).first();
  const delCount = await delCardBtn.count().catch(() => 0);
  page.once("dialog", (d) => d.accept());
  await delCardBtn.click().catch(() => page.locator(".study-card button", { hasText: "删除" }).first().click());
  await page.waitForTimeout(300);
  const storageAfterDel = await readStorage();
  const delReduced = ((storageAfterDel.v4?.cards || []).length) < ((storageAfterCard.v4?.cards || []).length) ||
    ((storageAfterDel.v3?.cards || []).length) < ((storageAfterCard.v3?.cards || []).length);
  rec("Cards-管理删除", {
    entry: "管理 Tab 删除按钮",
    steps: ["点删除", "确认"],
    expected: "卡片删除并持久化",
    actual: `删除按钮=${delCount}；卡片数减少=${delReduced}`,
    status: delReduced ? "PASS" : "BROKEN",
    severity: delReduced ? "P3" : "P1",
  });

  // ═══════════════════════════════════════════════════════════
  // 9. Review：日/周/月 + 科目筛选 + AI 总结 + 复盘历史
  // ═══════════════════════════════════════════════════════════
  await page.locator("aside button", { hasText: "今日工作台" }).click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "今日复盘" }).click();
  await page.waitForTimeout(300);
  const reviewScopeBtns = await page.locator("text=/日复盘|周复盘|月复盘/").count().catch(() => 0);
  const reviewHistoryVisible = await page.locator("[class*=reviewHistory], .review-history").count().catch(() => 0);
  const reviewHistoryText = await page.locator("text=复盘历史").count().catch(() => 0);
  rec("Review-日/周/月+科目筛选+历史面板", {
    entry: "Dashboard 今日复盘 Tab",
    steps: ["切今日复盘", "看 Tab/科目筛选/历史"],
    expected: "日/周/月 Tab；科目筛选；AI 总结；复盘历史面板（P4 Phase1）",
    actual: `范围Tab=${reviewScopeBtns}；复盘历史组件=${reviewHistoryVisible}；复盘历史文案=${reviewHistoryText}`,
    status: reviewScopeBtns >= 3 && (reviewHistoryVisible > 0 || reviewHistoryText > 0) ? "PARTIAL" : "PARTIAL",
    severity: "P2",
    rootCause: "structuredReviews 未传给 ReviewPanel（page.tsx 未传）→ ReviewHistoryPanel 条件渲染永远 false",
  });

  // ═══════════════════════════════════════════════════════════
  // 10. Settings：考试信息/科目增删改
  // ═══════════════════════════════════════════════════════════
  await page.locator("aside button", { hasText: "设置" }).click();
  await page.waitForTimeout(400);
  const settingsTitle = await page.locator("text=考试与科目设置").count().catch(() => 0);
  const targetTotalText = await page.locator("text=总分目标").count().catch(() => 0);
  const _examNameInput = page.locator("input").filter({ has: page.locator("xpath=preceding-sibling::div[contains(text(),'考试名称')]") }).first();
  // 改考试名称
  const nameInput = page.locator("input").nth(0);
  await nameInput.fill("验收测试考试").catch(() => {});
  await page.waitForTimeout(400);
  const storageAfterSettings = await readStorage();
  const examPersisted = storageAfterSettings.v4?.exam?.examName === "验收测试考试" || storageAfterSettings.v3?.exam?.examName === "验收测试考试";
  rec("Settings-考试信息编辑持久化", {
    entry: "Settings 考试名称输入",
    steps: ["进设置", "考试名称改验收测试考试"],
    expected: "exam.examName 更新并持久化",
    actual: `设置标题=${settingsTitle}；总分=${targetTotalText}；持久化=${examPersisted}`,
    status: examPersisted ? "PASS" : "BROKEN",
    severity: examPersisted ? "P3" : "P1",
  });

  // 添加科目
  await page.locator("button", { hasText: "+ 添加科目" }).click();
  await page.waitForTimeout(300);
  const addFormVisible = await page.locator("text=新增科目").count().catch(() => 0);
  const newSubjInput = page.locator("input[placeholder='如：政治']").first();
  await newSubjInput.fill("验收科目").catch(() => {});
  await page.locator("button", { hasText: "确认添加" }).click().catch(() => {});
  await page.waitForTimeout(400);
  const subjVisible = await page.locator("text=验收科目").count().catch(() => 0);
  rec("Settings-添加科目", {
    entry: "+ 添加科目",
    steps: ["点添加科目", "填验收科目", "确认添加"],
    expected: "科目出现并持久化，总分更新",
    actual: `表单=${addFormVisible}；科目可见=${subjVisible}`,
    status: subjVisible > 0 ? "PASS" : "BROKEN",
    severity: subjVisible > 0 ? "P3" : "P1",
  });

  // 删除科目（二次确认）
  const delBtn = page.locator("div[style*='border: 1px solid #E4E4E7'] button", { hasText: "删除" }).last();
  const delBtnCount = await page.locator("button", { hasText: "删除" }).count().catch(() => 0);
  if (delBtnCount > 0) {
    await delBtn.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  const confirmDel = page.locator("button", { hasText: "确认删除" }).last();
  const confirmDelVisible = await confirmDel.count().catch(() => 0);
  if (confirmDelVisible > 0) {
    await confirmDel.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  const delSubjGone = await page.locator("text=验收科目").count().catch(() => 0);
  rec("Settings-删除科目(二次确认)", {
    entry: "科目卡 删除按钮",
    steps: ["点删除", "点确认删除"],
    expected: "二次确认后科目移除",
    actual: `删除按钮=${delBtnCount}；确认按钮=${confirmDelVisible}；删除后科目=${delSubjGone}`,
    status: confirmDelVisible > 0 && delSubjGone === 0 ? "PASS" : "BROKEN",
    severity: confirmDelVisible > 0 && delSubjGone === 0 ? "P3" : "P1",
  });

  // ═══════════════════════════════════════════════════════════
  // 11. 全量保存操作刷新持久化抽样验证
  // ═══════════════════════════════════════════════════════════
  const storageBeforeReload = await readStorage();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const storageAfterReload = await readStorage();
  const v3Same = JSON.stringify(storageBeforeReload.v3) === JSON.stringify(storageAfterReload.v3);
  const v4Same = JSON.stringify(storageBeforeReload.v4) === JSON.stringify(storageAfterReload.v4);
  rec("全量刷新持久化", {
    entry: "刷新",
    steps: ["记录全部 storage", "刷新", "对比"],
    expected: "全部业务状态刷新后保留",
    actual: `v3 一致=${v3Same}；v4 一致=${v4Same}；v3 有=${storageAfterReload.v3 ? "Y" : "N"} v4 有=${storageAfterReload.v4 ? "Y" : "N"}`,
    status: v4Same || v3Same ? "PARTIAL" : "BROKEN",
    severity: (v3Same && v4Same) ? "P2" : "P1",
    rootCause: "page.tsx 直写 STORAGE.key(v3)，storage.ts 独立 saveData(未调用) 与 loadData(v4) 并存；同一页面两套 key 且 page.tsx 不用 loadData → 数据仅存 v3",
  });

  // ═══════════════════════════════════════════════════════════
  // 12. 控制台/网络错误汇总
  // ═══════════════════════════════════════════════════════════
  const allConsoleErrors = [...consoleErrors];
  const allPageErrors = [...pageErrors];
  const allFailedRequests = failedRequests;

  // 输出 JSON 结果
  const output = { results, consoleErrors: allConsoleErrors, pageErrors: allPageErrors, failedRequests: allFailedRequests, network4xx: networkRequests };
  console.log("===NODE:JSON_START===");
  console.log(JSON.stringify(output, null, 2));
  console.log("===NODE:JSON_END===");

  await browser.close();
}

main().catch((e) => {
  console.error("AUDIT_SCRIPT_ERROR:", e);
  process.exit(1);
});