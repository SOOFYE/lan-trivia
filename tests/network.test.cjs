"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { io } = require("socket.io-client");
const { createNetworkDetector, selectAddresses } = require("../network.cjs");
const { createGameServer } = require("../server.js");
const nic = (ip) => [{ family: "IPv4", internal: false, address: ip }];
test("router, custom hotspot, virtual-adapter avoidance, disconnect and recovery", async () => {
  const pcs = {
    Ethernet: nic("192.168.0.36"),
    "vEthernet (WSL)": nic("172.21.224.1"),
    "Radmin VPN": nic("26.41.19.230"),
  };
  assert.equal(selectAddresses(pcs)[0].ip, "192.168.0.36");
  assert.equal(
    selectAddresses({
      ...pcs,
      "Local Area Connection* 12": nic("192.168.211.1"),
    })[0].ip,
    "192.168.211.1",
  );
  assert.equal(
    selectAddresses({
      ...pcs,
      "Local Area Connection* 12": nic("192.168.137.1"),
    })[0].ip,
    "192.168.137.1",
  );
  assert.equal(
    selectAddresses({ ...pcs, "Localized adapter": nic("10.42.9.1") }, [
      {
        ip: "10.42.9.1",
        description: "Microsoft Wi-Fi Direct Virtual Adapter",
        shared: false,
      },
    ])[0].ip,
    "10.42.9.1",
  );
  assert.equal(
    selectAddresses({ ...pcs, "Custom ICS": nic("10.99.7.1") }, [
      { ip: "10.99.7.1", shared: true },
    ])[0].ip,
    "10.99.7.1",
  );
  let current = pcs;
  let probes = 0;
  const detect = createNetworkDetector({
    platform: "win32",
    interfaces: () => current,
    probe: async () => {
      probes++;
      return [
        {
          ip: "10.42.9.1",
          description: "Microsoft Wi-Fi Direct Virtual Adapter",
          shared: true,
        },
      ];
    },
  });
  assert.equal((await detect()).ip, "192.168.0.36");
  await detect();
  assert.equal(probes, 1);
  current = { ...pcs, "Localized adapter": nic("10.42.9.1") };
  assert.equal((await detect()).ip, "10.42.9.1");
  assert.equal(probes, 2);
  current = { "vEthernet (WSL)": nic("172.21.224.1") };
  assert.equal((await detect()).ip, "127.0.0.1");
  current = { Ethernet: nic("192.168.8.50") };
  assert.equal((await detect()).ip, "192.168.8.50");
  const fallback = createNetworkDetector({
    platform: "win32",
    interfaces: () => ({
      ...pcs,
      "Local Area Connection* 7": nic("192.168.202.1"),
    }),
    probe: async () => {
      throw new Error("access denied");
    },
  });
  assert.equal((await fallback()).ip, "192.168.202.1");
});
test("live join URL updates preserve game and players without restarting", async () => {
  let current = { Ethernet: nic("192.168.0.36") };
  const detect = createNetworkDetector({
    platform: "linux",
    interfaces: () => current,
  });
  const app = createGameServer({
    port: 0,
    networkIntervalMs: 30,
    detectNetwork: detect,
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "lan-network-test-")),
    questions: [
      { question: "Q?", options: ["A", "B", "C", "D"], answer: 0, time: 20 },
    ],
  });
  let host, player;
  const wait = async (fn) => {
    for (let i = 0; i < 160; i++) {
      if (fn()) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("State not updated");
  };
  const send = (s, event, data = null) =>
    new Promise((resolve, reject) =>
      s.timeout(2000).emit(event, data, (e, v) => (e ? reject(e) : resolve(v))),
    );
  try {
    await app.ready;
    const url = `http://localhost:${app.server.address().port}`;
    host = io(url);
    player = io(url);
    let h, p;
    host.on("state", (s) => (h = s));
    player.on("state", (s) => (p = s));
    await wait(() => h && p);
    assert.equal(
      h.joinURL,
      `http://192.168.0.36:${app.server.address().port}/`,
    );
    assert((await send(host, "host:auth", app.hostKey)).ok);
    const joined = await send(player, "join", { name: "Returner" });
    assert(joined.ok);
    assert((await send(host, "host:next")).ok);
    await wait(() => p.phase === "question");
    assert(
      (
        await send(player, "answer", {
          choice: 0,
          gameId: p.gameId,
          roundId: p.roundId,
        })
      ).ok,
    );
    const id = p.me.id,
      gameId = p.gameId;
    current = {
      Ethernet: nic("192.168.0.36"),
      "Local Area Connection* 2": nic("192.168.211.1"),
    };
    await wait(() => h.joinURL.includes("192.168.211.1"));
    assert.equal(p.gameId, gameId);
    assert.equal(p.me.id, id);
    assert.equal(p.me.choice, 0);
    assert.equal(p.phase, "question");
    current = { Ethernet: nic("192.168.4.21") };
    await wait(() => h.joinURL.includes("192.168.4.21"));
    current = {};
    await wait(() => h.networkAvailable === false);
    assert(h.joinURL.includes("127.0.0.1"));
    current = { WiFi: nic("10.0.0.55") };
    await wait(() => h.joinURL.includes("10.0.0.55") && h.networkAvailable);
    assert.equal(p.me.id, id);
    assert.equal(p.me.choice, 0);
    console.log(
      "PASS: router → custom hotspot → DHCP change → disconnect → reconnect; scores and locked answers retained.",
    );
  } finally {
    host?.disconnect();
    player?.disconnect();
    await app.close();
  }
});
