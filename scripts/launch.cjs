"use strict";
const os = require("node:os");
const readline = require("node:readline/promises");
const { createGameServer } = require("../server.js");

function networkChoices(interfaces = os.networkInterfaces()) {
  return Object.entries(interfaces)
    .flatMap(([name, list]) =>
      (list || [])
        .filter((a) => a.family === "IPv4" && !a.internal)
        .map((a) => ({ name, ip: a.address })),
    )
    .sort((a, b) => {
      const score = (a) =>
        (a.ip === "192.168.137.1" ? 30 : 0) -
        (/vpn|wsl|vethernet|vmware|vbox|docker/i.test(a.name) ? 20 : 0);
      return score(b) - score(a);
    });
}

async function launch() {
  console.log("\nLAN TRIVIA — START YOUR GAME\n");
  console.log(
    "Using a laptop hotspot? Turn it on and connect a phone before continuing.",
  );
  console.log("On that phone, open Wi-Fi details and find Router or Gateway.");
  console.log(
    "Select the matching laptop address below (often 192.168.137.1 for Windows hotspot).\n",
  );
  const choices = networkChoices();
  console.log("0. Choose the address automatically (usual home/router setup)");
  choices.forEach((a, i) =>
    console.log(
      `${i + 1}. ${a.name}: ${a.ip}${a.ip === "192.168.137.1" ? " — common Windows hotspot address; check your phone" : ""}`,
    ),
  );
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let answer;
  while (true) {
    const text = (
      await prompt.question(
        "\nType a number, then press Enter (Enter = automatic): ",
      )
    ).trim();
    answer = text === "" ? 0 : Number(text);
    if (
      /^\d*$/.test(text) &&
      Number.isInteger(answer) &&
      answer >= 0 &&
      answer <= choices.length
    )
      break;
    console.log("Please choose one of the numbers shown above.");
  }
  prompt.close();
  if (answer) process.env.LAN_IP = choices[answer - 1].ip;
  else delete process.env.LAN_IP;
  console.log("\nStarting… Keep this window open while people are playing.");
  const app = createGameServer();
  try {
    await app.ready;
  } catch (error) {
    await app.close();
    throw error;
  }
  console.log(
    "\nOpen the private Host link above on this laptop. Phones use the Players link or QR code.",
  );
  console.log(
    "Use Ctrl+C to stop. For a different network, stop and open START-GAME.cmd again.",
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
module.exports = { networkChoices };
if (require.main === module)
  launch().catch((error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? "Another copy is already running on port 3000. Close its game window before trying again."
        : error.message,
    );
    process.exitCode = 1;
  });
