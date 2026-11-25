"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
function writeDurable(file, content, flag = "w") {
  const fd = fs.openSync(file, flag, 0o600);
  try {
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
function lockDataDirectory(dir) {
  const file = path.join(dir, "server.lock"),
    nonce = crypto.randomUUID();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeDurable(file, JSON.stringify({ pid: process.pid, nonce }), "wx");
      return () => {
        try {
          const lock = JSON.parse(fs.readFileSync(file, "utf8"));
          if (lock.nonce === nonce) fs.unlinkSync(file);
        } catch (e) {
          if (e.code !== "ENOENT")
            console.warn("Could not release game lock:", e.message);
        }
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const content = fs.readFileSync(file, "utf8");
      let old;
      try {
        old = JSON.parse(content);
      } catch {
        throw new Error(
          "The game lock is unreadable. Keep data/ intact and ask for recovery help.",
        );
      }
      if (!Number.isInteger(old.pid) || old.pid < 1)
        throw new Error(
          "Invalid game lock. Startup stopped to protect saved data.",
        );
      let alive = true;
      try {
        process.kill(old.pid, 0);
      } catch (e) {
        if (e.code === "ESRCH") alive = false;
      }
      if (alive)
        throw new Error(
          "Another copy is using this game folder. Close its game window before starting again.",
        );
      // Rename stale locks instead of deleting them; only one recovering process wins.
      try {
        fs.linkSync(file, file + ".recovery");
      } catch {
        throw new Error(
          "Another startup is recovering this folder. Try again after it finishes.",
        );
      }
      try {
        if (fs.readFileSync(file, "utf8") !== content)
          throw new Error("The game lock changed. Try starting again.");
        fs.unlinkSync(file);
      } finally {
        fs.unlinkSync(file + ".recovery");
      }
    }
  }
  throw new Error(
    "Could not obtain the game lock. Saved data was not changed.",
  );
}
function archives(dir) {
  const folder = path.join(dir, "backups");
  const filename = (id) => {
    if (typeof id !== "string" || !/^\d{13}-[a-f0-9-]{36}$/.test(id))
      throw new Error("Invalid backup selection.");
    return path.join(folder, id + ".json");
  };
  function save(reason, game) {
    fs.mkdirSync(folder, { recursive: true });
    const id = `${Date.now()}-${crypto.randomUUID()}`;
    const record = {
      version: 1,
      createdAt: new Date().toISOString(),
      reason,
      game,
    };
    writeDurable(filename(id), JSON.stringify(record, null, 2), "wx");
    return id;
  }
  function read(id) {
    const record = JSON.parse(fs.readFileSync(filename(id), "utf8"));
    if (record.version !== 1 || !record.game)
      throw new Error("This backup is not readable.");
    return record;
  }
  function list() {
    if (!fs.existsSync(folder)) return [];
    return fs
      .readdirSync(folder)
      .filter((n) => /^\d{13}-[a-f0-9-]{36}\.json$/.test(n))
      .sort()
      .reverse()
      .slice(0, 100)
      .flatMap((file) => {
        const id = file.slice(0, -5);
        try {
          const r = read(id);
          return [
            {
              id,
              createdAt: r.createdAt,
              reason: r.reason,
              title: r.game.title,
              players: r.game.players.length,
              customTeams: r.game.customLeaderboard?.teams.length || 0,
              phase: r.game.phase,
            },
          ];
        } catch {
          return [];
        }
      });
  }
  return { save, read, list };
}
module.exports = { writeDurable, lockDataDirectory, archives };
