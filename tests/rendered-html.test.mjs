import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

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

test("server-renders the Korean game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /수학 세균전/);
  assert.doesNotMatch(html, /새 배양 절차|페트리 \/\/ 수학 연구소/);
  assert.match(html, /세균전/);
  assert.match(html, /컴퓨터와 하기/);
  assert.match(html, /친구와 하기/);
  assert.doesNotMatch(html, /코덱스|코텍스|codex|cortex|생물 격리|게임판 상태|안전|react-loading-skeleton/i);
});

test("ships final metadata, game rules, and generated sprite assets", async () => {
  const [layout, page, game, styles, idle, infection] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    access(new URL("../public/assets/bacteria-idle.png", import.meta.url)),
    access(new URL("../public/assets/bacteria-infection.png", import.meta.url)),
  ]);
  assert.match(layout, /페트리 수학 연구소 — 약수와 배수 세균전/);
  assert.match(page, /chooseAiAction/);
  assert.match(page, /약수 모드/);
  assert.match(page, /배수 모드/);
  assert.match(page, /분열 모드/);
  assert.match(page, /87 = 3 × 29/);
  assert.match(page, /세균탄/);
  assert.match(page, /bombCharge/);
  assert.match(page, /5턴마다 세균탄 \+1/);
  assert.match(page, /petri-math-lab-game-v1/);
  assert.match(page, /navigation\?\.type === "reload"/);
  assert.match(page, /event\.key !== "Escape"/);
  assert.match(page, /게임을 다시 시작할까요/);
  assert.match(page, /게임판 크기/);
  assert.match(page, /7×7, 9×9, 11×11/);
  assert.match(page, /구구단 숫자가 나올 확률/);
  assert.match(page, /90% 확률/);
  assert.match(game, /forceInfection/);
  assert.match(game, /getBoardSize/);
  assert.match(game, /TIMES_TABLE_GENERATION_RATE = \.9/);
  assert.match(game, /factorPairs/);
  assert.match(game, /randomSplitNumbers/);
  assert.match(game, /mode === "split" \? "multiple" : mode/);
  assert.match(page, /새 세균의 숫자를 기준으로 주변에 배수가 있으면/);
  assert.match(page, /bacteria-idle\.png/);
  assert.match(page, /bacteria-infection\.png/);
  assert.match(styles, /board-size-9 \.board-stage \{ width: 740px/);
  assert.match(styles, /board-size-11 \.board-stage \{ width: 890px/);
  assert.doesNotMatch(styles, /data-size="(?:9|11)"\] \.germ-number/);
  assert.equal(idle, undefined);
  assert.equal(infection, undefined);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../app/_sites-preview/preview.css", import.meta.url)));
  await assert.rejects(access(new URL("../public/_sites-preview", root)));
});
