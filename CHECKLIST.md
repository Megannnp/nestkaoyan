# 部署前检查清单（CHECKLIST.md）

> 每次发布 / 交接 / 上线前，逐项打勾。
> 所有「✅」都应通过方可视为可交付。

## A. 代码健康

- [x] `npm install` 无报错
- [x] `npm run build` 成功，产出 `dist/`
- [x] `npm run lint` 0 错误
- [x] `npm test` 通过（构建 + 渲染冒烟，6/6）
- [x] `npm run test:unit` 通过（reducer / replay / plan-generate 等，78/78）
- [x] 关键功能自动化验证：E2E 62/62 PASS（今日工作台 / AI 助手 / 知识中心 / 成长卡片 / 设置 / 复盘 / 真题库 / Reader 阅读 / 上传）

## B. 密钥与环境（绝不入 Git）

- [x] 代码中**无**硬编码密钥（`grep -rn "sk-" app worker --include="*.ts"` 应为空）
- [x] `.dev.vars` 存在且 `.gitignore` 已排除（本地开发）
- [x] `.env.example` 已提供全部变量名（无值）
- [ ] 生产密钥通过 `wrangler secret put DEEPSEEK_API_KEY` 配置，而非写在代码（部署时执行）

## C. 数据

- [x] 确认当前存储策略：localStorage（默认单机；D1 多端同步为可选，绑定未启用）
- [ ] 数据导出验证：设置 → 数据管理 → 导出 JSON，能成功下载（代码已实现，待人工点验）
- [ ] 数据导入验证：导出的 JSON 能重新导入（备份恢复可用）（代码已实现，待人工点验）
- [ ]（启用 D1 时）`npm run db:generate` 成功、迁移已应用（当前未启用 D1）

## D. 线上部署（Cloudflare Workers）

- [ ] `npx wrangler login` 已认证（需用户执行）
- [x] `npm run build && npx wrangler deploy` 前置验证：`wrangler deploy --dry-run` 成功（vinext 自动生成 `dist/server/wrangler.json`）
- [ ] 线上访问 https://你的域名 正常加载（部署后验证）
- [ ] AI 功能线上可用（真题分析 / 计划生成 / 对话至少各测一次）（部署后验证）
- [ ] 自定义域名已配置 HTTPS（非 workers.dev 也可接受）

## E. 交付包完整性（给别人接手）

- [x] `README.md`：产品说明 + 快速开始 + 架构约束
- [x] `DEPLOY.md`：部署步骤齐全
- [x] `CHECKLIST.md`：本清单
- [x] `.env.example`：环境变量模板
- [x] `db/ + drizzle/`：schema 与迁移存在（D1 可选）
- [ ] `git log` 有完整提交历史，无密钥泄露记录（`git log --all --oneline | grep -i key` 复查）

## F. 断线风险确认

- [ ] 确认线上版本已部署到 Cloudflare Workers（不是只跑 `npm run dev`）
- [ ] 本地开发期已避免同时跑 build / 多个 dev server / 多次 E2E 抢 3000 端口
- [ ] 知道「电脑关机 ≠ 网站下线」——线下线才需要重新 `wrangler deploy`

---

## 通过标准

- **A/B/C** 全部 ✅ → 本地可交付
- **A/B/C/D** 全部 ✅ → 线上可交付（永线在线）
- **A/B/C/E/F** 全部 ✅ → 产品包可交接（别人可接手、可恢复、可复制）