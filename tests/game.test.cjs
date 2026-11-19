const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { io } = require("socket.io-client");
const { createGameServer } = require("../server.js");
const { networkChoices } = require("../scripts/launch.cjs");
const choices = networkChoices({
  Ethernet: [{ family: "IPv4", internal: false, address: "192.168.0.36" }],
  "Local Area Connection* 12": [
    { family: "IPv4", internal: false, address: "192.168.137.1" },
  ],
  Loopback: [{ family: "IPv4", internal: true, address: "127.0.0.1" }],
});
assert.equal(choices.length, 2);
assert.equal(choices[0].ip, "192.168.137.1");
const dir = fs.mkdtempSync(
  path.join(require("node:os").tmpdir(), "lan-trivia-test-"),
);
const questions = [
  {
    question: "Two plus two?",
    options: ["1", "2", "3", "4"],
    answer: 3,
    time: 3,
  },
  {
    question: "Water formula?",
    options: ["H2O", "CO2", "O2", "NaCl"],
    answer: 0,
    time: 2,
  },
];
let running,
  clients = [];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function start() {
  running = createGameServer({ port: 0, dataDir: dir, questions });
  await running.ready;
}
async function connect() {
  const s = io(`http://localhost:${running.server.address().port}`, {
    autoConnect: false,
  });
  clients.push(s);
  s.on("state", (v) => (s.state = v));
  await new Promise((r, j) => {
    s.once("connect", r);
    s.once("connect_error", j);
    s.connect();
  });
  return s;
}
const emit = (s, event, data = null) =>
  new Promise((r, j) =>
    s
      .timeout(4000)
      .emit(event, data, (err, value) => (err ? j(err) : r(value))),
  );
