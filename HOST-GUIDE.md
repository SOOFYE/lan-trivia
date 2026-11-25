# Running your trivia night

## Set up the game

1. On Windows, double-click **START-GAME.cmd** in the extracted app folder. The game automatically detects a laptop hotspot or router connection; no address selection is needed. You can also run `npm start` in the app folder. Open the private **Host** URL printed in the terminal. Your host key stays the same across restarts because it is saved locally.
2. Click **Game Setup**. This opens a separate private workspace; keep this tab off the projector because it includes answer keys and player recovery codes.
3. Enter the game title and choose whether new players may join after the first question starts. Returning players can always recover their existing team.
4. Edit each question and its four choices. Select the radio button beside the correct answer and set the time limit. You can add, remove, or reorder up to 100 questions. **Import JSON** accepts the original `questions.json` array or a quiz exported from this workspace.
5. Click **Save Game Setup**. Look for the saved confirmation. **Export Quiz JSON** downloads the current editor contents for reuse; it includes correct answers. Exporting does not save changes to the running game.
6. Return to the dashboard. Project that tab and let players scan its QR code. Check the number of teams online.
7. Click **Start Game**. The questions are locked against editing once play begins.

## During play

- Players answer once per question. The server confirms answers only after saving them on the laptop.
- At zero, the answer is revealed, points are applied, and the leaderboard updates.
- Click **Next Question** after a reveal. The host controls pacing; there is no automatic next-question advance.
- **Pause Question** freezes the remaining time and disables answers. Existing answers remain locked. **Resume Question** continues from that point.
- An offline player's name stays in the standings. Scores do not disappear when someone closes their browser or disconnects.
- A player's absence does not pause the whole game. They return to the current live question; they cannot replay questions missed while away.
- After the last question, click **Show Final Results**. **Export Scores CSV** downloads the current standings, including offline teams and shared ranks for ties. It can also be used midgame; pending points from the active question are not included until reveal.

## Big-screen leaderboard and QR controls

- Click **Fullscreen Leaderboard** on the dashboard to show only the live standings across the screen. Click **Exit Fullscreen** or press **Esc** to return. If the browser cannot enter native fullscreen, the board still fills its window.
- **Correct** counts correct submitted answers; **Wrong** counts incorrect submitted answers. **No answer** counts completed questions missed while the team was registered. These totals update after the reveal, so they do not expose the current correct answer early. They are also included in the quiz score CSV.
- Correct answers earn **100 points plus up to 50 for speed**. Earlier correct answers get a larger speed bonus; wrong or missing answers get zero. Timing is based on when the server receives the answer. Very close answers can receive the same rounded point total.
- Click **Hide QR Code** to hide just the QR image. The join link and player count stay visible. **Show QR Code** brings back the current QR. This view preference is remembered in that browser.

## Shortlisted teams and scores you enter yourself

1. After round 1, click **Custom Leaderboard** on the dashboard. It opens a separate page; there is no need to reset the quiz.
2. Give this board a title, such as **Round 2 Finalists**, and click **Save Title**.
3. Choose a quiz team from the dropdown, or type a new team name. Enter the starting score you want, then click **Add Team**. Repeat for the shortlisted teams. Choosing a quiz team copies its name, not its quiz points.
4. Click **Edit** beside a team to change its name or total score, then **Save Team**. You can also use **+10** and **−10** for quick score changes. Whole-number negative totals are allowed for penalties.
5. Click **Fullscreen Custom Board** to project only the ranked names and manual scores. Editing controls are hidden in fullscreen. Use **Esc** or **Exit Fullscreen** to return and enter more scores.
6. Click **Export Custom Scores CSV** to save these results.

All custom scores save on the laptop and survive restarting the game. They do not alter quiz points or answer totals. **Reset Game** clears the quiz roster but keeps this custom board, including teams copied from the quiz. **Clear Custom Teams** clears only manual teams and scores, after confirmation; export first. **Remove** removes one team from the custom board only.

The board sorts automatically by score. Ties share a rank. Multiple authenticated host pages can view/edit the same board. If another host changes a team while you have its Edit form open, click Edit again to reload its current score before saving.

## When someone leaves and comes back

### Same phone and browser

The browser saves a private team token in local storage. Reloading, closing/reopening the tab, restarting the browser, or reconnecting Wi-Fi normally returns that team automatically when they reopen the **same player URL**. Scores, answer history, and accepted current answers come from the server's saved record.

Do not use private/incognito browsing if you expect automatic return after closing the browser. Storage is tied to the browser, scheme, IP/hostname, and port. For example, `localhost`, `192.168.0.36`, and a changed laptop IP are different browser origins.

### Different phone/browser, cleared browser data, or a changed server IP

Each player screen has **Your private recovery code**. Save it privately. On the join screen, enter it under **Already playing?** and click **Recover my progress**. The same team, score, history, and locked answer are restored. Recovery codes are case-insensitive and accept spaces or hyphens.

