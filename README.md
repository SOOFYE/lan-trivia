# LAN Trivia

Host a quiz on your laptop. Players answer on their phones. **No internet needed during play.**

## First time only

1. Install [Node.js LTS](https://nodejs.org/) on the laptop. Use the installer's default settings.
2. [Download **lan-trivia-offline-ready.zip**](https://github.com/SOOFYE/lan-trivia/releases/latest). Right-click it → **Extract All**. Open the extracted `lan-trivia` folder.

Do this while you have internet. Phones do not need anything installed.

**Included quiz:** 25 Pakistan General Knowledge questions from the organizer's Round 1 pack, with **20 seconds per question**. If an existing saved quiz is selected, use **Game Setup → Import JSON → round-1-quiz.json → Save Game Setup** before starting. Untouched demo lobbies update automatically.

## Start a game

1. **Connect everyone:** laptop and phones must use the same router. The laptop can use an Ethernet cable. No router? See **Laptop hotspot** below.
2. Double-click **START-GAME.cmd**. It finds the connection address automatically. **Keep the black window open.**
3. Copy the **Host (private)** link from that window into the laptop's browser. If asked for a key, use the **Host key** printed there.
4. Click **Game Setup** → edit questions → **Save Game Setup**. Return to the dashboard.
5. Players connect to the same Wi-Fi, scan the dashboard's QR code, enter a name, and join.
6. Click **Start Game**, then **Next Question** after each answer reveal.

**Projector controls:** use **Fullscreen Leaderboard** for a big score table with correct/wrong totals. **Hide QR Code / Show QR Code** controls the QR. For shortlisted teams, open **Custom Leaderboard**, add names and your own scores, then use **Fullscreen Custom Board**. Press **Esc** or **Exit Fullscreen** to return.

## Laptop hotspot — no router

1. On the laptop: **Settings → Network & internet → Mobile hotspot**. Choose **Share over: Wi-Fi**, set a name/password, and turn it on.
2. Connect phones to that Wi-Fi. If they say **No internet**, choose **Stay connected**.
3. Open **START-GAME.cmd**. It detects the hotspot automatically. Continue from step 3 above.

The laptop needs Wi-Fi hardware. If Windows will not turn the hotspot on, use [hotspot help](HELP.md#option-b-no-wi-fi-router--use-the-laptops-hotspot).

## Page addresses

Open these **on the laptop**, after starting the game:

| Page | Address |
| --- | --- |
| Host dashboard / projector | [http://localhost:3000/host.html](http://localhost:3000/host.html) |
| Edit questions / game setup | [http://localhost:3000/setup.html](http://localhost:3000/setup.html) |
| Shortlisted teams / manual scores | [http://localhost:3000/custom.html](http://localhost:3000/custom.html) |
| Player screen | [http://localhost:3000/](http://localhost:3000/) — `/index.html` opens the same page |

**On phones:** scan the QR or use the **Players** link printed in the black window. **Do not use `localhost` on a phone.** Connect to Wi-Fi before scanning; the game QR does not connect Wi-Fi for you.

**Changed networks?** The link and QR update automatically. Connect phones to the new Wi-Fi and scan again. Use a recovery code if asked to restore your team.

**Stop:** press **Ctrl+C** in the black window. Reopen **START-GAME.cmd** later to continue saved progress. **Reset Game** clears players and scores; export scores first.

[Phone won't connect?](HELP.md#if-a-phone-cannot-open-the-game) · [Player recovery and host guide](HOST-GUIDE.md) · [Technical details and internal endpoints](HELP.md#internal-endpoints-for-developers)
