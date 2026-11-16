# makefun-best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Alfatih15/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Alfatih15/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Emberfall Keep: a top-down arena shooter with 10 waves, blessings, and a boss.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=hjff56h1&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

An original top-down arena shooter for the make.fun **best-game-01** bounty. You are
the keeper of the last lantern; shades close in over 10 waves, ending with the
Gloomwarden boss. Hold the keep, pick a blessing between waves, and keep the light alive.

## How to play

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold left click | Shoot lantern fire |
| Space / Shift | Dash (brief invulnerability, cooldown shown in the HUD) |
| P / Esc | Pause |
| M | Mute / unmute |
| 1 / 2 / 3 or click a card | Pick a blessing between waves |
| Space / Enter / click | Start, restart |

## The game

- **10 waves** of escalating shades: Drifters (chasers), Wisps (fast zigzag),
  Spitters (ranged), Brutes (tanks), and the **Gloomwarden** boss on wave 10, who
  fires radial bursts and summons Wisps.
- **Blessings between waves** — pick 1 of 3: Ember Rounds (+damage), Swift Wick
  (fire rate), Twin Flame (+shot per volley), Long Stride (speed), Stout Lantern
  (max HP + heal), Piercing Light, Quick Dash, Wide Net (magnet range).
- **Combo multiplier** — kills in quick succession raise the score multiplier up to x8.
- **Pickups** — Embers (+25 score, magnetised toward you), Hearts (+25 HP),
  Starflame (8 s of +2 shots and +50% damage).
- **Win / lose** — fell the Gloomwarden to win; the game ends when your HP reaches 0.
  Both end screens show score, best score, kills, accuracy and time, with restart.
- **Feel** — particles, screen shake, hit flash, dash trail, floating score text,
  wave banners, boss health bar, and fully synthesised WebAudio sound (shots, hits,
  pickups, waves, boss, victory/defeat) plus a quiet music loop. No audio files.
- **Best score** is kept in `localStorage`.

## Run it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Open `game/index.html` from any static server; the game loads nothing over the
network and plays offline. Node 22+ is needed for `main.ts`.

## Screenshots

The game stages its own screenshot scenes deterministically from `?shot=<scene>&seed=1`
(see `game/src/shots.js`): `start`, `play`, `victory`, `over`. The four files in
`screenshots/` were rendered from those scenes in a headless browser.

## Files

- `game/index.html` — page, canvas, status line
- `game/src/config.js` — tuning numbers, waves, palette
- `game/src/random.js` — seeded RNG (mulberry32)
- `game/src/audio.js` — synthesised WebAudio effects and music
- `game/src/input.js` — keyboard + pointer input
- `game/src/world.js` — rules: entities, waves, boss, pickups, upgrades, combo
- `game/src/render.js` — all drawing: field, HUD, cards, panels
- `game/src/shots.js` — deterministic screenshot scenes + autopilot
- `game/src/main.js` — boot, fixed-step loop, screens
- `main.ts` — entrypoint: copies `game/` + `screenshots/` to `/output`, writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT — see `LICENSE`.
