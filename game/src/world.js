// The game's rules and state, with no drawing and no browser in it: the lantern-keeper,
// the shades that hunt them, waves, the Gloomwarden boss, pickups, upgrades, combo and
// score. step() advances one fixed step and returns what happened as bit flags, so the
// caller can react (sound, screens) without the world knowing about them. Pools are
// allocated once, at boot; nothing here allocates after createWorld returns, except the
// short spawn queue rebuilt once per wave.

import { COMBO, ENEMY, FIELD, FINAL_WAVE, PICKUP, PLAYER, POOLS, WAVE_TABLE } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_HEAL = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_BOSS = 64;
export const EVENT_SHOOT = 128;

export const UPGRADE_POOL = [
  { id: 'ember-rounds', name: 'Ember Rounds', desc: '+4 lantern damage', apply: (p) => { p.damage += 4; } },
  { id: 'swift-wick', name: 'Swift Wick', desc: '+18% fire rate', apply: (p) => { p.fireInterval *= 0.85; } },
  { id: 'twin-flame', name: 'Twin Flame', desc: '+1 shot in every volley', apply: (p) => { p.spread += 1; } },
  { id: 'long-stride', name: 'Long Stride', desc: '+12% move speed', apply: (p) => { p.speed *= 1.12; } },
  { id: 'stout-lantern', name: 'Stout Lantern', desc: '+25 max health, heal 25', apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'piercing-light', name: 'Piercing Light', desc: 'Shots pierce +1 shade', apply: (p) => { p.pierce += 1; } },
  { id: 'quick-dash', name: 'Quick Dash', desc: 'Dash recharges 35% faster', apply: (p) => { p.dashCooldownMax *= 0.65; } },
  { id: 'wide-net', name: 'Wide Net', desc: '+60 ember magnet range', apply: (p) => { p.pickupRadius += 60; } },
];

