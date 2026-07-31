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

## Verified stable baselines (git commits)

- `3c91c6c` — Snapshot before fixing component extraction regression
- `0674903` — Phase 1: Restore Dashboard completely
- `b28e0b4` — Phase 1c: Complete Dashboard interaction loop
- `fb680b8` — Phase 2: Restore Agent page and runtime

When in doubt, `git reset --hard <baseline>` to roll back.