import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { build } from "esbuild";

let worksheetModulePromise;
let storyModulePromise;
let hallModulePromise;

function loadWorksheetModule() {
  worksheetModulePromise ??= build({
    entryPoints: [resolve("app/worksheet-generator.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  }).then(({ outputFiles }) =>
    import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString("base64")}`),
  );
  return worksheetModulePromise;
}

function loadStoryModule() {
  storyModulePromise ??= build({
    entryPoints: [resolve("app/story.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  }).then(({ outputFiles }) =>
    import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString("base64")}`),
  );
  return storyModulePromise;
}

function loadHallModule() {
  hallModulePromise ??= build({
    entryPoints: [resolve("app/hall-of-fame.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  }).then(({ outputFiles }) =>
    import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString("base64")}`),
  );
  return hallModulePromise;
}

test("gcd and lcm math helpers return accurate results", async () => {
  const { gcd, lcm, getDivisors, getCommonDivisors } = await loadWorksheetModule();

  assert.equal(gcd(24, 36), 12);
  assert.equal(gcd(84, 126), 42);
  assert.equal(gcd(17, 19), 1);
  assert.equal(lcm(12, 18), 36);
  assert.equal(lcm(15, 20), 60);
  assert.equal(lcm(8, 12), 24);
  assert.deepEqual(getDivisors(12), [1, 2, 3, 4, 6, 12]);
  assert.deepEqual(getDivisors(7), [1, 7]);
  assert.deepEqual(getCommonDivisors(18, 30), [1, 2, 3, 6]);
});

test("generates valid similar tasks for all story learning questions", async () => {
  const { generateSimilarTask } = await loadWorksheetModule();
  const { STAGE_LEARNING_TASKS, STORY_STAGES } = await loadStoryModule();

  for (const stage of STORY_STAGES) {
    const tasks = STAGE_LEARNING_TASKS[stage.id] ?? [];
    assert.ok(tasks.length > 0, `Stage ${stage.id} should have learning tasks`);

    for (const task of tasks) {
      const similar = generateSimilarTask(task);
      assert.ok(similar.prompt && similar.prompt.length > 3, `Task ${task.id} similar prompt should be descriptive`);
      assert.ok(similar.answer && similar.answer.length > 0, `Task ${task.id} similar answer should be present`);
      assert.ok(similar.explanation && similar.explanation.length > 0, `Task ${task.id} explanation should be present`);
    }
  }
});

test("buildWorksheetReport generates 12 questions for zero-incorrect perfect scores", async () => {
  const { buildWorksheetReport } = await loadWorksheetModule();
  const { getHallTier } = await loadHallModule();

  const tier = getHallTier(10);
  const report = buildWorksheetReport({
    studentName: "홍길동",
    tier,
    attempts: 10,
    rankText: "제 1위",
    incorrectRecords: [],
  });

  assert.equal(report.studentName, "홍길동");
  assert.equal(report.isPerfectScore, true);
  assert.equal(report.totalIncorrectCount, 0);
  assert.equal(report.attempts, 10);
  assert.equal(report.rankText, "제 1위");
  assert.equal(report.tier.level, 1);
  assert.equal(report.tier.title, "지구 구원의 전설");
  assert.ok(report.certificateNumber.startsWith("FF-"));
  assert.equal(report.problems.length, 12);
});

test("buildWorksheetReport deduplicates incorrect questions and supplements up to 12 total", async () => {
  const { buildWorksheetReport } = await loadWorksheetModule();
  const { STAGE_LEARNING_TASKS } = await loadStoryModule();
  const { getHallTier } = await loadHallModule();

  const tier = getHallTier(15);
  const task1 = STAGE_LEARNING_TASKS[1][0];
  const task2 = STAGE_LEARNING_TASKS[3][0];

  const incorrectRecords = [
    { stageId: 1, taskId: task1.id, task: task1, wrongAnswers: ["3"], timestamp: 1000 },
    { stageId: 1, taskId: task1.id, task: task1, wrongAnswers: ["5"], timestamp: 2000 }, // duplicate
    { stageId: 3, taskId: task2.id, task: task2, wrongAnswers: ["7"], timestamp: 3000 },
  ];

  const report = buildWorksheetReport({
    studentName: "김수학",
    tier,
    attempts: 15,
    rankText: "제 4위",
    incorrectRecords,
  });

  assert.equal(report.studentName, "김수학");
  assert.equal(report.isPerfectScore, false);
  assert.equal(report.totalIncorrectCount, 2);
  assert.equal(report.problems.length, 12);
  assert.equal(report.problems[0].originalTask.id, task1.id);
  assert.equal(report.problems[1].originalTask.id, task2.id);
  assert.ok(report.problems[0].similarTask.prompt.length > 0);
  assert.ok(report.problems[0].similarTask.answer.length > 0);
});

test("PDF libraries load with the page instead of a deployment-sensitive dynamic chunk", async () => {
  const source = await readFile(new URL("../app/pdf-report.tsx", import.meta.url), "utf8");
  assert.match(source, /import html2canvas from "html2canvas"/);
  assert.match(source, /import jsPDF from "jspdf"/);
  assert.doesNotMatch(source, /import\("(?:jspdf|html2canvas)"\)/);
});
