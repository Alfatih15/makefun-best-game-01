// The screenshot scenes behind ?shot=start|play|victory|over. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (keep moving, aim at the nearest shade, shoot it, dash when one gets close),
// so the frame is what a short game really looks like and the same seed always gives
// the same frame. The victory scene plays the same pilot with a head start — wave 10,
// full blessings — then fells the Warden; the over scene's pilot never shoots, so it is
// caught out as a hurried player is.

import { FIELD, FINAL_WAVE, STEP } from './config.js';
import { EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const OVER_LIMIT_SECONDS = 300;
const VICTORY_LIMIT_SECONDS = 300;

function nearestEnemy(state) {
  const p = state.player;
  let best = null;
  let bestDist = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return { enemy: best, dist: bestDist };
}

/** Steer toward the centre when safe, away from the nearest shade when it closes in. */
function autopilot(state, firing, reckless) {
  const p = state.player;
  const { enemy, dist } = nearestEnemy(state);
  let moveX = 0;
  let moveY = 0;
  let aimX = p.x;
  let aimY = p.y - 100;
  let dash = false;
  if (enemy !== null) {
    aimX = enemy.x;
    aimY = enemy.y;
    if (reckless) {
      // Plants its feet and shoots: fine while the shades come one way, fatal once
      // they close in from every side.
      return { moveX: 0, moveY: 0, aimX, aimY, firing, dash: false };
    }
    if (dist < 130) {
      // Run from the nearest shade.
      moveX = (p.x - enemy.x) / dist;
      moveY = (p.y - enemy.y) / dist;
      dash = dist < 80;
    } else if (dist > 320) {
      // Close in to shoot accurately.
      moveX = (enemy.x - p.x) / dist;
      moveY = (enemy.y - p.y) / dist;
    }
  }
  if (moveX === 0 && moveY === 0) {
    // Drift back toward the middle of the keep.
    const dx = FIELD.width / 2 - p.x;
    const dy = FIELD.height / 2 - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 60) {
      moveX = dx / d;
      moveY = dy / d;
    }
  }
  return { moveX, moveY, aimX, aimY, firing, dash };
}

function playWaves(world, seconds, firing, takeUpgrades, reckless) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, autopilot(world.state, firing, reckless), false);
    if (events & EVENT_OVER) return 'over';
    if (events & EVENT_WIN) return 'win';
    if (events & EVENT_WAVE_CLEAR && takeUpgrades) {
      // Take the first blessing and start the next wave, as a player would.
      world.chooseUpgrade(0);
      const next = world.state.wave + 1;
      if (next <= FINAL_WAVE) world.startWave(next);
    }
  }
  return 'playing';
}

/**
 * Set `world` to the named scene (start, play, victory or over; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'victory' && name !== 'over') {
    world.startWave(1);
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 640, aimY: 200, firing: false, dash: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 1250 };
  }
  if (name === 'over') {
    // The pilot shoots but never moves: it scores, then the shades close in from
    // every side and the light goes out.
    for (let wave = 1; wave <= FINAL_WAVE; wave += 1) {
      world.startWave(wave);
      const result = playWaves(world, OVER_LIMIT_SECONDS, true, false, true);
      if (result === 'over') break;
      if (world.state.waveState !== 'clear') break;
    }
    return { screen: SCREEN_OVER, best: Math.max(world.state.score, 1250) };
  }
  if (name === 'victory') {
    // A keeper who has fought through nine waves: maxed blessings, then the Warden.
    world.startWave(FINAL_WAVE);
    const p = world.state.player;
    p.damage = 40;
    p.spread = 3;
    p.pierce = 2;
    p.fireInterval = 0.14;
    p.hp = p.maxHp;
    world.state.score = 8450;
    world.state.kills = 212;
    world.state.embers = 96;
    world.state.upgradesTaken = 9;
    // The staged scene stands for a whole run, not just the final wave: show a
    // full run's time on the victory screen.
    const runElapsed = 372;
    const result = playWaves(world, VICTORY_LIMIT_SECONDS, true, false);
    if (result !== 'win') {
      // The pilot stalled: fell the Warden outright so the victory screen is the real one.
      const boss = world.state.boss;
      if (boss !== null && boss.active) {
        boss.hp = 1;
        for (let i = 0; i < 240 && world.state.waveState !== 'won'; i += 1) {
          world.step(STEP, { moveX: 0, moveY: 0, aimX: boss.x, aimY: boss.y, firing: true, dash: false }, false);
        }
      }
    }
    world.state.elapsed = runElapsed + world.state.elapsed;
    return { screen: SCREEN_VICTORY, best: Math.max(world.state.score, 1250) };
  }
  // Play: wave 1 into wave 2, pilot shooting, mid-fight with HUD, combo and embers.
  // Step in one-second chunks and stop once a later wave is thick with shades, so
  // the frame is busy rather than caught between waves.
  world.startWave(1);
  for (let second = 0; second < 60; second += 1) {
    const result = playWaves(world, 1, true, true);
    if (result !== 'playing') break;
    const busy = world.state.enemies.filter((e) => e.active).length;
    if (world.state.wave >= 2 && busy >= 8) break;
  }
  return { screen: SCREEN_PLAY, best: Math.max(world.state.score, 1250) };
}
