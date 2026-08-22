import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("online 2v2 uses Firebase signaling and STUN-only WebRTC", async () => {
  const source = await readFile(new URL("../app/online-room.ts", import.meta.url), "utf8");
  assert.match(source, /stun:stun\.l\.google\.com:19302/);
  assert.doesNotMatch(source, /turns?:/i);
  assert.match(source, /createDataChannel\("factor-force"/);
  assert.match(source, /rooms\/\$\{code\}\/signals/);
  assert.match(source, /OnlineMatchSize = 2 \| 4/);
  assert.match(source, /matchSize: requestedMatchSize/);
});

test("free battle exposes room creation, joining, and four connected slots", async () => {
  const source = await readFile(new URL("../app/free-battle.tsx", import.meta.url), "utf8");
  assert.match(source, /온라인 대전/);
  assert.match(source, /1 : 1/);
  assert.match(source, /2 : 2/);
  assert.match(source, /새 방 만들기/);
  assert.match(source, /방 코드 6자리/);
  assert.match(source, /Array\.from\(\{ length: online\.matchSize \}/);
  assert.match(source, /TURN 없이 직접 연결만 사용합니다/);
});
