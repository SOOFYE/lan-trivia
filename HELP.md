# Detailed help

Run a multiplayer trivia game from one laptop. Players join on their phones, and the host puts the dashboard on a projector or big screen.

**The game needs a local connection between devices, but it does not need internet during play.** You can use a Wi-Fi router, a PC connected by Ethernet to that router, or a supported laptop hotspot with phones connected directly to it.

No accounts, external fonts, online APIs, or CDN downloads are used during the game.

[Back to the short setup instructions](README.md)

## What you get

- Phone-friendly player screens and a live projector leaderboard.
- A QR code that opens the laptop's player page.
- A host workspace to write questions, choose answers, set timers, and import/export quizzes.
- Pause/resume, score export, and a fresh-game reset.
- Saved scores and answers, automatic player return, and private recovery codes for switching devices.
- Saved games that survive a server restart. An interrupted question comes back paused.

## Before you start

You need:

- One laptop or PC with **Node.js installed**. Download the LTS installer from [nodejs.org](https://nodejs.org/), accept its normal defaults, and finish installation before going to an offline venue.
- A phone with a web browser for each player/team. Phones do not need an app.
- A way for the phones to connect to the laptop: use **Option A or B** below.

Internet is needed **once** to download Node.js and prepare the game. After that, keep the complete prepared game folder. Downloading only GitHub's source ZIP does not include the installed dependencies.

### Download and prepare

1. Open [Releases](https://github.com/SOOFYE/lan-trivia/releases/latest).
2. Download **lan-trivia-offline-ready.zip** for the easiest start. It includes the files the game needs to run, but you must still install Node.js on the laptop.
3. Right-click the ZIP and choose **Extract All**. Open the extracted `lan-trivia` folder. Do not try to run the game from inside the ZIP preview.
4. On Windows, double-click **START-GAME.cmd**. If you downloaded the source instead, the launcher offers to install missing dependencies; do this while you have internet.
5. Keep the game folder somewhere you can find it, such as Documents. Keep the black terminal window open throughout the game.

The launcher does not need administrator access to run the game. If Windows asks whether Node.js may communicate on your trusted local network, allow it. For connection problems, see [Troubleshooting](#if-a-phone-cannot-open-the-game).

## Option A: Use the same router

This is usually best for a room with several players.

1. Connect the laptop to the router using **Ethernet or Wi-Fi**.
2. Connect every phone to that router's Wi-Fi. A laptop on Ethernet and a phone on Wi-Fi can play together.
3. Avoid a **Guest** network that prevents devices from communicating.
4. Open **START-GAME.cmd**. The address is detected automatically; no number needs to be entered.
5. Continue with [Open the dashboard](#open-the-dashboard-and-set-up-your-quiz).

The router can be disconnected from the internet. It only needs power and a working local network.

## Option B: No Wi-Fi router — use the laptop's hotspot

The laptop creates its own Wi-Fi network, and phones connect directly to it. You do not need an existing Wi-Fi network.

**The laptop must have working Wi-Fi hardware that supports hotspot mode.** An Ethernet-only desktop cannot broadcast Wi-Fi without a suitable wireless adapter. This app does not turn a computer without a Wi-Fi radio into a hotspot.

### 1. Turn on the hotspot in Windows

On Windows 11:

1. Open **Start → Settings → Network & internet → Mobile hotspot**.
2. If the laptop has Ethernet, select **Ethernet** under **Share my internet connection from**. Otherwise select the connection Windows offers for your setup.
3. Choose **Wi-Fi** under **Share over**.
4. Open **Properties → Edit**, choose a network name and password, then save. Use a password of at least eight characters. Choose **2.4 GHz** if an older phone cannot see the network and that option is available.
5. Turn **Mobile hotspot** on. If you see a power-saving option that switches it off when no devices are connected, turn that option off for the event.

Windows 10 uses similar names under **Settings → Network & Internet → Mobile hotspot**. See [Microsoft's illustrated hotspot instructions](https://support.microsoft.com/en-us/windows/experience/connectivity-networking/use-your-windows-device-as-a-mobile-hotspot) if your screen looks different.

**Offline hotspot limitation:** the trivia game does not use internet, but Windows/driver behavior determines whether Mobile hotspot can be switched on with no upstream connection. Some PCs refuse or turn it off. Test your exact laptop before the event. If Windows refuses in your fully disconnected setup, the app cannot override that restriction: use a local router/travel router without internet instead, or a supported phone hotspot with mobile data off if that phone permits it. If you use a phone hotspot, connect both the laptop and the player devices to that network and verify they can communicate. Do not assume every hotspot supports every setup.

### 2. Connect the phones

1. On each phone, open **Settings → Wi-Fi**.
2. Choose the network name you created and enter its password.
3. If the phone says **No internet**, choose **Stay connected**, **Use this network anyway**, or the equivalent. That message is expected when the local network has no internet.
4. For a true offline test, turn mobile data off and leave Wi-Fi on. If a VPN is active, turn it off while testing the local game.

**Connecting to hotspot Wi-Fi and joining the game are two separate steps.** The game's QR code opens the trivia page; it does not connect the phone to Wi-Fi for you.

### 3. Start the game — the address is automatic

1. On the laptop, open **START-GAME.cmd**. No address entry or selection is needed.
2. The laptop prints a **Players** link and a private **Host** link. Open the Host link on the laptop. The dashboard's QR and visible player link use the detected address.
3. When a supported Windows hotspot is active, the app prefers its address over Ethernet, Wi-Fi, VPN, and WSL addresses. Otherwise it prefers a usable local router connection.

For example, **only if the phone says its Router is `192.168.137.1`**, its game URL will be `http://192.168.137.1:3000/`.

The app watches for network changes while running. If the hotspot is switched on later, switched off, or assigned a different address, the link and QR update automatically after a few seconds; no game restart is needed. With no usable local network, the host page waits instead of showing a misleading VPN/WSL QR code. Keep the host page open through its `localhost` link so it remains reachable during network changes. Phones on the old address must connect to the new Wi-Fi and scan again. A different address is a different browser location, so use the player's recovery code if automatic return is unavailable; scores remain saved.

The Windows probe reads local adapter and connection-sharing metadata; it does not enable the hotspot or change network settings. If Windows blocks that read, detection falls back to adapter names and assigned addresses. On unusual systems with multiple networks and no recognizable hotspot, check the phone's Router/Gateway against the printed Players link; advanced users can set `LAN_IP` with `npm start` as described below.

For a small group, a supported laptop hotspot may be enough. For a large hall, use a suitable local router and test your expected number of devices; the game's player limit is not a promise of Wi-Fi capacity.

## Open the dashboard and set up your quiz

1. In the game window, find **Host (private)**. Copy that entire link and paste it into a browser on the laptop. The link contains your private host key; do not share it with players.
2. Click **Game Setup**. This opens the host's editing workspace. Keep that tab off the projector because it contains correct answers and recovery codes.
3. Set the game title. Edit the questions and four choices, select each correct answer, and set the time allowed.
4. You can add/remove/reorder questions, or import a quiz JSON file. The included Round 1 pack has 25 Pakistan General Knowledge questions with 20-second timers. Use `round-1-quiz.json` to import the complete titled quiz into an existing lobby. Active games and host-authored saved quizzes are not overwritten; finish/reset the quiz before importing. Untouched five-question demo lobbies upgrade automatically on restart.
5. Click **Save Game Setup**, then go back to the dashboard.
6. Put the dashboard on the projector. Players scan its QR code after connecting to the correct Wi-Fi, enter their names, and join.
7. Click **Start Game**. When the timer reaches zero, answers are revealed and points are awarded. Click **Next Question** when ready.
8. Use **Pause Question / Resume Question** when you need to stop the clock. After the last reveal, click **Show Final Results**.
9. Click **Export Scores CSV** to keep the results. It opens in spreadsheet programs.

Correct answers earn 100 points plus up to 50 for speed. Players cannot change an accepted answer. The server controls timing and scoring.

## If someone leaves and comes back

- **Same phone/browser and same game URL:** opening the page again normally restores their team automatically, including scores and locked answers.
- **Different phone/browser, cleared browser data, or a changed laptop address:** enter the private code under **Already playing? → Recover my progress**. Players can find their code under **Your private recovery code** while playing.
- **Lost recovery code:** the host can open **Game Setup → Help a returning player → Refresh Player Codes** and give the correct code privately.
- **Private/incognito browsing:** automatic return may stop working after the browser closes. Save the recovery code.
- **Missed questions:** players return to the current live round. They cannot replay questions that ended while they were away.

Anyone with a team's recovery code can play as that team. Keep it private.

## Stop, resume, or start a fresh game

- **Stop:** click the terminal window and press **Ctrl+C**. Leave the game folder intact.
- **Resume later:** open **START-GAME.cmd** again from that same folder. Scores and players reload. If a question was interrupted, the host must click **Resume Question**.
- **Fresh game:** export the old scores first, then click **Reset Game / Kick All Players** and confirm. It clears players, scores, answer history, and recovery codes; the title and quiz stay ready to edit. This is different from stopping the server.

For a backup, stop the game and copy its private `data` folder somewhere safe. Do not post that folder publicly; it contains the host key and player recovery details. Downloadable release archives exclude it.

## If a phone cannot open the game

Try these in order:

1. Keep the game's terminal window open. If it closed, run the launcher again.
2. Make sure the phone is connected to the right Wi-Fi/hotspot. Check that it did not switch away because there is no internet.
3. Type the **Players** URL exactly, starting with **http://** and ending in **:3000/**. Use the laptop's address. `localhost` on a phone refers to the phone itself.
4. For a laptop hotspot, wait a few seconds for detection and scan the dashboard's current QR again. If it still fails, compare the URL's address with **Router/Gateway** in the phone's Wi-Fi details. See the advanced override below for unusual adapter setups.
5. Avoid guest Wi-Fi and disconnect VPNs while testing. Some school/office networks prevent local devices from reaching each other; ask the administrator or use your own approved local network.
6. If the page works on the laptop but not the phone, check Windows Firewall below.

### Windows Firewall: allow the game

Keep Windows Firewall on. For your own trusted local network, open Start, type **PowerShell**, right-click **Windows PowerShell**, and choose **Run as administrator**. Paste this entire line and press Enter:

```powershell
netsh advfirewall firewall add rule name="LAN Trivia" dir=in action=allow protocol=TCP localport=3000 remoteip=LocalSubnet profile=any
```

This allows the game port from nearby devices on the local subnet. You only need to add it once; do not forward port 3000 to the internet.

If it still fails, Windows may have an older **Block** rule for Node.js. An explicit block can override the allow rule. To inspect those rules, run:

```powershell
Get-NetFirewallRule -DisplayName "Node.js JavaScript Runtime" | Format-Table DisplayName,Enabled,Direction,Action,Profile
```

**Only if it shows an enabled inbound Block rule for Node.js**, disable those conflicting block rules with this single line:

```powershell
Get-NetFirewallRule -DisplayName "Node.js JavaScript Runtime" | Where-Object { $_.Direction -eq 'Inbound' -and $_.Action -eq 'Block' } | Disable-NetFirewallRule
```

This disables matching Node.js inbound block rules, including TCP/UDP if present. It does not turn off the firewall or change other existing allow rules. Retry the phone page. On a managed school/work PC, ask its administrator instead of changing organization-controlled rules.

If PowerShell says **Access denied**, reopen it using **Run as administrator**. If it says no matching Node.js rules exist, that particular block rule was not found; check the earlier connection steps instead. If another program already uses port 3000, close the other copy of the game before starting.

## More help

- [Host guide](HOST-GUIDE.md): quiz setup, player recovery, restarts, storage errors, and backups.
- The app runs **one live game at a time**. Export completed scores before resetting; there is no historical-game archive or automatic knockout elimination.
- A local network connection is still required. A phone that is disconnected from the laptop cannot submit answers. This is not a standalone cached PWA.
- Hotspot behavior depends on Windows, drivers, and hardware. Hotspot instructions were checked against Microsoft's documentation, but have not been physically tested on every device. Hall-scale performance and projector readability need testing at your venue.

## For developers

Node.js 18 or newer is supported by the code; use a supported LTS release. Express and Socket.io are runtime dependencies. The QR encoder and all browser assets are served locally.

```sh
git clone https://github.com/SOOFYE/lan-trivia.git
cd lan-trivia
npm ci
npm start
```

Both `npm run launch` and `npm start` detect the connection automatically and update it while running. The double-click launcher always uses automatic mode. For an unusual network, advanced users can deliberately pin an address with `npm start` in PowerShell (a pinned address stays fixed until removed):

```powershell
$env:LAN_IP = Read-Host 'Enter the laptop address reachable from the phones'
npm start
```

`questions.json` seeds a fresh installation. An existing saved game takes priority; import edited questions through Game Setup and save them while in the lobby.

Run the regression suite after a full `npm ci` (not an install that omits development dependencies):

```sh
npm test
```

Tests exercise authenticated setup, validation, player recovery, answer locking, pause, disk-before-acknowledgment behavior, restart/crash recovery, scoring once, save-failure rollback, final results, reset revocation, corrupt-save backup recovery, and private-data HTTP 404 responses. GitHub Actions runs the suite on Node.js 22 and 24.

The server binds to `0.0.0.0:3000` and checks local addresses every two seconds. On Windows, it reads active adapter descriptions and Internet Connection Sharing private-side metadata at startup, after adapter-address changes, and periodically; a Windows read may take up to five seconds before falling back. Hotspots take priority over other local adapters. Windows queries run hidden and do not require an approval prompt. An explicit `LAN_IP` override is honored only for direct server runs. Private state stays outside `public/`; `data/`, `node_modules/`, and local environment files are excluded from Git.

Reference documentation: [Socket.io server options](https://socket.io/docs/v4/server-options/), [Express setup](https://expressjs.com/en/starter/installing/), and [Windows hotspot setup](https://support.microsoft.com/en-us/windows/experience/connectivity-networking/use-your-windows-device-as-a-mobile-hotspot). None of these sites is contacted by the running game.

## Internal endpoints for developers

People running the game only need the five pages listed in the README. These are all application page and connection endpoints; there is no separate REST API:

| Path | Purpose |
| --- | --- |
| `/` | Player page; same content as `/index.html`. |
| `/index.html` | Player page. |
| `/host.html` | Host dashboard and projector page. Host key required for controls. |
| `/setup.html` | Private quiz editor and player recovery workspace. Host key required for data/actions. |
| `/custom.html` | Independent manual leaderboard for shortlisted teams. Host key required to edit; supports fullscreen display. |
| `/backups.html` | Host-only backup listing, creation, download, and scoped restore controls. |
| `/presentation.js`, `/presentation.css` | Local fullscreen/fallback controls and styling for both leaderboards. |
| `/socket.io/socket.io.js` | Local Socket.io browser client; loaded automatically by the pages. |
| `/socket.io/` | Socket.io / Engine.IO connection path for polling and WebSocket traffic. Not a page to open manually. |

The server also serves static assets from `public/`. Private saved games in `data/` and the root-level `questions.json` are not served as static files.

Client-to-server Socket.io events are `host:auth`, `host:setup`, `host:saveSetup`, `host:next`, `host:pause`, `host:reset`, `join`, `answer`, `sync`, `custom:rename`, `custom:addTeam`, `custom:updateTeam`, `custom:adjustScore`, `custom:removeTeam`, and `custom:clear`. The server sends `state` updates and `kicked` notifications; `disconnect` is a built-in connection event. All host and custom-edit actions check authentication on the server. Custom teams are persisted in `game-state.json` separately from player records. Existing version-2 saves without a custom board are migrated automatically without losing quiz progress.

Recovery events are `host:backups`, `host:backupNow`, `host:downloadBackup`, and `host:restoreBackup`; every one requires server-side host authentication. Restore identifiers are restricted to local backup filenames, not arbitrary paths. Restores require an explicit mode and confirmation value, validate the saved state, and back up current state before committing. The app writes only within its configured data directory during gameplay; it does not format drives, recursively delete folders, or change firewall settings. Backups are not automatically deleted. This is a trusted-LAN app, not a hardened internet-facing service. No software can guarantee protection against hardware failure, a user deleting the app's data folder, or a compromised computer; maintain a separate private backup.
