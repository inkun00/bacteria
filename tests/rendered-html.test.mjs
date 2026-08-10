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

test("ships the 10-stage curriculum campaign, boss mechanics, and cinematic assets", async () => {
  const [layout, page, story, styles, opening, ending, worldMap, idleGerm, infectionGerm] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/story.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    access(new URL("../public/assets/story/opening.png", import.meta.url)),
    access(new URL("../public/assets/story/ending.png", import.meta.url)),
    access(new URL("../public/assets/story/world-operation-map.png", import.meta.url)),
    access(new URL("../public/assets/bacteria-idle.png", import.meta.url)),
    access(new URL("../public/assets/bacteria-infection.png", import.meta.url)),
  ]);

  assert.match(layout, /Factor Force \| 약수와 배수 지구 방어대/);
  assert.match(page, /OPENING_CAPTIONS/);
  assert.match(page, /ENDING_CAPTIONS/);
  assert.match(styles, /WORLD INFECTION MAP/);
  assert.match(page, /남은 질병 세균/);
  assert.match(page, /factor-force-story-progress-v2/);
  assert.match(page, /LEGACY_STORY_SAVE_KEY/);
  assert.match(page, /applyBossPulse/);
  assert.match(page, /applyEmergencyTreatment/);
  assert.match(story, /export function applyEmergencyTreatment/);
  assert.match(story, /긴급 치료 파동/);
  assert.match(story, /보스 공격 공간/);
  const stageIds = [...story.matchAll(/^\s{4}id: (\d+),$/gm)].map((match) => Number(match[1]));
  assert.deepEqual(stageIds, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (let lesson = 2; lesson <= 10; lesson += 1) {
    assert.match(story, new RegExp(`id: ${lesson - 1},\\n    lesson: "${lesson}차시`));
  }
  assert.match(story, /id: 10/);
  assert.doesNotMatch(story, /1차시 · 단원 도입/);
  assert.doesNotMatch(story, /감염 경보: 서울/);
  assert.match(story, /원천균: 제로 프라임/);
  assert.match(story, /hp: 5/);
  assert.match(story, /sequence: \[12, 18, 24, 30, 36\]/);
  assert.match(story, /modes: \["divisor", "multiple", "split"\]/);
  assert.match(story, /2차시 · 약수 이해하기/);
  assert.match(story, /9차시 · 생활 속 최소공배수/);
  assert.match(styles, /\.world-map/);
  assert.match(styles, /world-operation-map\.png/);
  assert.match(styles, /\.cinematic/);
  assert.match(page, /petri-battle-screen/);
  assert.match(page, /infection-projectile-layer/);
  assert.match(page, /function nextAllowedMode/);
  assert.match(page, /selectedCell === index/);
  assert.match(page, /같은 세균을 다시 누르면/);
  assert.match(page, /petri-relation-toggle/);
  assert.match(page, /learning-short-answer/);
  assert.match(page, /단답형 정답/);
  assert.equal((story.match(/shortAnswer: true/g) ?? []).length, 24);
  assert.match(page, /bacteria-idle\.png/);
  assert.match(page, /bacteria-infection\.png/);
  assert.match(styles, /@keyframes spriteIdle/);
  assert.match(styles, /@keyframes infectionShot/);
  assert.equal(opening, undefined);
  assert.equal(ending, undefined);
  assert.equal(worldMap, undefined);
  assert.equal(idleGerm, undefined);
  assert.equal(infectionGerm, undefined);
});

test("ships the title mode selector and restored classic free battle", async () => {
  const [page, freeBattle, freeStyles, game] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/free-battle.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/free-battle.css", import.meta.url), "utf8"),
    readFile(new URL("../app/game.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /function TitleScreen/);
  assert.match(page, /FACTOR<br \/><em>FORCE/);
  assert.match(page, /스토리 모드/);
  assert.match(page, /자유 대전/);
  assert.match(page, /assets\/story\/opening\.png/);
  assert.match(page, /<FreeBattle onExit=/);
  assert.match(freeBattle, /petri-math-lab-game-v1/);
  assert.match(freeBattle, /컴퓨터와 하기/);
  assert.match(freeBattle, /친구와 하기/);
  assert.match(freeBattle, /BOARD_SIZES\.map/);
  assert.match(freeBattle, /세균탄/);
  assert.match(freeBattle, /되돌리기/);
  assert.match(freeBattle, /chooseAiAction/);
  assert.match(freeBattle, /nextMode\(relationMode\)/);
  assert.match(game, /export function applyMove/);
  assert.match(freeStyles, /\.free-battle \.setup-modal/);
  assert.match(freeStyles, /@keyframes infectionShot/);
});