If the player lost the code, the host can open **Game Setup → Help a returning player → Refresh Player Codes**. Verify the team's identity and give its code privately. Anyone holding that code can play as that team. Multiple devices using the same code share one team and one answer per question.

Entering an existing nickname alone does not reclaim its score; this prevents someone casually taking another team's name.

## If the laptop/server restarts

Run `npm start` again in the **same app folder**. The app reloads its saved title, quiz, players, tokens, recovery codes, scores, history, and current round. Reopen the host dashboard. An interrupted question is restored **paused**, using the most recent one-second checkpoint. Review the room and click **Resume Question**. Accepted answers stay locked and earned points are not awarded twice.

While the server is down, phones cannot submit answers. With an abrupt crash, the remaining time can move back by up to about one checkpoint interval. Accepted joins and answers are saved before their success response. A normal `Ctrl+C` shutdown explicitly saves the paused question.

If saving fails during play, the app rolls back the attempted action and pauses the question. Check the server terminal and restore write access/free space in the app's `data` directory. Resume only after fixing the problem; a successful resume saves the game again. Do not assume an answer was accepted if it showed an error.

## Start another game

First export scores you want to keep. **Reset Game / Kick All Players** clears all quiz players, quiz scores, histories, tokens, and recovery codes for the current game after confirmation. It keeps the title, questions, and independent custom leaderboard, returns to the lobby, and allows editing again. Reset is deliberately a fresh quiz start; previous recovery codes cannot enter the new game.

Only one live game is hosted at a time. Completed results remain available until reset. This version has no historical-game archive; download scores before starting a new game. Knockout elimination is managed by the organizer.

## Undo a reset, clear, or mistaken edit

Open **Backups / Restore** on the host dashboard. The app automatically saves a private recovery snapshot before quiz reset, custom clear/removal/manual team edit, and quiz setup replacement. It also saves before upgrading an untouched demo question pack. If that required backup cannot be written, the change is cancelled.

1. Choose the recovery copy from before the mistake.
2. Choose **Custom leaderboard only**, **Quiz and players only**, or **Entire saved game**. Restoring custom scores alone leaves current quiz progress intact; restoring the quiz alone keeps current custom scores.
3. Type **RESTORE**, click **Restore Selected Backup**, and confirm.
4. Return to the dashboard. Restored active questions are paused. Resume when ready. Players not present in that snapshot may need to join again; original players can use their saved token or recovery code.

A restore first saves the current game too, so it can itself be undone. Quiz restores return to that point in time; scores earned after it are replaced for the selected part. The page lists the latest 100 snapshots; older snapshot files stay on disk. No automatic deletion/pruning is performed, so check free disk space before an event.

Use **Create Backup Now**, then **Download Selected Backup**, for a private copy outside the laptop. It contains player tokens and recovery details; do not share or commit it publicly. A download is a raw game-state JSON file, not a question-import file.

For recovery onto a replacement copy: stop that app, keep a separate copy of its current `data` folder, copy the downloaded game-state JSON into `data`, name it `game-state.json`, and start the app. Use the host key printed by that copy; the downloaded game-state file does not replace its host key. Keep the original backup unchanged. If unsure, ask for help before replacing files.

## Back up or move your game

The private `data/` directory contains:

```text
data/
  game-state.json       Current saved game, including private player tokens/codes
  game-state.json.bak   Previous valid snapshot
  host-key.txt          Persistent host control key
  backups/              Recovery snapshots before destructive changes
  server.lock           Prevents two app copies writing the same game folder
```

Stop the server before copying this directory, then keep the copy private. To move to another laptop, copy the app (with installed dependencies) and this directory, install Node.js, and start it. Players can use their recovery codes if the join URL changes. Do not run both copies as separate live servers and expect them to synchronize.

If the primary save is unreadable, the app tries the previous valid snapshot and prints a recovery warning. It preserves the unreadable file inside `data/backups/` before replacing the primary. The fallback may be one change behind. If neither file is valid, startup stops without overwriting them; restore your backup. A power failure or disk failure still makes external backups essential.

Only one process may use a saved-game folder at a time. If another copy is running, the app refuses startup before modifying the saved game. A stale lock left by a stopped process is recovered automatically. If a lock is unreadable or recovery is already in progress, startup stops rather than guessing; keep `data/` intact and ask for help. Never remove a lock to run two copies on the same folder.

The supplied source and offline-ready ZIPs exclude this private directory, so sharing a download does not share your host key or player identities. The server serves only `public/`; files in `data/` are not downloadable through the web app.

## Connecting without a router

Start with the short [README.md](README.md). For more detail, see **Option B: No Wi-Fi router — use the laptop's hotspot** in [HELP.md](HELP.md). Turn on the supported laptop hotspot, connect the phones, and run the game. Its address and QR update automatically, including after a network change. Keep the host dashboard open through `localhost` on the laptop. If phones were on an old address, connect them to the new Wi-Fi and scan the updated QR; use recovery codes if needed. Wi-Fi hardware is still required, and Windows may refuse a hotspot without an upstream connection on some setups. The help page includes offline alternatives and the Windows firewall fix.
