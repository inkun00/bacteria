import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Korean Factor Force shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /Factor Force \| 약수와 배수 지구 방어대/);
  assert.match(html, /치료 세균을 배양하는 중/);
  assert.doesNotMatch(html, /react-loading-skeleton|codex-preview/i);
});

test("ships the 11-stage story campaign, boss mechanics, and cinematic assets", async () => {
  const [layout, page, story, styles, opening, ending] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/story.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    access(new URL("../public/assets/story/opening.png", import.meta.url)),
    access(new URL("../public/assets/story/ending.png", import.meta.url)),
  ]);

  assert.match(layout, /Factor Force \| 약수와 배수 지구 방어대/);
  assert.match(page, /OPENING_CAPTIONS/);
  assert.match(page, /ENDING_CAPTIONS/);
  assert.match(styles, /WORLD INFECTION MAP/);
  assert.match(page, /질병 세균 전멸/);
  assert.match(page, /factor-force-story-progress-v1/);
  assert.match(page, /applyBossPulse/);
  assert.match(story, /id: 11/);
  assert.match(story, /원천균: 제로 프라임/);
  assert.match(story, /hp: 5/);
  assert.match(story, /sequence: \[12, 18, 24, 30, 36\]/);
  assert.match(story, /modes: \["divisor", "multiple", "split"\]/);
  assert.match(story, /2차시 · 약수 이해하기/);
  assert.match(story, /9차시 · 생활 속 최소공배수/);
  assert.match(styles, /\.world-map/);
  assert.match(styles, /\.cinematic/);
  assert.equal(opening, undefined);
  assert.equal(ending, undefined);
});
