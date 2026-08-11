import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { build } from "esbuild";

let storyModulePromise;

function loadStoryModule() {
  storyModulePromise ??= build({
    entryPoints: [resolve("app/story.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  }).then(({ outputFiles }) => import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString("base64")}`));
  return storyModulePromise;
}

function focusedBossBattle(hp = 5) {
  const board = Array(49).fill(0);
  const numbers = Array(49).fill(null);
  board[16] = 1;
  numbers[16] = 12;
  board[24] = 2;
  numbers[24] = 12;
  return { board, numbers, bossIndex: 24, bossHp: hp, bossMaxHp: 5, bossPhase: 0, bossTurn: 0 };
}

test("boss number advances exactly once between playable turns", async () => {
  const { STORY_STAGES, applyBossTurn, applyStoryMove } = await loadStoryModule();
  const stage = STORY_STAGES.at(-1);
  const hit = applyStoryMove(focusedBossBattle(), stage, 1, { from: 16, to: 17, distance: 1 }, "divisor");

  assert.equal(hit.bossHit, true);
  assert.equal(hit.bossHp, 4);
  assert.equal(hit.bossPhase, 0);
  assert.equal(hit.numbers[24], 12);

  const bossTurn = applyBossTurn(hit, stage);
  assert.equal(bossTurn.bossPhase, 1);
  assert.equal(bossTurn.numbers[bossTurn.bossIndex], 18);
});

test("a reinfected former boss cell is treated as a normal disease cell", async () => {
  const { STORY_STAGES, applyStoryMove } = await loadStoryModule();
  const stage = STORY_STAGES.at(-1);
  const defeated = applyStoryMove(focusedBossBattle(1), stage, 1, { from: 16, to: 17, distance: 1 }, "divisor");
  assert.equal(defeated.bossHp, 0);

  defeated.board[24] = 2;
  defeated.numbers[24] = 12;
  const treatedAgain = applyStoryMove(defeated, stage, 1, { from: 16, to: 18, distance: 2 }, "divisor");

  assert.equal(treatedAgain.bossHit, false);
  assert.equal(treatedAgain.bossHp, 0);
  assert.equal(treatedAgain.board[24], 1);
  assert.ok(treatedAgain.infected.includes(24));
});

test("regular disease AI rests on living boss clone turns only", async () => {
  const { STORY_STAGES, chooseStoryAiMove, createStoryBattle } = await loadStoryModule();
  const stage = STORY_STAGES.at(-1);
  const battle = createStoryBattle(stage);

  assert.equal(chooseStoryAiMove({ ...battle, bossTurn: 2 }, stage), null);
  assert.notEqual(chooseStoryAiMove({ ...battle, bossTurn: 2, bossHp: 0 }, stage), null);
});
