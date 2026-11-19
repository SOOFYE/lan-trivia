# Running your trivia night

## Set up the game

1. On Windows, double-click **START-GAME.cmd** in the extracted app folder. Choose automatic address detection for a router network, or select the address matching the phone's Router/Gateway for a laptop hotspot. You can also run `npm start` in the app folder. Open the private **Host** URL printed in the terminal. Your host key stays the same across restarts because it is saved locally.
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

First export scores you want to keep. **Reset Game / Kick All Players** clears all players, scores, histories, tokens, and recovery codes for the current game after confirmation. It keeps the title and questions, returns to the lobby, and allows editing again. Reset is deliberately a fresh start; previous recovery codes cannot enter the new game.

Only one live game is hosted at a time. Completed results remain available until reset. This version has no historical-game archive; download scores before starting a new game. Knockout elimination is managed by the organizer.

## Back up or move your game

The private `data/` directory contains:

```text
data/
  game-state.json       Current saved game, including private player tokens/codes
  game-state.json.bak   Previous valid snapshot
  host-key.txt          Persistent host control key
```

Stop the server before copying this directory, then keep the copy private. To move to another laptop, copy the app (with installed dependencies) and this directory, install Node.js, and start it. Players can use their recovery codes if the join URL changes. Do not run both copies as separate live servers and expect them to synchronize.

If the primary save is unreadable, the app tries the previous valid snapshot and prints a recovery warning. That backup may be one change behind. If neither file is valid, startup stops without overwriting them; restore your backup. A power failure or disk failure still makes external backups worthwhile.

The supplied source and offline-ready ZIPs exclude this private directory, so sharing a download does not share your host key or player identities. The server serves only `public/`; files in `data/` are not downloadable through the web app.

## Connecting without a router

See **Option B: No Wi-Fi router — use the laptop's hotspot** in [README.md](README.md). Turn on the supported laptop hotspot first, connect the phones, then choose the laptop address matching the phone's Router/Gateway in the launcher. Wi-Fi hardware is still required, and Windows may refuse a hotspot without an upstream connection on some setups. The guide includes offline alternatives and the Windows firewall fix.
