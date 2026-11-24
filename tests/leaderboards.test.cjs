"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { test } = require("node:test");
const { io } = require("socket.io-client");
const { createGameServer } = require("../server.js");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (socket, event, data = null) =>
  new Promise((resolve, reject) =>
    socket
      .timeout(4000)
      .emit(event, data, (e, v) => (e ? reject(e) : resolve(v))),
  );
const wait = async (predicate) => {
  for (let i = 0; i < 250; i++) {
    if (predicate()) return;
    await delay(30);
  }
  throw new Error("Timed out waiting for game state");
};
test("speed scoring, answer totals, independent custom board, authorization and persistence", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lan-leaderboards-test-"));
  const questions = [4, 1, 1].map((time, i) => ({
    question: `Question ${i + 1}`,
    options: ["Correct", "Wrong", "Wrong again", "Nope"],
    answer: 0,
    time,
  }));
  let app,
    clients = [];
  const start = async () => {
    app = createGameServer({
      port: 0,
      dataDir: dir,
      questions,
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
  const answer = (s, choice) =>
    emit(s, "answer", {
      choice,
      gameId: s.state.gameId,
      roundId: s.state.roundId,
    });
  try {
    await start();
    let host = await connect(),
      a = await connect(),
      b = await connect(),
      c = await connect(),
      guest = await connect(),
      host2 = await connect();
    assert((await emit(host, "host:auth", app.hostKey)).ok);
    assert((await emit(host2, "host:auth", app.hostKey)).ok);
    const joined = await emit(a, "join", { name: "Fast" });
    assert(joined.ok);
    assert((await emit(b, "join", { name: "Slow" })).ok);
    assert((await emit(c, "join", { name: "Other" })).ok);
    for (const event of [
      "custom:rename",
      "custom:addTeam",
      "custom:updateTeam",
      "custom:adjustScore",
      "custom:removeTeam",
      "custom:clear",
    ])
      assert((await emit(guest, event, {})).error);
    assert((await emit(host, "host:next")).ok);
    await wait(() => a.state.phase === "question");
    assert((await answer(a, 0)).ok);
    await delay(1100);
    assert((await answer(b, 0)).ok);
    assert((await answer(c, 1)).ok);
    assert.equal(a.state.leaderboard.find((p) => p.name === "Fast").correct, 0);
    assert.equal(c.state.me.wrong, 0);
    assert(
      (await emit(host, "custom:rename", { title: "Finalists — Round 2" })).ok,
    );
    assert(
      (
        await emit(host, "custom:addTeam", {
          name: "Fast",
          score: 100,
          sourceId: a.state.me.id,
        })
      ).ok,
    );
    assert(
      (await emit(host, "custom:addTeam", { name: "New team", score: 40 })).ok,
    );
    assert(
      (await emit(host, "custom:addTeam", { name: "fast", score: 0 })).error,
    );
    assert(
      (await emit(host, "custom:addTeam", { name: "Bad", score: 1.5 })).error,
    );
    assert(
      (await emit(host, "custom:addTeam", { name: "Bad", score: 1e12 })).error,
    );
    assert.equal(a.state.phase, "question");
    assert.equal(a.state.me.score, 0);
    let team = host.state.customLeaderboard.teams.find(
      (p) => p.name === "Fast",
    );
    assert(
      (
        await emit(host, "custom:updateTeam", {
          id: team.id,
          name: "Fast Finalists",
          score: 175,
          revision: team.revision,
        })
      ).ok,
    );
    assert(
      (
        await emit(host, "custom:updateTeam", {
          id: team.id,
          name: "Stale",
          score: 999,
          revision: team.revision,
        })
      ).error,
    );
    await Promise.all([
      emit(host, "custom:adjustScore", { id: team.id, delta: 10 }),
      emit(host2, "custom:adjustScore", { id: team.id, delta: 50 }),
    ]).then((results) => results.forEach((r) => assert(r.ok)));
    assert.equal(
      host.state.customLeaderboard.teams.find((t) => t.id === team.id).score,
      235,
    );
    await wait(() => a.state.phase === "reveal");
    assert(
      a.state.me.score > b.state.me.score,
      "faster correct answer should earn more",
    );
    assert.equal(c.state.me.score, 0);
    assert.equal(a.state.me.correct, 1);
    assert.equal(c.state.me.wrong, 1);
    assert((await emit(host, "host:next")).ok);
    await wait(() => a.state.index === 1 && a.state.phase === "question");
    assert((await answer(a, 1)).ok);
    assert((await answer(c, 0)).ok);
    await wait(() => a.state.phase === "reveal");
    assert((await emit(host, "host:next")).ok);
    await wait(() => a.state.index === 2 && a.state.phase === "question");
    assert((await answer(b, 1)).ok);
    await wait(() => a.state.phase === "reveal");
    for (const p of a.state.leaderboard) {
      assert.equal(p.correct, 1);
      assert.equal(p.wrong, 1);
      assert.equal(p.unanswered, 1);
    }
    assert((await emit(host, "host:next")).ok);
    await wait(() => a.state.phase === "finished");
    const quizScore = a.state.me.score;
    const persisted = JSON.parse(
      fs.readFileSync(path.join(dir, "game-state.json"), "utf8"),
    );
    assert.equal(
      persisted.customLeaderboard.teams.find((t) => t.id === team.id).score,
      235,
    );
    await stop();
    await start();
    host = await connect();
    a = await connect();
    assert((await emit(host, "host:auth", app.hostKey)).ok);
    assert((await emit(a, "join", { token: joined.token })).ok);
    await wait(() => a.state.me);
    assert.equal(a.state.me.score, quizScore);
    assert.equal(a.state.me.correct, 1);
    assert.equal(a.state.me.wrong, 1);
    assert.equal(a.state.me.unanswered, 1);
    assert.equal(host.state.customLeaderboard.title, "Finalists — Round 2");
    assert.equal(host.state.customLeaderboard.teams[0].score, 235);
    assert((await emit(host, "host:reset")).ok);
    await wait(() => host.state.phase === "lobby");
    assert.equal(host.state.customLeaderboard.teams.length, 2);
    assert((await emit(host, "custom:removeTeam", { id: team.id })).ok);
    assert.equal(host.state.customLeaderboard.teams.length, 1);
    assert((await emit(host, "custom:clear")).ok);
    assert.equal(host.state.customLeaderboard.teams.length, 0);
    await stop();
    // Loading a version-2 game written before the manual board existed is nondestructive.
    const legacy = JSON.parse(
      fs.readFileSync(path.join(dir, "game-state.json"), "utf8"),
    );
    delete legacy.customLeaderboard;
    fs.writeFileSync(path.join(dir, "game-state.json"), JSON.stringify(legacy));
    await start();
    host = await connect();
    assert.equal(host.state.customLeaderboard.teams.length, 0);
    assert.equal(host.state.phase, "lobby");
  } finally {
    if (app) await stop();
  }
});
