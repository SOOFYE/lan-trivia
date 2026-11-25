const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { io } = require("socket.io-client");
const { createGameServer } = require("../server.js");
const { lockDataDirectory } = require("../storage.cjs");
const http = require("node:http");
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), "lan-safety-"));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, e, d = null) =>
  new Promise((r, j) =>
    s.timeout(4000).emit(e, d, (error, v) => (error ? j(error) : r(v))),
  );
const wait = async (fn) => {
  for (let i = 0; i < 200; i++) {
    if (fn()) return;
    await delay(20);
  }
  throw Error("State did not update");
};
test("single writer, stale lock recovery and malformed lock refusal", () => {
  const dir = temporary(),
    release = lockDataDirectory(dir);
  const original = fs.readFileSync(path.join(dir, "server.lock"), "utf8");
  assert.throws(() => lockDataDirectory(dir), /Another copy/);
  assert.equal(
    fs.readFileSync(path.join(dir, "server.lock"), "utf8"),
    original,
  );
  release();
  fs.writeFileSync(
    path.join(dir, "server.lock"),
    JSON.stringify({ pid: 2147483647, nonce: "stale" }),
  );
  const release2 = lockDataDirectory(dir);
  release2();
  fs.writeFileSync(path.join(dir, "server.lock"), "{broken");
  assert.throws(() => lockDataDirectory(dir), /unreadable/);
  assert.equal(
    fs.readFileSync(path.join(dir, "server.lock"), "utf8"),
    "{broken",
  );
});
test("occupied port refuses startup without rewriting the saved game", async () => {
  const dir = temporary(),
    network = async () => ({ ip: "127.0.0.1", addresses: [] });
  const seed = createGameServer({
    port: 0,
    dataDir: dir,
    detectNetwork: network,
  });
  await seed.ready;
  await seed.close();
  const before = fs.readFileSync(path.join(dir, "game-state.json"), "utf8");
  const occupied = http.createServer();
  await new Promise((r) => occupied.listen(0, "0.0.0.0", r));
  const app = createGameServer({
    port: occupied.address().port,
    dataDir: dir,
    detectNetwork: network,
  });
  try {
    await assert.rejects(app.ready, { code: "EADDRINUSE" });
    assert.equal(
      fs.readFileSync(path.join(dir, "game-state.json"), "utf8"),
      before,
    );
    assert(!fs.existsSync(path.join(dir, "server.lock")));
  } finally {
    await app.close();
    await new Promise((r) => occupied.close(r));
  }
});
test("reset/clear backups, scoped restore, failed-backup refusal and corrupted-file preservation", async () => {
  const dir = temporary();
  let app,
    clients = [];
  const start = async () => {
    app = createGameServer({
      port: 0,
      dataDir: dir,
      questions: [
        {
          question: "First",
          options: ["Yes", "No", "Maybe", "Never"],
          answer: 0,
          time: 1,
        },
        {
          question: "Second",
          options: ["Yes", "No", "Maybe", "Never"],
          answer: 0,
          time: 30,
        },
      ],
      detectNetwork: async () => ({ ip: "127.0.0.1", addresses: [] }),
    });
    await app.ready;
  };
  const connect = async () => {
    const s = io(`http://localhost:${app.server.address().port}`);
    clients.push(s);
    s.on("state", (v) => (s.state = v));
    await wait(() => s.state);
    return s;
  };
  const stop = async () => {
    clients.forEach((s) => s.disconnect());
    clients = [];
    await app.close();
  };
  try {
    await start();
    let host = await connect(),
      player = await connect(),
      guest = await connect();
    assert((await emit(host, "host:auth", app.hostKey)).ok);
    const joined = await emit(player, "join", { name: "Saved team" });
    assert(joined.ok);
    const primaryBefore = fs.readFileSync(
      path.join(dir, "game-state.json"),
      "utf8",
    );
    assert.throws(
      () => createGameServer({ dataDir: dir, port: 0 }),
      /Another copy/,
    );
    assert.equal(
      fs.readFileSync(path.join(dir, "game-state.json"), "utf8"),
      primaryBefore,
    );
    for (const e of [
      "host:backups",
      "host:backupNow",
      "host:downloadBackup",
      "host:restoreBackup",
    ])
      assert(
        (
          await emit(guest, e, {
            id: "../../outside",
            confirm: "RESTORE",
            mode: "all",
          })
        ).error,
      );
    await emit(host, "host:next");
    await wait(() => player.state.phase === "question");
    assert(
      (
        await emit(player, "answer", {
          choice: 0,
          gameId: player.state.gameId,
          roundId: player.state.roundId,
        })
      ).ok,
    );
    await wait(() => player.state.phase === "reveal");
    const score = player.state.me.score;
    await emit(host, "host:next");
    await wait(
      () => player.state.phase === "question" && player.state.index === 1,
    );
    await emit(player, "answer", {
      choice: 0,
      gameId: player.state.gameId,
      roundId: player.state.roundId,
    });
    await emit(host, "custom:addTeam", { name: "Finalists", score: 99 });
    const manual = (await emit(host, "host:backupNow")).id;
    assert(
      (await emit(host, "host:restoreBackup", { id: manual, mode: "all" }))
        .error,
    );
    assert(
      (await emit(host, "host:downloadBackup", { id: "../../outside" })).error,
    );
    const backup = (await emit(host, "host:downloadBackup", { id: manual }))
      .backup;
    assert.equal(backup.game.players[0].score, score);
    assert.equal(backup.game.players[0].choice, 0);
    assert((await emit(host, "host:reset")).ok);
    assert.equal(host.state.leaderboard.length, 0);
    assert(
      (await emit(host, "host:backups")).backups.some(
        (b) => b.reason === "Before quiz reset",
      ),
    );
    assert(
      (
        await emit(host, "host:restoreBackup", {
          id: manual,
          mode: "quiz",
          confirm: "RESTORE",
        })
      ).ok,
    );
    await wait(() => host.state.phase === "paused");
    assert.equal(host.state.customLeaderboard.teams[0].score, 99);
    assert((await emit(player, "join", { token: joined.token })).ok);
    await wait(() => player.state.me);
    assert.equal(player.state.me.score, score);
    assert.equal(player.state.me.choice, 0);
    await emit(host, "custom:clear");
    assert.equal(host.state.customLeaderboard.teams.length, 0);
    const beforeClear = (await emit(host, "host:backups")).backups.find(
      (b) => b.reason === "Before custom:clear",
    );
    assert(beforeClear);
    assert(
      (
        await emit(host, "host:restoreBackup", {
          id: beforeClear.id,
          mode: "custom",
          confirm: "RESTORE",
        })
      ).ok,
    );
    assert.equal(host.state.phase, "paused");
    assert.equal(player.state.me.score, score);
    assert.equal(host.state.customLeaderboard.teams[0].score, 99);
    // Block only the backup directory. Destructive operations must leave state untouched.
    fs.renameSync(path.join(dir, "backups"), path.join(dir, "backups.saved"));
    fs.writeFileSync(path.join(dir, "backups"), "blocked");
    const before = JSON.stringify(host.state.leaderboard);
    assert((await emit(host, "host:reset")).error);
    assert.equal(JSON.stringify(host.state.leaderboard), before);
    assert((await emit(host, "custom:clear")).error);
    assert.equal(host.state.customLeaderboard.teams.length, 1);
    fs.unlinkSync(path.join(dir, "backups"));
    fs.renameSync(path.join(dir, "backups.saved"), path.join(dir, "backups"));
    assert(
      (await emit(host, "host:backups")).backups.some(
        (b) => b.reason === "Before backup restore",
      ),
    );
    const response = await fetch(
      `http://localhost:${app.server.address().port}/data/backups/${manual}.json`,
    );
    assert.equal(response.status, 404);
    await stop();
    assert(!fs.existsSync(path.join(dir, "server.lock")));
    fs.writeFileSync(path.join(dir, "game-state.json"), "{corrupted");
    await start();
    const preserved = fs
      .readdirSync(path.join(dir, "backups"))
      .find(
        (n) => n.startsWith("unreadable-") && n.endsWith("game-state.json"),
      );
    assert(preserved);
    assert.equal(
      fs.readFileSync(path.join(dir, "backups", preserved), "utf8"),
      "{corrupted",
    );
  } finally {
    if (app) await stop();
  }
});
