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
  assert.match(html, /치료 세균을 만드는 중/);
  assert.doesNotMatch(html, /react-loading-skeleton|codex-preview/i);
});

test("ships the 10-stage curriculum campaign, boss mechanics, and cinematic assets", async () => {
  const [layout, page, story, styles, opening, openingFirstScene, ending, worldMap, idleGerm, infectionGerm, storyDiseaseGerm, bossGermSprite, backgroundMusic, missionMusic, openingMusic, endingMusic, infectionSound, stageClearSound, stageFailedSound, bossClearSound, bossDefeatSound, audioCredits] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/story.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    access(new URL("../public/assets/story/opening.webp", import.meta.url)),
    access(new URL("../public/assets/story/opening-01.webp", import.meta.url)),
    access(new URL("../public/assets/story/ending.webp", import.meta.url)),
    access(new URL("../public/assets/story/world-operation-map.webp", import.meta.url)),
    access(new URL("../public/assets/bacteria-idle.webp", import.meta.url)),
    access(new URL("../public/assets/bacteria-infection.webp", import.meta.url)),
    access(new URL("../public/assets/story-disease-germ-idle.webp", import.meta.url)),
    access(new URL("../public/assets/boss-germ-sprite.webp", import.meta.url)),
    access(new URL("../public/assets/audio/space-battle.ogg", import.meta.url)),
    access(new URL("../public/assets/audio/mission-pulse.mp3", import.meta.url)),
    access(new URL("../public/assets/audio/opening-suspense.ogg", import.meta.url)),
    access(new URL("../public/assets/audio/ending-revelation.mp3", import.meta.url)),
    access(new URL("../public/assets/audio/infection-splat.wav", import.meta.url)),
    access(new URL("../public/assets/audio/stage-clear.mp3", import.meta.url)),
    access(new URL("../public/assets/audio/stage-failed.mp3", import.meta.url)),
    access(new URL("../public/assets/audio/boss-clear.wav", import.meta.url)),
    access(new URL("../public/assets/audio/boss-defeat.mp3", import.meta.url)),
    readFile(new URL("../public/assets/audio/CREDITS.md", import.meta.url), "utf8"),
  ]);
  const endingScenes = await Promise.all(Array.from({ length: 8 }, (_, index) =>
    access(new URL(`../public/assets/story/ending-${String(index + 1).padStart(2, "0")}.webp`, import.meta.url))));

  assert.match(layout, /Factor Force \| 약수와 배수 지구 방어대/);
  assert.match(page, /OPENING_CAPTIONS/);
  assert.match(page, /ENDING_CAPTIONS/);
  assert.match(styles, /WORLD INFECTION MAP/);
  assert.match(page, /남은 질병 세균/);
  assert.match(page, /factor-force-story-progress-v2/);
  assert.match(page, /LEGACY_STORY_SAVE_KEY/);
  assert.doesNotMatch(page, /applyBossPulse/);
  assert.match(page, /applyBossTurn/);
  assert.match(page, /applyEmergencyTreatment/);
  assert.match(page, /질병 세균이 남은 채 모든 칸이 점유되어 미션에 실패했습니다/);
  assert.match(story, /export function applyEmergencyTreatment/);
  assert.doesNotMatch(story, /export function applyBossPulse/);
  assert.match(story, /export function applyBossTurn/);
  assert.match(story, /export function getStoryBattleOutcome/);
  assert.match(story, /move\.from !== livingBossIndex/);
  assert.match(story, /bossTurn % 2 === 0/);
  assert.match(story, /move\.from === battle\.bossIndex && move\.distance === 1/);
  assert.match(story, /bossIndex: action\.move\.to/);
  assert.match(story, /보스가 질병 세균을 남기고 한 칸 복제 이동/);
  assert.match(story, /enemyMovement: "jump-only"/);
  assert.match(story, /id: 9,[\s\S]*?difficulty: 2,[\s\S]*?enemyMovement: "jump-only"/);
  assert.match(story, /긴급 치료 빛/);
  assert.match(story, /보스에게 다가갈 칸/);
  const stageIds = [...story.matchAll(/^\s{4}id: (\d+),$/gm)].map((match) => Number(match[1]));
  assert.deepEqual(stageIds, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (let lesson = 2; lesson <= 10; lesson += 1) {
    assert.match(story, new RegExp(`id: ${lesson - 1},\\n    lesson: "${lesson}차시`));
  }
  assert.match(story, /id: 10/);
  assert.doesNotMatch(story, /1차시 · 단원 도입/);
  assert.doesNotMatch(story, /감염 경보: 서울/);
  assert.match(story, /우두머리 세균: 제로 프라임/);
  assert.match(story, /hp: 5/);
  assert.match(story, /sequence: \[12, 18, 24, 30, 36\]/);
  assert.match(story, /id: 10,[\s\S]*?enemyNumbers: \[2, 3, 4, 6, 12, 18\],[\s\S]*?difficulty: 1,[\s\S]*?enemyMovement: "jump-only"/);
  assert.match(page, /battleStage\.boss \? "최종전"/);
  assert.match(story, /modes: \["divisor", "multiple", "split"\]/);
  assert.match(story, /2차시 · 약수 이해하기/);
  assert.match(story, /9차시 · 생활 속 최소공배수/);
  assert.match(styles, /\.world-map/);
  assert.match(styles, /world-operation-map\.webp/);
  assert.match(styles, /\.cinematic/);
  assert.match(page, /petri-battle-screen/);
  assert.match(page, /infection-projectile-layer/);
  assert.match(page, /function nextAllowedMode/);
  assert.match(page, /selectedCell === index/);
  assert.match(page, /같은 세균을 다시 누르면/);
  assert.match(page, /petri-relation-toggle/);
  assert.match(page, /learning-short-answer/);
  assert.match(page, /답 직접 쓰기/);
  assert.equal((story.match(/shortAnswer: true/g) ?? []).length, 24);
  assert.match(story, /귤 28개를 여러 봉지에 남김없이 똑같이 나누어 담는 방법/);
  assert.match(story, /가로 12cm, 세로 18cm인 직사각형 종이/);
  assert.match(story, /기계 ㉮는 18일마다, 기계 ㉯는 24일마다 점검/);
  assert.doesNotMatch(story, /같은 수를 두 번 쓰지 않고 완성한 이어달리기|이어달리기에서 4 다음에 20/);
  assert.equal((story.match(/^ {4}crisis: /gm) ?? []).length, 10);
  assert.match(page, /지역 위기 상황/);
  assert.doesNotMatch(page, /학습 내성|치료 코어|역감염|REGION CRISIS|MISSION OBJECTIVE/);
  assert.doesNotMatch(story, /합성수|원천균|변이|내성|치료 파동/);
  assert.match(page, /bacteria-idle\.webp/);
  assert.match(page, /bacteria-infection\.webp/);
  assert.match(page, /story-disease-germ-idle\.webp/);
  assert.match(styles, /@keyframes spriteIdle/);
  assert.match(styles, /@keyframes infectionShot/);
  assert.match(styles, /@keyframes storyDiseaseIdle/);
  assert.equal(opening, undefined);
  assert.equal(openingFirstScene, undefined);
  assert.equal(ending, undefined);
  assert.deepEqual(endingScenes, Array(8).fill(undefined));
  assert.equal(worldMap, undefined);
  assert.equal(idleGerm, undefined);
  assert.equal(infectionGerm, undefined);
  assert.equal(storyDiseaseGerm, undefined);
  assert.equal(bossGermSprite, undefined);
  assert.equal(backgroundMusic, undefined);
  assert.equal(missionMusic, undefined);
  assert.equal(openingMusic, undefined);
  assert.equal(endingMusic, undefined);
  assert.equal(infectionSound, undefined);
  assert.equal(stageClearSound, undefined);
  assert.equal(stageFailedSound, undefined);
  assert.equal(bossClearSound, undefined);
  assert.equal(bossDefeatSound, undefined);
  assert.match(audioCredits, /CC0 1\.0/);
  assert.match(page, /space-battle\.ogg/);
  assert.match(page, /mission-pulse\.mp3/);
  assert.match(page, /opening-suspense\.ogg/);
  assert.match(page, /ending-revelation\.mp3/);
  assert.match(page, /cinematic === "opening"[\s\S]*?MUSIC_TRACKS\.opening[\s\S]*?cinematic === "ending"[\s\S]*?MUSIC_TRACKS\.ending/);
  assert.match(page, /window\.localStorage\.removeItem\(STORY_SAVE_KEY\)/);
  assert.match(page, /window\.localStorage\.removeItem\(LEGACY_STORY_SAVE_KEY\)/);
  assert.match(page, /setCompleted\(\[\]\)[\s\S]*?setSelectedStageId\(1\)[\s\S]*?setView\("title"\)/);
  assert.match(page, /view === "battle" \|\| view === "free"/);
  assert.match(page, /MUSIC_TRACKS\.mission/);
  assert.match(page, /bgm\.currentTime = 0/);
  assert.match(page, /infection-splat\.wav/);
  assert.match(page, /infectionShot\?\.player !== 2/);
  assert.match(page, /stage-clear\.mp3/);
  assert.match(page, /stage-failed\.mp3/);
  assert.match(page, /boss-clear\.wav/);
  assert.match(page, /boss-defeat\.mp3/);
  assert.match(page, /cinematic === "ending" \? "bossClear" : result/);
  assert.match(page, /bossDefeatCell !== null \? "bossDefeat"/);
  assert.match(page, /bossDefeated \? 2200/);
  assert.match(page, /보스 세균의 핵이 붕괴합니다/);
  assert.match(styles, /\.boss-defeat-effect/);
  assert.match(styles, /@keyframes bossDeathCollapse/);
  assert.match(styles, /@keyframes bossDeathParticle/);
  assert.equal((page.match(/"ending-\d{2}\.webp"/g) ?? []).length, 8);
  const endingCaptionBlock = page.match(/const ENDING_CAPTIONS = \[([\s\S]*?)\];/)?.[1] ?? "";
  assert.equal((endingCaptionBlock.match(/^ {2}".*",$/gm) ?? []).length, 8);
  assert.match(page, /boss \? "boss-germ-sprite\.webp"/);
  assert.match(styles, /@keyframes bossGermSprite/);
  assert.match(styles, /\.germ-sprite\.boss \{[\s\S]*?width: 93%;[\s\S]*?background-size: 700% auto;[\s\S]*?animation: bossGermSprite 1\.05s steps\(6\)/);
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
  assert.match(page, /assets\/story\/opening\.webp/);
  assert.match(page, /mobile-mode-nav/);
  assert.match(page, /window\.scrollTo\(0, 0\)/);
  assert.match(page, /sound\.preload = "none"/);
  assert.match(page, /bacteria-idle\.webp/);
  assert.match(page, /<FreeBattle onExit=/);
  assert.match(freeBattle, /petri-math-lab-game-v1/);
  assert.match(freeBattle, /컴퓨터와 하기/);
  assert.match(freeBattle, /친구와 하기/);
  assert.match(freeBattle, /BOARD_SIZES\.map/);
  assert.match(freeBattle, /세균탄/);
  assert.match(freeBattle, /되돌리기/);
  assert.match(freeBattle, /chooseAiAction/);
  assert.match(freeBattle, /nextMode\(relationMode\)/);
  assert.match(freeBattle, /animationWatchdog/);
  assert.match(freeBattle, /context\.resume\(\)\.catch/);
  assert.match(freeBattle, /if \(!action\) \{\s*setThinking\(false\);\s*resolveEnd\(board, 2, 1\);/);
  assert.match(game, /export function applyMove/);
  assert.match(freeStyles, /\.free-battle \.setup-modal/);
  assert.match(freeStyles, /@keyframes infectionShot/);
  assert.match(freeStyles, /max-height: 760px/);
});
