import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { build } from "esbuild";

let hallModulePromise;

function loadHallModule() {
  hallModulePromise ??= build({
    entryPoints: [resolve("app/hall-of-fame.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  }).then(({ outputFiles }) => import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString("base64")}`));
  return hallModulePromise;
}

test("legacy partial attempt counters are normalized to one attempt per story stage", async () => {
  const { MIN_STORY_ATTEMPTS, getHallTier, normalizeHallAttempts } = await loadHallModule();

  assert.equal(MIN_STORY_ATTEMPTS, 10);
  assert.equal(normalizeHallAttempts(6), 10);
  assert.equal(normalizeHallAttempts(10), 10);
  assert.equal(normalizeHallAttempts(13), 13);
  assert.equal(getHallTier(normalizeHallAttempts(6)).level, 1);
});