function overlapsCircle(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

function makePool(size, make) {
  const pool = [];
  for (let i = 0; i < size; i += 1) pool.push(make());
  return pool;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, radius: PLAYER.radius,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval, damage: PLAYER.bulletDamage,
    spread: 1, pierce: 0, pickupRadius: PLAYER.pickupRadius,
    dashCooldownMax: PLAYER.dashCooldown, dashCooldown: 0, dashTime: 0,
    dashX: 0, dashY: 0, invulnerable: 0, fireTimer: 0, aimAngle: -Math.PI / 2,
    starTime: 0, moving: false,
  };
  const enemies = makePool(POOLS.enemies, () => ({ active: false, kind: 'drifter', x: 0, y: 0, hp: 0, maxHp: 0, speed: 0, radius: 0, damage: 0, score: 0, ember: 0, shootTimer: 0, burstTimer: 0, spawnTimer: 0, wobble: 0, flash: 0 }));
  const bullets = makePool(POOLS.bullets, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 0, pierce: 0, life: 0 }));
  const enemyBullets = makePool(POOLS.enemyBullets, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 0, life: 0 }));
  const particles = makePool(POOLS.particles, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#fff' }));
  const pickups = makePool(POOLS.pickups, () => ({ active: false, kind: 'ember', x: 0, y: 0, vx: 0, vy: 0, life: 0 }));
  const floaters = makePool(POOLS.floaters, () => ({ active: false, x: 0, y: 0, text: '', life: 0, color: '#fff' }));

  const state = {
    player, enemies, bullets, enemyBullets, particles, pickups, floaters,
    score: 0, best: 0, kills: 0, embers: 0, combo: 0, comboTimer: 0,
    wave: 0, waveState: 'idle', spawnQueue: [], spawnTimer: 0,
    offers: [], upgradesTaken: 0, elapsed: 0, shotsFired: 0, shotsHit: 0,
    shake: 0, boss: null, won: false,
  };

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * v; p.vy = Math.sin(angle) * v;
      p.maxLife = 0.35 + random() * 0.4;
      p.life = p.maxLife;
      p.size = 2 + random() * 4;
      p.color = color;
    }
  }

  function floater(x, y, text, color) {
    const f = free(floaters);
    if (f === null) return;
    f.active = true;
    f.x = x; f.y = y; f.text = text; f.life = 0.9; f.color = color;
  }

  function dropPickup(x, y, kind) {
    const p = free(pickups);
    if (p === null) return;
    p.active = true;
    p.kind = kind;
    p.x = x; p.y = y;
    const angle = random() * Math.PI * 2;
    p.vx = Math.cos(angle) * 40;
    p.vy = Math.sin(angle) * 40;
    p.life = 12;
  }

  function spawnEnemy(kind) {
    const e = free(enemies);
    if (e === null) return null;
    const def = ENEMY[kind];
    // Spawn at a field edge, away from the player.
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = Math.floor(random() * 4);
      if (edge === 0) { x = random() * FIELD.width; y = -30; }
      else if (edge === 1) { x = random() * FIELD.width; y = FIELD.height + 30; }
      else if (edge === 2) { x = -30; y = random() * FIELD.height; }
      else { x = FIELD.width + 30; y = random() * FIELD.height; }
      if (Math.hypot(x - player.x, y - player.y) > 260) break;
    }
    const hpScale = 1 + (state.wave - 1) * 0.12;
    e.active = true;
    e.kind = kind;
    e.x = x; e.y = y;
    e.maxHp = Math.round(def.hp * hpScale);
    e.hp = e.maxHp;
    e.speed = def.speed * (1 + (state.wave - 1) * 0.02);
    e.radius = def.radius;
    e.damage = def.damage;
    e.score = def.score;
    e.ember = def.ember;
    e.shootTimer = 1 + random() * 1.5;
    e.burstTimer = 2.5;
    e.spawnTimer = 7;
    e.wobble = random() * Math.PI * 2;
    e.flash = 0;
    if (kind === 'warden') state.boss = e;
    return e;
  }

  function buildQueue(wave) {
    const table = WAVE_TABLE[wave - 1];
    const queue = [];
    for (const kind of Object.keys(table)) {
      for (let i = 0; i < table[kind]; i += 1) queue.push(kind);
    }
    // Fisher-Yates shuffle with the seeded random.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = queue[i];
      queue[i] = queue[j];
      queue[j] = tmp;
    }
    return queue;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = buildQueue(wave);
    state.spawnTimer = 0.4;
    state.waveState = 'fighting';
    if (wave === FINAL_WAVE) return EVENT_BOSS;
    return 0;
  }

  function rollOffers() {
    const ids = UPGRADE_POOL.map((u) => u.id);
    const offers = [];
    while (offers.length < 3 && ids.length > 0) {
      const index = Math.floor(random() * ids.length);
      offers.push(UPGRADE_POOL.find((u) => u.id === ids[index]));
      ids.splice(index, 1);
    }
    state.offers = offers;
  }

  function chooseUpgrade(index) {
    const upgrade = state.offers[index];
    if (!upgrade) return false;
    upgrade.apply(player);
    state.upgradesTaken += 1;
    state.offers = [];
    floater(player.x, player.y - 30, upgrade.name, '#9dff57');
    return true;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.hp = PLAYER.maxHp;
    player.maxHp = PLAYER.maxHp;
    player.speed = PLAYER.speed;
    player.fireInterval = PLAYER.fireInterval;
    player.damage = PLAYER.bulletDamage;
    player.spread = 1;
    player.pierce = 0;
    player.pickupRadius = PLAYER.pickupRadius;
    player.dashCooldownMax = PLAYER.dashCooldown;
    player.dashCooldown = 0;
    player.dashTime = 0;
    player.invulnerable = 0;
    player.fireTimer = 0;
    player.starTime = 0;
    for (const pool of [enemies, bullets, enemyBullets, particles, pickups, floaters]) {
      for (const item of pool) item.active = false;
    }
    state.score = 0;
    state.kills = 0;
    state.embers = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.wave = 0;
    state.waveState = 'idle';
    state.spawnQueue = [];
    state.offers = [];
    state.upgradesTaken = 0;
    state.elapsed = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.shake = 0;
    state.boss = null;
    state.won = false;
  }

  function killEnemy(e) {
    e.active = false;
    if (state.boss === e) state.boss = null;
    state.kills += 1;
    state.combo = Math.min(COMBO.cap, state.combo + 1);
    state.comboTimer = COMBO.window;
    const multiplier = 1 + (state.combo - 1) * 0.25;
    const gained = Math.round(e.score * multiplier);
    state.score += gained;
    floater(e.x, e.y, `+${gained}`, '#ffd166');
    burst(e.x, e.y, '#b388ff', e.kind === 'warden' ? 40 : 12, e.kind === 'warden' ? 260 : 160);
    for (let i = 0; i < e.ember; i += 1) dropPickup(e.x + (random() - 0.5) * 30, e.y + (random() - 0.5) * 30, 'ember');
    if (random() < 0.08) dropPickup(e.x, e.y, 'heart');
    if (random() < 0.05) dropPickup(e.x, e.y, 'star');
    if (e.kind === 'warden') {
      state.won = true;
      state.waveState = 'won';
    }
  }

  function hurtPlayer(damage) {
    if (player.invulnerable > 0 || player.dashTime > 0) return 0;
    player.hp -= damage;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = Math.max(state.shake, 10);
    state.combo = 0;
    state.comboTimer = 0;
    burst(player.x, player.y, '#ff5d5d', 14, 200);
    if (player.hp <= 0) {
      player.hp = 0;
      state.waveState = 'over';
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function fireBullet(angle) {
    const b = free(bullets);
    if (b === null) return;
    b.active = true;
    b.x = player.x + Math.cos(angle) * (player.radius + 6);
    b.y = player.y + Math.sin(angle) * (player.radius + 6);
    b.vx = Math.cos(angle) * PLAYER.bulletSpeed;
    b.vy = Math.sin(angle) * PLAYER.bulletSpeed;
    b.damage = player.damage * (player.starTime > 0 ? 1.5 : 1);
    b.pierce = player.pierce;
    b.life = 1.1;
    state.shotsFired += 1;
  }

  function fireEnemyBullet(x, y, angle, speed, damage) {
    const b = free(enemyBullets);
    if (b === null) return;
    b.active = true;
    b.x = x; b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.damage = damage;
    b.life = 4;
  }

  /**
   * One fixed step. `input` is {moveX, moveY, aimX, aimY, firing, dash}. With
   * `harmless` set (the title screen's backdrop) shades drift but never shoot, touch or
   * score, so the title can play behind the menu.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (player.starTime > 0) player.starTime -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;

    // Movement and dash.
    player.moving = input.moveX !== 0 || input.moveY !== 0;
    if (input.dash && player.dashCooldown <= 0 && player.dashTime <= 0 && player.moving) {
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = player.dashCooldownMax;
      const length = Math.hypot(input.moveX, input.moveY) || 1;
      player.dashX = input.moveX / length;
      player.dashY = input.moveY / length;
      burst(player.x, player.y, '#7ee8fa', 8, 120);
    }
    const speed = player.dashTime > 0 ? PLAYER.dashSpeed : player.speed;
    const dirX = player.dashTime > 0 ? player.dashX : input.moveX;
    const dirY = player.dashTime > 0 ? player.dashY : input.moveY;
    if (player.dashTime > 0) player.dashTime -= dt;
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + dirX * speed * dt));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + dirY * speed * dt));

    // Aim and fire.
    player.aimAngle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
    player.fireTimer -= dt;
    if (input.firing && player.fireTimer <= 0 && !harmless) {
      const shots = player.spread + (player.starTime > 0 ? 2 : 0);
      const spreadAngle = 0.14;
      for (let i = 0; i < shots; i += 1) {
        const offset = (i - (shots - 1) / 2) * spreadAngle;
        fireBullet(player.aimAngle + offset);
      }
      player.fireTimer = player.fireInterval * (player.starTime > 0 ? 0.8 : 1);
      events |= EVENT_SHOOT;
    }

    // Spawning.
    if (state.waveState === 'fighting' && state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const kind = state.spawnQueue.shift();
        const spawned = spawnEnemy(kind);
        if (spawned !== null && kind === 'warden') events |= EVENT_BOSS;
        state.spawnTimer = 0.45;
      }
    }

    // Enemies: move, wobble, shoot, touch.
    for (const e of enemies) {
      if (!e.active) continue;
      if (e.flash > 0) e.flash -= dt;
      const targetX = harmless ? FIELD.width / 2 + Math.cos(e.wobble) * 260 : player.x;
      const targetY = harmless ? FIELD.height / 2 + Math.sin(e.wobble * 1.3) * 170 : player.y;
      const dx = targetX - e.x;
      const dy = targetY - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      if (e.kind === 'wisp') {
        e.wobble += dt * 5;
        const px = -ny * Math.sin(e.wobble) * 0.7;
        const py = nx * Math.sin(e.wobble) * 0.7;
        e.x += (nx + px) * e.speed * dt;
        e.y += (ny + py) * e.speed * dt;
      } else if (e.kind === 'spitter') {
        // Keep a ring around the player and strafe.
        const want = dist < 240 ? -1 : dist > 320 ? 1 : 0;
        e.x += nx * want * e.speed * dt - ny * 0.4 * e.speed * dt;
        e.y += ny * want * e.speed * dt + nx * 0.4 * e.speed * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && !harmless && dist < 560) {
          fireEnemyBullet(e.x, e.y, Math.atan2(dy, dx), 240, e.damage);
          e.shootTimer = 2.2;
        }
      } else if (e.kind === 'warden') {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
        e.burstTimer -= dt;
        if (e.burstTimer <= 0 && !harmless) {
          for (let i = 0; i < 10; i += 1) {
            fireEnemyBullet(e.x, e.y, (i / 10) * Math.PI * 2 + state.elapsed, 170, 12);
          }
          e.burstTimer = 3;
        }
        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0 && !harmless) {
          spawnEnemy('wisp');
          spawnEnemy('wisp');
          e.spawnTimer = 8;
        }
      } else {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
      }
      e.x = Math.min(FIELD.width + 60, Math.max(-60, e.x));
      e.y = Math.min(FIELD.height + 60, Math.max(-60, e.y));
      if (!harmless && overlapsCircle(e.x, e.y, e.radius, player.x, player.y, player.radius)) {
        events |= hurtPlayer(e.damage);
        if (e.kind !== 'warden' && e.kind !== 'brute') {
          e.active = false;
          burst(e.x, e.y, '#b388ff', 8, 140);
        }
        if (state.waveState === 'over') return events;
      }
    }

    // Player bullets.
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        if (!overlapsCircle(b.x, b.y, 5, e.x, e.y, e.radius)) continue;
        e.hp -= b.damage;
        e.flash = 0.08;
        state.shotsHit += 1;
        burst(b.x, b.y, '#ffe66d', 3, 90);
        if (e.hp <= 0) {
          killEnemy(e);
          if (state.won) events |= EVENT_WIN;
        }
        if (b.pierce > 0) b.pierce -= 1;
        else {
          b.active = false;
          break;
        }
      }
    }

    // Enemy bullets.
    for (const b of enemyBullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      if (!harmless && overlapsCircle(b.x, b.y, 6, player.x, player.y, player.radius)) {
        b.active = false;
        events |= hurtPlayer(b.damage);
        if (state.waveState === 'over') return events;
      }
    }

    // Pickups: drift, magnet, collect.
    for (const p of pickups) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < player.pickupRadius) {
        p.x += (dx / dist) * 260 * dt;
        p.y += (dy / dist) * 260 * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
      if (dist < player.radius + PICKUP.ember.radius + 6) {
        p.active = false;
        if (p.kind === 'ember') {
          state.embers += 1;
          state.score += PICKUP.ember.score;
          events |= EVENT_PICKUP;
        } else if (p.kind === 'heart') {
          player.hp = Math.min(player.maxHp, player.hp + PICKUP.heart.heal);
          events |= EVENT_HEAL;
          floater(player.x, player.y - 26, `+${PICKUP.heart.heal} HP`, '#ff5d8f');
        } else if (p.kind === 'star') {
          player.starTime = PICKUP.star.duration;
          events |= EVENT_PICKUP;
          floater(player.x, player.y - 26, 'STARFLAME!', '#9dff57');
        }
      }
    }

    // Particles and floaters fade.
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    for (const f of floaters) {
      if (!f.active) continue;
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) f.active = false;
    }

    // Wave clear: queue empty and no shade left standing.
    if (state.waveState === 'fighting' && state.spawnQueue.length === 0) {
      let anyAlive = false;
      for (const e of enemies) if (e.active) { anyAlive = true; break; }
      if (!anyAlive) {
        if (state.won) {
          events |= EVENT_WIN;
        } else {
          state.waveState = 'clear';
          rollOffers();
          events |= EVENT_WAVE_CLEAR;
        }
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, startWave, chooseUpgrade };
}
