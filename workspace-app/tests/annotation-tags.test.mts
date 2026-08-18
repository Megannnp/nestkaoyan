/**
 * ReaderPanel 批注标签修复测试
 * 覆盖：ANNOTATION_COLORS 映射完整性 / 异常标签降级 / 历史标签合法性
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANNOTATION_TAGS, ANNOTATION_COLORS,
  isAnnotationTag, resolveAnnotationColor,
  UNKNOWN_ANNOTATION_TAG, UNKNOWN_ANNOTATION_COLOR,
} from "../app/lib/types.ts";

test("映射完整性：ANNOTATION_COLORS 覆盖 ANNOTATION_TAGS 全部成员", () => {
  for (const tag of ANNOTATION_TAGS) {
    const c = ANNOTATION_COLORS[tag];
    assert.ok(c, `缺少映射: ${tag}`);
    assert.ok(c.dot && c.bg && c.border && c.label, `字段不全: ${tag}`);
  }
});

test("合法标签：isAnnotationTag 全部返回 true", () => {
  assert.ok(ANNOTATION_TAGS.every((t) => isAnnotationTag(t)));
});

test("非法标签：isAnnotationTag 返回 false（空串/未知/大小写变体/非字符串）", () => {
  assert.equal(isAnnotationTag(""), false);
  assert.equal(isAnnotationTag("Important"), false);
  assert.equal(isAnnotationTag("重点 "), false); // 尾部空格
  assert.equal(isAnnotationTag("unknown_tag"), false);
  assert.equal(isAnnotationTag(undefined), false);
  assert.equal(isAnnotationTag(null), false);
  assert.equal(isAnnotationTag(123), false);
});

test("降级：非法标签 resolveAnnotationColor → UNKNOWN_ANNOTATION_COLOR（绝不 undefined）", () => {
  const c = resolveAnnotationColor("bad_tag");
  assert.equal(c.border, UNKNOWN_ANNOTATION_COLOR.border);
  assert.equal(c.dot, UNKNOWN_ANNOTATION_COLOR.dot);
  assert.equal(c.bg, UNKNOWN_ANNOTATION_COLOR.bg);
});

test("合法标签 resolveAnnotationColor → ANNOTATION_COLORS 原值", () => {
  const c = resolveAnnotationColor("重点");
  assert.equal(c, ANNOTATION_COLORS["重点"]);
});

test("unknown 常量存在且与降级无关（隔离渲染锚点）", () => {
  assert.equal(typeof UNKNOWN_ANNOTATION_TAG, "string");
  assert.ok(UNKNOWN_ANNOTATION_TAG.length > 0);
  assert.equal(UNKNOWN_ANNOTATION_COLOR.border, "#DC2626");
});