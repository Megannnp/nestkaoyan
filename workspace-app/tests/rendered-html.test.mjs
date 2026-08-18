import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the kaoyan learning agent workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>筑巢考研工作台<\/title>/i);
  assert.match(html, /筑巢考研/);
  assert.match(html, /Learning Agent/);
  assert.match(html, /今日任务/);
  assert.match(html, /核心工作区/);
  assert.match(html, /今日工作台/);
  assert.match(html, /AI学习助手/);
  assert.match(html, /知识中心/);
  assert.match(html, /沉淀卡片/);
  assert.match(html, /设置/);
  assert.match(html, /学习记录/);
  // 2026-08-03 产品决定：新用户空白态（不展示虚拟演示数据）
  assert.match(html, /开始你的学习/);
  assert.match(html, /去上传资料/);
  assert.match(html, /先生成计划/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/);
});

test("dashboard SSR renders sidebar nav and task content", async () => {
  const response = await render();
  const html = await response.text();

  // Sidebar nav (always rendered in SSR)
  assert.match(html, /今日工作台/);
  assert.match(html, /AI学习助手/);
  assert.match(html, /知识中心/);
  assert.match(html, /沉淀卡片/);
  assert.match(html, /设置/);
  assert.match(html, /学习记录/); // heatmap section
  assert.match(html, /开始于 /);  // heatmap start date

  // Dashboard task panel (default view)
  assert.match(html, /今日任务/);
  // 2026-08-03 产品决定：新用户空白态（不展示虚拟演示数据）
  assert.match(html, /开始你的学习/);
  assert.match(html, /去上传资料/);
});

test("knowledge/agent/cards/settings page code exists in page.tsx", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  // Knowledge 视图已抽出为 KnowledgeView 组件（视图内容在其中；page.tsx 保留 handlers + 挂载）
  const knowledge = await readFile(new URL("../app/components/KnowledgeView.tsx", import.meta.url), "utf8");

  // Knowledge Center pages
  assert.match(page, /activeView === "knowledge"/);
  assert.match(page, /<KnowledgeView/);
  assert.match(knowledge, /学习资料/);
  assert.match(knowledge, /真题库/);
  assert.match(knowledge, /知识图谱/);
  assert.match(knowledge, /我的资料库/);
  assert.match(knowledge, /上传资源/);
  assert.match(knowledge, /← 返回/);
  assert.match(knowledge, /activeKnowledgePanel === "resources"/);
  assert.match(knowledge, /activeKnowledgePanel === "questions"/);
  assert.match(knowledge, /activeKnowledgePanel === "graph"/);
  assert.match(page, /openResource/);
  assert.match(page, /inferResource/);
  assert.match(page, /addResource/);
  assert.match(page, /analyzeMaterial/);
  assert.match(knowledge, /直接添加空白真题卷/);

  // Agent page
  assert.match(page, /activeView === "agent"/);
  // 业务 handlers 已抽到 use-workspace-handlers.ts（page.tsx 经 useWorkspaceHandlers 消费）
  const workspaceHandlers = await readFile(new URL("../app/use-workspace-handlers.ts", import.meta.url), "utf8");
  assert.match(workspaceHandlers, /runAgentWorkflow/);
  assert.match(workspaceHandlers, /runPrompt/);
  // 2026-08-06 globals.css 大规模迁移：quick-prompts 已移至 components.module.css :global() 声明
  const componentsCss = await readFile(new URL("../styles/components.module.css", import.meta.url), "utf8");
  assert.match(componentsCss, /:global\(\.quick-prompts\)/);

  // Cards（视图抽出为 CardsView；复习队列逻辑随之迁移）
  const cards = await readFile(new URL("../app/components/CardsView.tsx", import.meta.url), "utf8");
  assert.match(page, /activeView === "cards"/);
  assert.match(page, /subjectCards/);
  assert.match(page, /dueCards/);
  assert.match(cards, /categoryReviewQueue/);
  // UX Sprint 后快速创建改为弹窗（editingCardId / editingCard 控制）；quickCardFront 已废弃
  assert.match(page, /editingCardId/);
  assert.match(page, /createCardFromText/);
  assert.match(page, /reviewCard/);
  assert.match(page, /moveCard/);
  assert.match(page, /openCardSource/);
  assert.match(page, /showRelatedQuestions/);
  // Cards 视图已抽出为 CardsView 组件（page.tsx 通过它挂载；CardViewer 现位于 CardsView.tsx）
  assert.match(page, /<CardsView/);

  // Settings
  assert.match(page, /activeView === "settings"/);
  // Settings 视图抽出为 SettingsView（内部渲染 SettingsPanel）
  assert.match(page, /<SettingsView/);
  const settings = await readFile(new URL("../app/components/SettingsView.tsx", import.meta.url), "utf8");
  assert.match(settings, /<SettingsPanel/);

  // Dashboard heatmap + completion modal + timer
  assert.match(page, /heatmapGrid/);
  assert.match(page, /completionModalCustomMinutes/);
  assert.match(page, /startTask/);
  assert.match(page, /handleEndLearning/);
  assert.match(page, /completeTask/);
  assert.match(page, /questionFilter/);
  assert.match(page, /resourceView/);
});

test("historical annotation tag 核心概念 remains supported", async () => {
  const [types, reader] = await Promise.all([
    readFile(new URL("../app/lib/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ReaderPanel.tsx", import.meta.url), "utf8"),
  ]);

  // AnnotationTag union includes legacy value
  assert.match(types, /AnnotationTag[\s\S]*核心概念/);
  // ANNOTATION_COLORS has a full mapping (dot/bg/border/label) for it
  assert.match(types, /"核心概念"\s*:\s*\{\s*dot: [^}]*bg: [^}]*border: [^}]*label: /);
  // ReaderPanel initializes the group bucket and renders it
  assert.match(reader, /"核心概念": \[\]/);
  assert.match(reader, /\["重点", "易错", "疑问", "总结", "核心概念"\]/);
});

test("markdown requirements document is generated", async () => {
  const markdown = await readFile(new URL("../../筑巢考研工作台 MVP 产品需求文档.md", import.meta.url), "utf8");
  assert.match(markdown, /# .*考研工作台|筑巢考研工作台/);
  assert.match(markdown, /AI First，Manual Confirm/);
  assert.match(markdown, /用户负责提供资料/);
});

test("starter preview code has been removed from product entry files", async () => {
  const [page, layout, packageJson, css, componentsCss] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../styles/components.module.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(css, /\.hero-grid\s*\{[^}]*display:\s*grid/s);
  // 2026-08-06 globals.css 大规模迁移：布局类已移至 components.module.css :global() 声明
  assert.match(componentsCss, /:global\(\.hero-grid\.agent-only \.engine-panel\)\s*\{[^}]*display:\s*none/s);
  assert.doesNotMatch(page, /<span>资源名称<\/span>|<span>作者<\/span><input name="author"|<span>版本<\/span><input name="version"/);
});