async function waitFor(fn) {
  for (let i = 0; i < 120; i++) {
    if (fn()) return;
    await delay(50);
  }
  throw new Error("Timed out waiting for state");
}
async function shutdown() {
  for (const s of clients) s.disconnect();
  clients = [];
  await running.close();
}
async function host() {
  const s = await connect();
  assert((await emit(s, "host:auth", running.hostKey)).ok);
  return s;
}
function answer(s, choice) {
  return emit(s, "answer", {
    choice,
    roundId: s.state.roundId,
    gameId: s.state.gameId,
  });
}
(async () => {
  try {
    await start();
    let h = await host(),
      a = await connect(),
      b = await connect(),
      rogue = await connect();
    const key = running.hostKey;
    assert((await emit(rogue, "host:setup")).error);
    assert((await emit(rogue, "host:next")).error);
    assert((await emit(rogue, "host:reset")).error);
    assert(
      (
        await emit(h, "host:saveSetup", {
          title: "Saved Campus Quiz",
          allowLateJoin: false,
          questions,
        })
      ).ok,
    );
    assert(
      (
        await emit(h, "host:saveSetup", {
          title: "Bad",
          allowLateJoin: true,
          questions: [{ ...questions[0], answer: 4 }],
        })
      ).error,
    );
    const joined = await emit(a, "join", { name: "Alpha" });
    assert(joined.ok && joined.recoveryCode.length === 12);
    assert((await emit(b, "join", { name: "alpha" })).error);
    assert((await emit(b, "join", { name: "Beta" })).ok);
    assert(!JSON.stringify(rogue.state).includes(joined.recoveryCode));
    assert(!JSON.stringify(rogue.state).includes(joined.token));
    assert((await emit(h, "host:next")).ok);
    await waitFor(() => a.state.phase === "question");
    assert.equal(a.state.answer, null);
    assert(!("answer" in a.state.question));
    assert.deepEqual(a.state.me.history, []);
    assert((await emit(rogue, "join", { name: "Late" })).error);
    assert(
      (
        await emit(h, "host:saveSetup", {
          title: "Bad",
          allowLateJoin: true,
          questions,
        })
      ).error,
    );
    assert((await answer(a, 3)).ok);
    assert((await answer(a, 3)).error);
    assert.equal(a.state.me.score, 0);
    assert.equal(a.state.me.earned, null);
    const disk = JSON.parse(fs.readFileSync(path.join(dir, "game-state.json")));
    assert.equal(disk.players.find((p) => p.name === "Alpha").choice, 3);
    assert((await emit(h, "host:pause")).ok);
    await waitFor(() => a.state.phase === "paused");
    const paused = a.state.remaining;
    assert((await answer(b, 0)).error);
    await delay(1100);
    assert.equal(a.state.remaining, paused);
    a.disconnect();
    const a2 = await connect();
    assert(
      (
        await emit(a2, "join", {
          recoveryCode: joined.recoveryCode
            .toLowerCase()
            .match(/.{1,4}/g)
            .join("-"),
        })
      ).ok,
    );
    await waitFor(() => a2.state.me?.choice === 3);
    assert.equal(a2.state.me.id, a.state.me.id);
    assert((await emit(a2, "join", { recoveryCode: "BAD-CODE" })).error);
    await shutdown();
    await start();
    assert.equal(running.hostKey, key);
    h = await host();
    a = await connect();
    b = await connect();
    assert((await emit(a, "join", { token: joined.token })).ok);
    await waitFor(() => a.state.me);
    assert.equal(a.state.title, "Saved Campus Quiz");
    assert.equal(a.state.phase, "paused");
    assert.equal(a.state.me.choice, 3);
    assert.equal(a.state.remaining, paused);
    assert((await emit(h, "host:pause")).ok);
    await waitFor(() => a.state.phase === "reveal");
    assert(a.state.me.score >= 100 && a.state.me.score <= 150);
    const earned = a.state.me.score;
    assert.equal(a.state.me.history.length, 1);
    assert((await answer(a, 3)).error);
    await shutdown();
    await start();
    h = await host();
    a = await connect();
    assert((await emit(a, "join", { token: joined.token })).ok);
    await waitFor(() => a.state.me);
    assert.equal(a.state.me.score, earned);
    assert.equal(a.state.me.history.length, 1);
    assert((await emit(h, "host:next")).ok);
    await waitFor(() => a.state.index === 1 && a.state.phase === "question");
    const activeCheckpoint = fs.readFileSync(
      path.join(dir, "game-state.json"),
      "utf8",
    );
    await shutdown();
    fs.writeFileSync(path.join(dir, "game-state.json"), activeCheckpoint);
    await start();
    h = await host();
    a = await connect();
    assert((await emit(a, "join", { token: joined.token })).ok);
    await waitFor(() => a.state.me);
    assert.equal(a.state.phase, "paused");
    assert.equal(a.state.index, 1);
    assert.equal(a.state.me.score, earned);
    assert.equal(a.state.me.choice, null);
    assert((await emit(h, "host:pause")).ok);
    await waitFor(() => a.state.phase === "question");
    // Simulate an unwritable save target: the answer must not be acknowledged or retained.
    fs.mkdirSync(path.join(dir, "game-state.json.tmp"));
    assert((await answer(a, 0)).error);
    await waitFor(() => a.state.phase === "paused");
    assert.equal(a.state.me.choice, null);
    assert(a.state.storageError);
    fs.rmdirSync(path.join(dir, "game-state.json.tmp"));
    assert((await emit(h, "host:pause")).ok);
    await waitFor(() => a.state.phase === "question");
    assert((await answer(a, 0)).ok);
    await waitFor(() => a.state.phase === "reveal");
    assert.equal(a.state.me.history.length, 2);
    assert((await emit(h, "host:next")).ok);
    await waitFor(() => a.state.phase === "finished");
    const finalScore = a.state.me.score;
    await shutdown();
    await start();
    h = await host();
    a = await connect();
    assert((await emit(a, "join", { recoveryCode: joined.recoveryCode })).ok);
    await waitFor(() => a.state.me);
    assert.equal(a.state.phase, "finished");
    assert.equal(a.state.me.score, finalScore);
    assert.equal(a.state.me.rank, 1);
    const gameId = a.state.gameId;
    assert((await emit(h, "host:reset")).ok);
    await waitFor(() => a.state.phase === "lobby");
    assert.notEqual(a.state.gameId, gameId);
    assert.equal(a.state.me, null);
    assert((await emit(a, "join", { token: joined.token })).error);
    assert(
      (await emit(a, "join", { recoveryCode: joined.recoveryCode })).error,
    );
    assert((await emit(a, "join", { name: "Alpha" })).ok);
    assert.equal(a.state.title, "Saved Campus Quiz");
    await shutdown();
    fs.writeFileSync(path.join(dir, "game-state.json"), "{broken");
    await start();
    assert.equal(running.hostKey, key);
    const r = await fetch(
      `http://localhost:${running.server.address().port}/data/game-state.json`,
    );
    assert.equal(r.status, 404);
    console.log(
      "PASS: authenticated setup, validation, private recovery, duplicate/late joins, disk-before-ack, pause, device recovery, restart, crash checkpoint, scoring exactly once, answer history, storage failure rollback, final persistence, reset revocation, corrupt-save backup, private data HTTP 404.",
    );
  } finally {
    if (running) await shutdown();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
