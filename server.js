"use strict";
const express = require("express"),
  http = require("node:http");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { performance } = require("node:perf_hooks");
const { Server } = require("socket.io");
const { createNetworkDetector } = require("./network.cjs");
function answerCounts(history) {
  const counts = { correct: 0, wrong: 0, unanswered: 0 };
  for (const answer of history) {
    if (answer.choice === null) counts.unanswered++;
    else if (answer.choice === answer.correctAnswer) counts.correct++;
    else counts.wrong++;
  }
  return counts;
}
function validManualScore(score) {
  return Number.isSafeInteger(score) && Math.abs(score) <= 1000000000;
}
function validateQuestions(list) {
  if (!Array.isArray(list) || list.length < 1 || list.length > 100)
    throw new Error("Use 1–100 questions.");
  return list.map((q, i) => {
    if (
      !q ||
      typeof q.question !== "string" ||
      !q.question.trim() ||
      q.question.length > 500 ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      q.options.some(
        (o) => typeof o !== "string" || !o.trim() || o.length > 200,
      ) ||
      !Number.isInteger(q.answer) ||
      q.answer < 0 ||
      q.answer > 3 ||
      !Number.isInteger(q.time) ||
      q.time < 1 ||
      q.time > 600
    )
      throw new Error(
        `Question ${i + 1}: enter a question, four choices, a correct answer (0–3), and time 1–600 seconds.`,
      );
    return {
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()),
      answer: q.answer,
      time: q.time,
    };
  });
}
function createGameServer(options = {}) {
  const detectNetwork = options.detectNetwork || createNetworkDetector();
  const ip = process.env.LAN_IP || "127.0.0.1",
    port = options.port ?? 3000;
  if (
    !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ||
    ip.split(".").some((n) => +n > 255)
  )
    throw new Error("LAN_IP must be an IPv4 address.");
  const dataDir = options.dataDir || path.join(__dirname, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const savePath = path.join(dataDir, "game-state.json"),
    keyPath = path.join(dataDir, "host-key.txt");
  if (!fs.existsSync(keyPath))
    fs.writeFileSync(keyPath, crypto.randomBytes(18).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  const hostKey = fs.readFileSync(keyPath, "utf8").trim();
  if (!/^[a-f0-9]{36}$/.test(hostKey))
    throw new Error(
      "Invalid data/host-key.txt. Restore the host key from backup.",
    );
  let game = {
    version: 2,
    gameId: crypto.randomUUID(),
    title: "LAN Trivia Night",
    allowLateJoin: true,
    questions: validateQuestions(
      options.questions ||
        JSON.parse(
          fs.readFileSync(path.join(__dirname, "questions.json"), "utf8"),
        ),
    ),
    phase: "lobby",
    index: -1,
    roundId: 0,
    pausedMs: 0,
    savedAt: Date.now(),
    expiresAt: null,
    players: [],
    customLeaderboard: { title: "Shortlisted Teams", teams: [] },
  };
  function checkSave(s) {
    if (
      !s ||
      s.version !== 2 ||
      typeof s.gameId !== "string" ||
      typeof s.title !== "string" ||
      typeof s.allowLateJoin !== "boolean" ||
      !["lobby", "question", "paused", "reveal", "finished"].includes(
        s.phase,
      ) ||
      !Number.isInteger(s.index) ||
      !Number.isInteger(s.roundId) ||
      !Array.isArray(s.players) ||
      s.players.length > 500 ||
      !Number.isFinite(s.savedAt) ||
      !Number.isFinite(s.pausedMs)
    )
      throw new Error("Invalid saved game structure.");
    s.questions = validateQuestions(s.questions);
    if (
      s.index < -1 ||
      s.index >= s.questions.length ||
      (s.phase !== "lobby" && s.index < 0) ||
      (s.phase === "question" && !Number.isFinite(s.expiresAt))
    )
      throw new Error("Invalid saved round.");
    const tokens = new Set(),
      ids = new Set(),
      names = new Set(),
      codes = new Set();
    for (const p of s.players) {
      if (
        !p ||
        typeof p.token !== "string" ||
        !/^[a-f0-9]{48}$/.test(p.token) ||
        typeof p.id !== "string" ||
        typeof p.name !== "string" ||
        !p.name.trim() ||
        p.name.length > 28 ||
        !/^[A-F0-9]{12}$/.test(p.recoveryCode) ||
        !Number.isInteger(p.score) ||
        p.score < 0 ||
        !Number.isInteger(p.earned) ||
        p.earned < 0 ||
        p.earned > 150 ||
        !(
          p.choice === null ||
          (Number.isInteger(p.choice) && p.choice >= 0 && p.choice <= 3)
        ) ||
        !Array.isArray(p.history) ||
        tokens.has(p.token) ||
        ids.has(p.id) ||
        names.has(p.name.toLowerCase()) ||
        codes.has(p.recoveryCode)
      )
        throw new Error("Invalid saved player record.");
      tokens.add(p.token);
      ids.add(p.id);
      names.add(p.name.toLowerCase());
      codes.add(p.recoveryCode);
    }
    // Older saved games gain an independent manual board without losing players.
    if (s.customLeaderboard === undefined)
      s.customLeaderboard = { title: "Shortlisted Teams", teams: [] };
    const board = s.customLeaderboard;
    if (
      !board ||
      typeof board.title !== "string" ||
      !board.title.trim() ||
      board.title.length > 80 ||
      !Array.isArray(board.teams) ||
      board.teams.length > 200
    )
      throw new Error("Invalid saved custom leaderboard.");
    const manualIds = new Set(),
      manualNames = new Set();
    for (const team of board.teams) {
      if (
        !team ||
        typeof team.id !== "string" ||
        !team.id ||
        typeof team.name !== "string" ||
        !team.name.trim() ||
        team.name.length > 28 ||
        !validManualScore(team.score) ||
        !Number.isSafeInteger(team.revision) ||
        team.revision < 0 ||
        !(team.sourceId === null || typeof team.sourceId === "string") ||
        manualIds.has(team.id) ||
        manualNames.has(team.name.toLowerCase())
      )
        throw new Error("Invalid saved custom team.");
      manualIds.add(team.id);
      manualNames.add(team.name.toLowerCase());
    }
    return s;
  }
  if (fs.existsSync(savePath) || fs.existsSync(savePath + ".bak")) {
    let loaded = false;
    for (const file of [savePath, savePath + ".bak"]) {
      try {
        game = checkSave(JSON.parse(fs.readFileSync(file, "utf8")));
        loaded = true;
        if (file.endsWith(".bak"))
          console.warn("Recovered previous snapshot from backup.");
        break;
      } catch (e) {
        console.warn(`Cannot read ${path.basename(file)}: ${e.message}`);
      }
    }
    if (!loaded)
      throw new Error(
        "Saved game and backup could not be read. Restore data/ from backup; files were not overwritten.",
      );
  }
  // Upgrade untouched five-question demo lobbies to the supplied event pack.
  // Active rounds and host-authored quizzes keep their saved questions.
  if (
    !options.questions &&
    game.phase === "lobby" &&
    game.index === -1 &&
    game.players.every((p) => p.score === 0 && p.history.length === 0)
  ) {
    const savedPackHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(game.questions))
      .digest("hex");
    if (
      savedPackHash ===
      "cebd3d54b1b1dbfbafc74ed8a9577924e9ac20985183f1f7283474a2f5697a0a"
    ) {
      game.questions = validateQuestions(
        JSON.parse(
          fs.readFileSync(path.join(__dirname, "questions.json"), "utf8"),
        ),
      );
      console.log(
        "Loaded the event question pack into the untouched demo lobby.",
      );
    }
  }
  if (game.phase === "question") {
    game.pausedMs = Math.max(0, game.expiresAt - game.savedAt);
    game.phase = "paused";
  }
  let players = new Map(
      game.players.map((p) => [p.token, { ...p, sockets: new Set() }]),
    ),
    deadline = 0,
    storageError = "",
    joinURL = `http://${ip}:${port}/`;
  const app = express(),
    server = http.createServer(app),
    io = new Server(server, { maxHttpBufferSize: 262144 });
  app.use(express.static(path.join(__dirname, "public")));
  const millis = () =>
    game.phase === "question"
      ? Math.max(0, deadline - performance.now())
      : game.phase === "paused"
        ? game.pausedMs
        : 0;
  function snapshot() {
    const now = Date.now();
    return {
      ...game,
      savedAt: now,
      expiresAt: game.phase === "question" ? now + millis() : null,
      players: [...players.values()].map(({ sockets, ...p }) => p),
    };
  }
  function persist() {
    const content = JSON.stringify(snapshot(), null, 2);
    if (fs.existsSync(savePath)) {
      const old = fs.readFileSync(savePath, "utf8");
      let valid = false;
      try {
        checkSave(JSON.parse(old));
        valid = true;
      } catch {}
      if (valid) {
        fs.writeFileSync(savePath + ".bak.tmp", old, { mode: 0o600 });
        fs.renameSync(savePath + ".bak.tmp", savePath + ".bak");
      }
    }
    const fd = fs.openSync(savePath + ".tmp", "w", 0o600);
    try {
      fs.writeFileSync(fd, content);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(savePath + ".tmp", savePath);
    storageError = "";
  }
  function stateFor(socket) {
    const q = game.questions[game.index],
      me = players.get(socket.data.token);
    const leaderboard = [...players.values()]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        ...answerCounts(p.history),
        answered: p.choice !== null,
        online: p.sockets.size > 0,
      }));
    return {
      gameId: game.gameId,
      title: game.title,
      allowLateJoin: game.allowLateJoin,
      phase: game.phase,
      roundId: game.roundId,
      index: game.index,
      total: game.questions.length,
      joinURL,
      networkAvailable,
      remaining: Math.ceil(millis() / 1000),
      duration: q?.time || 0,
      question: q ? { question: q.question, options: q.options } : null,
      answer: ["reveal", "finished"].includes(game.phase) ? q?.answer : null,
      leaderboard,
      customLeaderboard: {
        title: game.customLeaderboard.title,
        teams: [...game.customLeaderboard.teams].sort(
          (a, b) => b.score - a.score || a.name.localeCompare(b.name),
        ),
      },
      storageError: storageError
        ? "Saving is unavailable. The host must resolve the storage problem before play continues."
        : "",
      me: me
        ? {
            id: me.id,
            name: me.name,
            score: me.score,
            ...answerCounts(me.history),
            rank: 1 + leaderboard.filter((p) => p.score > me.score).length,
            choice: me.choice,
            recoveryCode: me.recoveryCode,
            history: me.history,
            earned: ["question", "paused"].includes(game.phase)
              ? null
              : me.earned,
          }
        : null,
    };
  }
  function broadcast() {
    for (const s of io.sockets.sockets.values()) s.emit("state", stateFor(s));
  }
  function commit(change) {
    const before = structuredClone(snapshot()),
      connections = new Map(
        [...players].map(([token, p]) => [token, p.sockets]),
      ),
      oldDeadline = deadline;
    try {
      change();
      persist();
      return true;
    } catch (error) {
      game = before;
      players = new Map(
        before.players.map((p) => [
          p.token,
          { ...p, sockets: connections.get(p.token) || new Set() },
        ]),
      );
      deadline = oldDeadline;
      if (game.phase === "question") {
        game.pausedMs = Math.max(0, deadline - performance.now());
        game.phase = "paused";
      }
      storageError = error.message;
      console.error("Game save failed:", error.message);
      broadcast();
      return false;
    }
  }
  function revealChange() {
    game.phase = "reveal";
    game.pausedMs = 0;
    const q = game.questions[game.index];
    for (const p of players.values()) {
      p.score += p.earned;
      p.history.push({
        index: game.index,
        question: q.question,
        choice: p.choice,
        correctAnswer: q.answer,
        options: q.options,
        earned: p.earned,
      });
    }
  }
  function expire() {
    if (game.phase === "question" && millis() <= 0) {
      const ok = commit(revealChange);
      broadcast();
      return ok;
    }
    return true;
  }
  persist();
  const ticker = setInterval(() => {
    if (game.phase !== "question") return;
    if (!expire()) return;
    if (game.phase === "question") commit(() => {});
    broadcast();
  }, 1000);
  const reply = (ack, value) => {
    if (typeof ack === "function") ack(value);
  };
  const saved = (ack, ok) =>
    reply(
      ack,
      ok
        ? { ok: true }
        : {
            error:
              "Could not save to disk. Game paused; check the server terminal.",
          },
    );
  io.on("connection", (socket) => {
    socket.emit("state", stateFor(socket));
    socket.on("host:auth", (key, ack) => {
      socket.data.host = typeof key === "string" && key === hostKey;
      reply(ack, { ok: socket.data.host });
    });
    const customAction = (event, prepare) =>
      socket.on(event, (data, ack) => {
        if (!socket.data.host)
          return reply(ack, { error: "Host authentication required." });
        try {
          const change = prepare(data);
          saved(ack, commit(change));
          broadcast();
        } catch (error) {
          reply(ack, { error: error.message });
        }
      });
    const customTeam = (id) => {
      const team = game.customLeaderboard.teams.find((t) => t.id === id);
      if (!team)
        throw new Error("Team not found. Refresh the board and try again.");
      return team;
    };
    const manualName = (value, exceptId = null) => {
      const name =
        typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
      if (!name || name.length > 28)
        throw new Error("Use a team name of 1–28 characters.");
      if (
        game.customLeaderboard.teams.some(
          (t) =>
            t.id !== exceptId && t.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new Error("That team name is already on the custom board.");
      return name;
    };
    customAction("custom:rename", (data) => {
      const title = typeof data?.title === "string" ? data.title.trim() : "";
      if (!title || title.length > 80)
        throw new Error("Use a board title of 1–80 characters.");
      return () => {
        game.customLeaderboard.title = title;
      };
    });
    customAction("custom:addTeam", (data) => {
      if (game.customLeaderboard.teams.length >= 200)
        throw new Error("This board is full (200 teams).");
      const name = manualName(data?.name);
      if (!validManualScore(data?.score))
        throw new Error(
          "Enter a whole-number score between -1,000,000,000 and 1,000,000,000.",
        );
      const sourceId = data.sourceId || null;
      if (sourceId && ![...players.values()].some((p) => p.id === sourceId))
        throw new Error(
          "That quiz team is no longer available. Type the name instead.",
        );
      const team = {
        id: crypto.randomUUID(),
        name,
        score: data.score,
        sourceId,
        revision: 0,
      };
      return () => {
        game.customLeaderboard.teams.push(team);
      };
    });
    customAction("custom:updateTeam", (data) => {
      const team = customTeam(data?.id),
        name = manualName(data?.name, team.id);
      if (!validManualScore(data?.score))
        throw new Error("Enter a valid whole-number score.");
      if (data.revision !== team.revision)
        throw new Error(
          "This team changed while you were editing. Click Edit again to load its latest score.",
        );
      return () => {
        team.name = name;
        team.score = data.score;
        team.revision++;
      };
    });
    customAction("custom:adjustScore", (data) => {
      const team = customTeam(data?.id);
      if (
        !Number.isSafeInteger(data.delta) ||
        !validManualScore(team.score + data.delta)
      )
        throw new Error("Enter a valid score adjustment.");
      return () => {
        team.score += data.delta;
        team.revision++;
      };
    });
    customAction("custom:removeTeam", (data) => {
      const team = customTeam(data?.id);
      return () => {
        game.customLeaderboard.teams = game.customLeaderboard.teams.filter(
          (t) => t.id !== team.id,
        );
      };
    });
    customAction("custom:clear", () => () => {
      game.customLeaderboard.teams = [];
    });
    socket.on("host:setup", (_, ack) => {
      if (!socket.data.host)
        return reply(ack, { error: "Host authentication required." });
      reply(ack, {
        ok: true,
        title: game.title,
        allowLateJoin: game.allowLateJoin,
        questions: game.questions,
        players: [...players.values()].map((p) => ({
          id: p.id,
          name: p.name,
          recoveryCode: p.recoveryCode,
        })),
      });
    });
    socket.on("host:saveSetup", (data, ack) => {
      if (!socket.data.host)
        return reply(ack, { error: "Host authentication required." });
      if (game.phase !== "lobby")
        return reply(ack, {
          error:
            "Questions can be edited only before starting. Reset first for a new game.",
        });
      try {
        if (
          typeof data?.title !== "string" ||
          !data.title.trim() ||
          data.title.length > 80 ||
          typeof data.allowLateJoin !== "boolean"
        )
          throw new Error(
            "Enter a title (1–80 characters) and joining preference.",
          );
        const questions = validateQuestions(data.questions);
        const ok = commit(() => {
          game.title = data.title.trim();
          game.allowLateJoin = data.allowLateJoin;
          game.questions = questions;
        });
        saved(ack, ok);
        broadcast();
      } catch (e) {
        reply(ack, { error: e.message });
      }
    });
    socket.on("host:next", (_, ack) => {
      if (!socket.data.host)
        return reply(ack, { error: "Host authentication required." });
      if (!["lobby", "reveal"].includes(game.phase))
        return reply(ack, { error: "Wait for the current question to end." });
      const ok = commit(() => {
        if (game.index + 1 >= game.questions.length) {
          game.phase = "finished";
          return;
        }
        game.index++;
        game.roundId++;
        game.phase = "question";
        game.pausedMs = 0;
        for (const p of players.values()) {
          p.choice = null;
          p.earned = 0;
        }
        deadline = performance.now() + game.questions[game.index].time * 1000;
      });
      saved(ack, ok);
      broadcast();
    });
    socket.on("host:pause", (_, ack) => {
      if (!socket.data.host)
        return reply(ack, { error: "Host authentication required." });
      if (!expire()) return saved(ack, false);
      if (!["question", "paused"].includes(game.phase))
        return reply(ack, { error: "There is no active question to pause." });
      const ok = commit(() => {
        if (game.phase === "question") {
          game.pausedMs = millis();
          game.phase = "paused";
        } else if (game.pausedMs <= 0) revealChange();
        else {
          deadline = performance.now() + game.pausedMs;
          game.phase = "question";
        }
      });
      saved(ack, ok);
      broadcast();
    });
    socket.on("host:reset", (_, ack) => {
      if (!socket.data.host)
        return reply(ack, { error: "Host authentication required." });
      const ok = commit(() => {
        players.clear();
        game.phase = "lobby";
        game.index = -1;
        game.roundId++;
        game.gameId = crypto.randomUUID();
        game.pausedMs = 0;
      });
      if (ok)
        for (const s of io.sockets.sockets.values()) {
          delete s.data.token;
          s.emit("kicked");
        }
      saved(ack, ok);
      broadcast();
    });
    socket.on("join", (data, ack) => {
      if (!data || typeof data !== "object")
        return reply(ack, { error: "Enter a team name or recovery code." });
      if (!expire()) return saved(ack, false);
      const code =
        typeof data.recoveryCode === "string"
          ? data.recoveryCode.toUpperCase().replace(/[-\s]/g, "")
          : "";
      let p = code
        ? [...players.values()].find((p) => p.recoveryCode === code)
        : players.get(socket.data.token) || players.get(data.token);
      if (!p && (code || (data.token && !data.name)))
        return reply(ack, {
          error: code
            ? "Recovery code not found in this game."
            : "Your previous game was reset. Join the new game.",
        });
      if (!p) {
        if (
          game.phase === "finished" ||
          (!game.allowLateJoin && game.phase !== "lobby")
        )
          return reply(ack, {
            error:
              "New players cannot join now. Returning players can use their recovery code.",
          });
        const name =
          typeof data.name === "string"
            ? data.name.trim().replace(/\s+/g, " ")
            : "";
        if (!name || name.length > 28)
          return reply(ack, { error: "Use a name of 1–28 characters." });
        if (
          [...players.values()].some(
            (p) => p.name.toLowerCase() === name.toLowerCase(),
          )
        )
          return reply(ack, {
            error:
              "That name already exists. Use your recovery code to return.",
          });
        if (players.size >= 500)
          return reply(ack, { error: "The lobby is full (500 teams)." });
        const token = crypto.randomBytes(24).toString("hex");
        let recoveryCode;
        do {
          recoveryCode = crypto.randomBytes(6).toString("hex").toUpperCase();
        } while (
          [...players.values()].some((p) => p.recoveryCode === recoveryCode)
        );
        p = {
          token,
          id: crypto.randomUUID(),
          name,
          recoveryCode,
          score: 0,
          choice: null,
          earned: 0,
          history: [],
          sockets: new Set(),
        };
        if (!commit(() => players.set(token, p))) return saved(ack, false);
      }
      const previous = players.get(socket.data.token);
      if (previous && previous.token !== p.token)
        previous.sockets.delete(socket.id);
      p.sockets.add(socket.id);
      socket.data.token = p.token;
      reply(ack, { ok: true, token: p.token, recoveryCode: p.recoveryCode });
      broadcast();
    });
    socket.on("answer", (data, ack) => {
      if (!expire()) return saved(ack, false);
      const p = players.get(socket.data.token);
      if (
        !p ||
        game.phase !== "question" ||
        data?.roundId !== game.roundId ||
        data?.gameId !== game.gameId ||
        p.choice !== null ||
        !Number.isInteger(data.choice) ||
        data.choice < 0 ||
        data.choice > 3
      )
        return reply(ack, { error: "Answer unavailable or already locked." });
      const fraction = Math.max(
        0,
        Math.min(1, millis() / (game.questions[game.index].time * 1000)),
      );
      const ok = commit(() => {
        p.choice = data.choice;
        p.earned =
          p.choice === game.questions[game.index].answer
            ? 100 + Math.round(50 * fraction)
            : 0;
      });
      saved(ack, ok);
      broadcast();
    });
    socket.on("sync", () => {
      expire();
      socket.emit("state", stateFor(socket));
    });
    socket.on("disconnect", () => {
      players.get(socket.data.token)?.sockets.delete(socket.id);
      broadcast();
    });
  });
  let refreshingNetwork = false,
    closing = false,
    networkAvailable = false;
  async function refreshNetwork() {
    if (refreshingNetwork || closing || !server.listening) return;
    refreshingNetwork = true;
    try {
      const detected = await detectNetwork();
      if (closing) return;
      const currentIP = process.env.LAN_IP || detected.ip;
      const nextURL = `http://${currentIP}:${server.address().port}/`;
      networkAvailable = currentIP !== "127.0.0.1";
      if (nextURL !== joinURL) {
        joinURL = nextURL;
        console.log(
          networkAvailable
            ? `Players link / QR updated: ${joinURL}`
            : "No local network detected. Turn on the hotspot or connect the laptop to your router.",
        );
        broadcast();
      }
      return detected;
    } catch (error) {
      console.warn("Network detection will retry:", error.message);
    } finally {
      refreshingNetwork = false;
    }
  }
  const networkTicker = setInterval(
    refreshNetwork,
    options.networkIntervalMs || 2000,
  );
  const ready = new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", async () => {
      joinURL = `http://${ip}:${server.address().port}/`;
      const detected = await refreshNetwork();
      console.log(
        `\nLAN TRIVIA\nPlayers: ${joinURL}\nHost (private): http://localhost:${server.address().port}/host.html#${hostKey}\nHost key: ${hostKey}`,
      );
      console.log(
        `Saved game: ${savePath}\nStatus: ${game.phase} · ${game.title} · ${players.size} teams`,
      );
      console.log(
        "Detected adapters:",
        (detected?.addresses || [])
          .map((a) => `${a.name}: ${a.ip}`)
          .join(", ") || "none",
      );
      if (game.phase === "paused")
        console.log(
          "Restored question paused. Use Resume Question on the host dashboard.",
        );
      if (!networkAvailable)
        console.warn(
          "Waiting for a router or laptop hotspot. The QR will update automatically when one is available.",
        );
      resolve();
    });
  });
  async function close() {
    closing = true;
    clearInterval(ticker);
    clearInterval(networkTicker);
    if (game.phase === "question")
      commit(() => {
        game.pausedMs = millis();
        game.phase = "paused";
      });
    await new Promise((resolve) => io.close(resolve));
  }
  return { server, io, ready, close, hostKey };
}
module.exports = { createGameServer, validateQuestions };
if (require.main === module) {
  try {
    const running = createGameServer();
    running.ready.catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await running.close();
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
