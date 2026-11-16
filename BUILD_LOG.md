# BUILD_LOG — Emberfall Keep (best-game-01)

## What was built

An original top-down arena shooter, **Emberfall Keep**, at
`~/workspace/makefun/entries/best-game-01/`. The keeper of the last lantern holds
a keep against 10 waves of shades, ending with the Gloomwarden boss.

- **Loop:** title → play → upgrade choice between waves → victory (fell the
  Warden on wave 10) or game over → restart. Pause, best score in localStorage.
- **Depth:** 5 enemy kinds (Drifter, Wisp, Spitter, Brute, Gloomwarden boss with
  radial bursts + Wisp summons), 8 blessings to choose 1-of-3 between waves,
  combo multiplier up to x8, dash with i-frames + cooldown, 3 pickup kinds
  (Ember, Heart, Starflame), boss HP bar, wave banners, floating score text.
- **Feel:** particles, screen shake, hit flash, dash trail, fully synthesised
  WebAudio effects + music loop (no audio files), M to mute.
- **Structure (judge outline):** one job per file — `config.js` (tuning/waves/
  palette), `random.js` (seeded RNG), `audio.js` (synth sound), `input.js`
  (keyboard+pointer), `world.js` (rules: entities, waves, boss, upgrades,
  combo), `render.js` (all drawing: field, HUD, cards, panels), `shots.js`
  (deterministic screenshot scenes + autopilot), `main.js` (fixed 1/60 s loop,
  screens). No libraries, no network requests, stdlib-only `main.ts`.
- **Kit:** `vendor/makefun-game.ts` copied from the kit unchanged (sha256
  verified identical), `LICENSE` MIT, `README.md`, `shots.json`,
  `.makefun/owner.json` with wallet
  `Cfdgeggmd6ij5dLpqwmqAaGExTbi4JPZJYcRdi4iSjSW`.

## What was verified

- **Simulation tests (Node, no browser):** all four `?shot=` scenes stage
  correctly and deterministically — start (title, 6 shades drifting), play
  (wave 5, score 9022, 63 kills, combo x8, 8 enemies active), victory (wave 10
  won, score 14324, 225 kills), over (wave 5, score 5641, 62 kills, HP 0).
  Play scene run twice gives identical score/kills.
- **Real browser renders:** headless Chromium via playwright-core (installed
  with `npx playwright install chromium`, build 1187). All 4 screenshots are
  genuine renders of the game's own code (`?shot=…&seed=1`, waited for
  `window.__shotReady`), 1280x720 JPEG, 34–50 KiB each (limit 256 KiB), zero
  page errors. Each was visually inspected: title panel, busy play frame with
  HUD (score/wave/HP/dash/combo), victory panel with stats, game-over panel
  with stats + restart prompt.
- **Live playtest (scripted keyboard+mouse in the same browser):** Space
  starts the game, mouse aim + hold-click shoots, WASD moves, Space dashes,
  P pauses/resumes; the player took a hit (HP 90/100) with particles visible;
  no page errors.
- **main.ts:** `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` run twice —
  outputs byte-identical (`diff -r` clean). Output holds `dossier.json`
  (303,182 bytes), `game/` (9 files, 63,985 bytes) and all 4 screenshots.
  Final re-run after cleanup confirmed the same into `/tmp/out-final`.
- **Gate limits:** game/ 9 files / 64 KiB (limits 993 / 48 MiB); no network
  references in `game/` (grep for `http://`, `https://`, `//host` — none);
  dossier under 1.5 MiB.
- **Kit CLI check:** `node cli/makefun.mjs check --kit . --repo <entry>
  --worktree` → 4 passed (`competition_open`, `snapshot`, `license_osi`,
  `entrypoint`), 1 failed (`transcripts_present` — no transcripts supplied,
  expected, see below), 14 skipped, 5 deferred to submission (repo public /
  owner / created-after-open / commit / duplicate snapshot). Kit files
  verified (24 files).

## Still missing — NOT this task's job

- **GitHub repo:** entry dir is not a git repo yet; no repo created, nothing
  pushed. The `out/` build dirs were removed so the snapshot is clean
  (19 files).
- **Transcripts:** none bundled (this session's logs need bundling by the
  parent with the kit CLI); `transcripts_present` fails until then.
- **Submit:** not submitted. Deadline 2026-11-18T18:00:00Z per the CLI check.
- **Screenshots:** REAL renders (not placeholders) — see verification above.
  Retaken once after fixing the victory screen's time display (was "Time 8s"
  for a staged full run; now "Time 380s").

## Known limitations

- The staged victory scene represents a full run (score/kills/time preset
  before the final wave is played out by the autopilot); the victory panel
  itself is the game's real victory screen rendered by its own code.
- The play screenshot's "WAVE 5" banner is visible because the capture lands
  just after a wave starts; it reads as part of the game, not an artefact.
