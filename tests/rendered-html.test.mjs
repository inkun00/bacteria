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

test("server-renders the PETRI game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /PETRI \/\/ 07/);
  assert.match(html, /세균전/);
  assert.match(html, /컴퓨터 대전/);
  assert.match(html, /사용자 대전/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships final metadata and generated sprite assets", async () => {
  const [layout, page, styles, idle, infection] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    access(new URL("../public/assets/bacteria-idle.png", import.meta.url)),
    access(new URL("../public/assets/bacteria-infection.png", import.meta.url)),
  ]);
  assert.match(layout, /PETRI \/\/ 07 — 세균전/);
  assert.match(page, /chooseAiMove/);
  assert.match(styles, /bacteria-idle\.png/);
  assert.match(styles, /bacteria-infection\.png/);
  assert.equal(idle, undefined);
  assert.equal(infection, undefined);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../app/_sites-preview/preview.css", import.meta.url)));
  await assert.rejects(access(new URL("../public/_sites-preview", root)));
});
