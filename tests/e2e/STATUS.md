# Playwright E2E Test Status

> 状态：INFRASTRUCTURE + DRAFT（未验证通过）

## 当前状态
- 基础设施与草稿测试已提交，但 **未声明 E2E 通过**
- 3 条草稿测试：Dashboard 学习闭环 / Knowledge 上传->Reader / Cards 创建->评分
- **Chromium revision 1234 因网络问题未安装**（本机仅有 1228），3 条测试尚未实际执行验证
- 首跑预期需按真实 DOM 修正选择器（getByRole/getByLabel 优先）

## 运行要求
1. 网络可用时执行 `npm install -D @playwright/test`（已在 package.json）
2. 下载浏览器：`npx playwright install chromium`（需 revision 1234）
3. 运行：`npm run test:e2e`
4. 全部通过后再更新本文件状态为 PASS

## 已知未验证项
- Completion Modal 可访问名称
- 上传流程等待最终 UI（非休眠）
- Cards 按钮文本唯一性
