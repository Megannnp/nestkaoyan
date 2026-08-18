# Agent Guidelines — 筑巢考研工作台

This project uses AI-assisted development. Any AI agent (Cline, Claude Code, Codex, etc.) modifying this repository must comply with the hard rules below.

## Before any code change

Read `/Users/jiqiguanjia/Development/KaoyanPlatform/docs/AI_DEVELOPMENT_RULES.md` — the authoritative rule set.

## Refactor tasks (hard rules)

1. **Component Refactor, not Feature Rewrite.** Refactoring must be behavior-equivalent.
2. **Dependency audit BEFORE editing.** List state / derived values / handlers / effects / JSX referenced by the target page. Do not skip this.
3. **Never remove existing functionality.** Do not delete JSX, state, handlers, effects, or routes unless explicitly authorized by the user.
4. **Never use placeholders or no-op handlers** (`= () => {}`) to make things compile.
5. **Never hide missing dependencies with default values** (`|| 0`, `?? []`, `|| ""`).
6. **One page or one component per task.** No large multi-page rewrites in a single step.
7. **Do not redesign** or "improve" existing logic during a refactor.
8. **Cross-page dependencies are NOT silently replaced.** If a feature depends on another page/domain not yet restored, return a clear dependency explanation in chat, never fake execution.
9. **After changes: output a functionality comparison table** (old vs new) and verify every module listed.
10. **Build/Test passing ≠ completion.** Verify the browser interaction loop for each page.
11. **Commit each stable phase separately** with descriptive messages.
12. **Stop after the requested phase and wait for user approval.** Do not auto-continue into the next phase.

## 持久化数据契约兼容性（历史数据保护）

**修改持久化数据类型或 lookup map 前，必须审计：**

1. 旧版本曾写入过哪些值（查 git 历史/旧代码中的默认值、form 默认值、seed 数据）。
2. localStorage / 已保存数据中是否可能存在这些历史值。
3. lookup map（如 `ANNOTATION_COLORS`、`Record` 映射）是否覆盖所有历史合法值。
4. 若需要"清理/收窄"联合类型，先确认没有历史数据会触发 `undefined`，否则需数据迁移或保留旧值。

**禁止**用 `?? default` / `color?.border` 掩盖历史数据契约断裂；应修复类型域与 lookup，使其覆盖历史合法值。

**回归测试要求**：为历史标签添加断言（如 `ANNOTATION_COLORS["核心概念"]` 存在且字段完整），防止未来"类型清理"误删历史兼容项。

---

## Verified stable baselines (git commits)

- `3c91c6c` — Snapshot before fixing component extraction regression
- `0674903` — Phase 1: Restore Dashboard completely
- `b28e0b4` — Phase 1c: Complete Dashboard interaction loop
- `fb680b8` — Phase 2: Restore Agent page and runtime

When in doubt, `git reset --hard <baseline>` to roll back.