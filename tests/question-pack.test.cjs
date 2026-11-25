const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { createGameServer, validateQuestions } = require("../server.js");
const { io } = require("socket.io-client");
const pack = require("../questions.json"),
  quiz = require("../round-1-quiz.json"),
  old = require("./fixtures/old-demo.json");
const emit = (s, event, data) =>
  new Promise((r, j) =>
    s.timeout(3000).emit(event, data, (e, v) => (e ? j(e) : r(v))),
  );
test("organizer pack has 25 ordered questions, 20-second timers and correct keyed choices", () => {
  assert.equal(validateQuestions(pack).length, 25);
  assert.deepEqual(quiz.questions, pack);
  assert.deepEqual(
    pack.map((q) => "ABCD"[q.answer]),
    "BCBCB CDACD BABBB BDCAB BBCAB".replace(/ /g, "").split(""),
  );
  assert(
    pack.every(
      (q) =>
        q.time === 20 &&
        !/answer:/i.test(q.question) &&
        q.options.every((o) => !/Correct Answer/i.test(o)),
    ),
  );
  assert.equal(pack[13].options[pack[13].answer], "8,611");
});
test("fresh games load event pack; demo lobby upgrades; custom and active quizzes stay intact", async () => {
  async function launch(dataDir, questions) {
    const app = createGameServer({
      port: 0,
      dataDir,
      questions,
      detectNetwork: async () => ({ ip: "127.0.0.1", addresses: [] }),
    });
    await app.ready;
    return app;
  }
  async function inspect(app) {
    const socket = io(`http://localhost:${app.server.address().port}`);
    await new Promise((r) => socket.once("connect", r));
    assert((await emit(socket, "host:auth", app.hostKey)).ok);
    const setup = await emit(socket, "host:setup", null);
    socket.disconnect();
    return setup;
  }
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), "lan-pack-"));
  let app = await launch(fresh);
  try {
    assert.equal((await inspect(app)).questions.length, 25);
  } finally {
    await app.close();
  }
  for (const [kind, questions] of [
    ["demo", old],
    ["custom", [{ ...pack[0], question: "A custom quiz question" }]],
    ["active", old],
  ]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lan-pack-"));
    app = await launch(dir, questions);
    await app.close();
    const file = path.join(dir, "game-state.json"),
      saved = JSON.parse(fs.readFileSync(file));
    if (kind === "active") {
      saved.phase = "paused";
      saved.index = 0;
      saved.pausedMs = 1000;
      fs.writeFileSync(file, JSON.stringify(saved));
    }
    app = await launch(dir);
    try {
      assert.deepEqual(
        (await inspect(app)).questions,
        kind === "demo" ? pack : questions,
      );
    } finally {
      await app.close();
    }
  }
});
