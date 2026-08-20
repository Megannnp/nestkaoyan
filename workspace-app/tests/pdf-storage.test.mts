import { test } from "node:test";
import assert from "node:assert/strict";
import { fileStorageKeysForServerGc } from "../app/lib/pdf-storage.ts";

test("fileStorageKeysForServerGc：保留主文件和解析文本 sidecar", () => {
  assert.deepEqual(
    fileStorageKeysForServerGc([{ fileStorageKey: "pdf-1" }, {}, { fileStorageKey: "pdf-2" }]),
    ["pdf-1", "pdf-1:text", "pdf-2", "pdf-2:text"],
  );
});
