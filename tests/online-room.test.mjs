import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("online 2v2 uses Firebase signaling and STUN-only WebRTC", async () => {
  const source = await readFile(new URL("../app/online-room.ts", import.meta.url), "utf8");
  const firebaseClient = await readFile(new URL("../app/firebase-client.ts", import.meta.url), "utf8");
  assert.match(source, /stun:stun\.l\.google\.com:19302/);
  assert.doesNotMatch(source, /turns?:/i);
  assert.match(source, /createDataChannel\("factor-force"/);
  assert.match(source, /rooms\/\$\{code\}\/signals/);
  assert.match(source, /OnlineMatchSize = 2 \| 4/);
  assert.match(source, /matchSize: requestedMatchSize/);
  assert.match(source, /initialRoom = \(await get\(roomReference\)\)\.val\(\)/);
  assert.match(source, /slotOwners\/slot\$\{candidate\}/);
  assert.match(source, /current === null \? uid : undefined/);
  assert.match(firebaseClient, /setPersistence\(auth, browserSessionPersistence\)/);
  assert.match(source, /orderByChild\("status"\)/);
  assert.match(source, /equalTo\("waiting"\)/);
  assert.match(source, /limitToLast\(40\)/);
  assert.match(source, /refreshRooms/);
});

test("ranked accounts persist Elo MMR and expose a top-50 leaderboard", async () => {
  const accountSource = await readFile(new URL("../app/ranked-account.ts", import.meta.url), "utf8");
  const battleSource = await readFile(new URL("../app/free-battle.tsx", import.meta.url), "utf8");
  const rules = await readFile(new URL("../firebase/database.rules.json", import.meta.url), "utf8");
  assert.match(accountSource, /createUserWithEmailAndPassword/);
  assert.match(accountSource, /signInWithEmailAndPassword/);
  assert.match(accountSource, /processedMatches/);
  assert.match(accountSource, /Math\.round\(32 \* \(actual - expected\)\)/);
  assert.match(accountSource, /limitToLast\(50\)/);
  assert.match(battleSource, /온라인 랭킹 TOP 50/);
  assert.match(battleSource, /matchId: crypto\.randomUUID\(\)/);
  assert.match(rules, /"rankedUsers"/);
  assert.match(rules, /"rankings"/);
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
  assert.match(source, /참가 가능한 게임방/);
  assert.match(source, /새로고침/);
  assert.match(source, /online\.availableRooms\.map/);
});
