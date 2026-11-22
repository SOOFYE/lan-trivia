"use strict";
const os = require("node:os");
const { createGameServer } = require("../server.js");
const { selectAddresses } = require("../network.cjs");

function networkChoices(interfaces = os.networkInterfaces()) {
  return selectAddresses(interfaces);
}

async function launch() {
  console.log("\nLAN TRIVIA — START YOUR GAME\n");
  console.log(
    "Connect phones to your Wi-Fi or laptop hotspot. The game finds its address automatically.",
  );
  // The double-click launcher always follows network changes. Advanced users
  // may still deliberately pin LAN_IP when running server.js directly.
  delete process.env.LAN_IP;
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
    "Use Ctrl+C to stop. The Players link and QR update automatically if the network changes.",
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
