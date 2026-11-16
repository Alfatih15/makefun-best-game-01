// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Every shade has its own shape and colour so the field reads at a glance; the
// HUD, wave banner, boss bar, upgrade cards and end panels are all drawn here, so a
// screenshot of any screen shows the whole loop. Text that holds a number is rebuilt
// only when the number changes, so a frame allocates nothing.

import { FIELD, FINAL_WAVE, FONT, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const PANEL = { width: 640, top: 150, line: 34, bottom: 78 };
const CARD = { width: 300, height: 190, gap: 24, top: 250 };
const LIFE_BAR = { width: 220, height: 16 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

/** The three upgrade cards' rectangles in playfield coordinates, shared with input. */
export function cardRect(index) {
  const total = CARD.width * 3 + CARD.gap * 2;
  const x = (FIELD.width - total) / 2 + index * (CARD.width + CARD.gap);
  return { x, y: CARD.top, width: CARD.width, height: CARD.height };
}

const ENEMY_COLORS = { drifter: PALETTE.drifter, wisp: PALETTE.wisp, spitter: PALETTE.spitter, brute: PALETTE.brute, warden: PALETTE.warden };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const waveLabel = cachedLabel('Wave ');
  const bestLabel = cachedLabel('Best ');
  const finalLabel = cachedLabel('Score ');
  const killsLabel = cachedLabel('Shades felled ');
  const embersLabel = cachedLabel('Embers ');
  const accuracyLabel = cachedLabel('Accuracy ');
  const timeLabel = cachedLabel('Time ');

  // A fixed starfield, so the backdrop is identical every load.
  const stars = [];
  let starSeed = 1234567;
  for (let i = 0; i < 110; i += 1) {
    starSeed = (Math.imul(starSeed, 1103515245) + 12345) | 0;
    const r1 = ((starSeed >>> 0) % 10000) / 10000;
    starSeed = (Math.imul(starSeed, 1103515245) + 12345) | 0;
    const r2 = ((starSeed >>> 0) % 10000) / 10000;
    starSeed = (Math.imul(starSeed, 1103515245) + 12345) | 0;
    const r3 = ((starSeed >>> 0) % 10000) / 10000;
    stars.push({ x: r1 * FIELD.width, y: r2 * FIELD.height, size: 0.6 + r3 * 1.6, twinkle: r3 * Math.PI * 2 });
  }

  let lastWave = 0;
  let waveBannerUntil = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawBackground(elapsed) {
    context.fillStyle = PALETTE.field;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();
    for (const star of stars) {
      const alpha = 0.35 + 0.35 * Math.sin(elapsed * 1.5 + star.twinkle);
      context.globalAlpha = Math.max(0.1, alpha);
      context.fillStyle = '#cdd6ff';
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;
    // Warm glow where the keep stands: the centre of the field.
    const glow = context.createRadialGradient(640, 360, 40, 640, 360, 420);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.07)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawEnemy(e, elapsed) {
    const color = ENEMY_COLORS[e.kind] || '#fff';
    context.save();
    context.translate(e.x, e.y);
    if (e.flash > 0) context.fillStyle = '#ffffff';
    else context.fillStyle = color;
    context.strokeStyle = color;
    context.lineWidth = 2;
    if (e.kind === 'drifter') {
      context.beginPath();
      context.moveTo(0, -e.radius);
      context.lineTo(e.radius, 0);
      context.lineTo(0, e.radius);
      context.lineTo(-e.radius, 0);
      context.closePath();
      context.fill();
      context.fillStyle = '#12162b';
      context.beginPath();
      context.arc(0, 0, e.radius * 0.32, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 'wisp') {
      context.globalAlpha = 0.85;
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(-4, -3, 2.4, 0, Math.PI * 2);
      context.arc(4, -3, 2.4, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 'spitter') {
      context.beginPath();
      context.moveTo(0, -e.radius);
      context.lineTo(e.radius * 0.95, e.radius * 0.8);
      context.lineTo(-e.radius * 0.95, e.radius * 0.8);
      context.closePath();
      context.fill();
      context.fillStyle = '#12162b';
      context.beginPath();
      context.arc(0, 2, e.radius * 0.3, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 'brute') {
      context.fillRect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
      context.strokeStyle = '#ff8a8a';
      context.strokeRect(-e.radius + 5, -e.radius + 5, e.radius * 2 - 10, e.radius * 2 - 10);
      context.fillStyle = '#12162b';
      context.fillRect(-9, -5, 6, 6);
      context.fillRect(3, -5, 6, 6);
    } else {
      // The Gloomwarden: a big hex crown with a pulsing core.
      const pulse = 1 + 0.06 * Math.sin(elapsed * 4);
      context.scale(pulse, pulse);
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.strokeStyle = '#ffffff';
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = '#12162b';
      context.beginPath();
      context.arc(0, 0, e.radius * 0.34, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(0, 0, e.radius * 0.16, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (e.maxHp > 60 && e.kind !== 'warden') {
      const w = e.radius * 2;
      context.fillStyle = '#0b0e1a';
      context.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
      context.fillStyle = PALETTE.danger;
      context.fillRect(e.x - w / 2, e.y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0;
    context.save();
    context.translate(p.x, p.y);
    if (p.dashTime > 0) context.globalAlpha = 0.6;
    else if (blink) context.globalAlpha = 0.35;
    const glow = context.createRadialGradient(0, 0, 4, 0, 0, 54);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.55)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, 54, 0, Math.PI * 2);
    context.fill();
    // Lantern body.
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(0, 0, p.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.arc(0, 0, p.radius * 0.55, 0, Math.PI * 2);
    context.fill();
    // Aim tick.
    context.rotate(p.aimAngle);
    context.fillStyle = PALETTE.playerRing;
    context.fillRect(p.radius + 2, -3, 14, 6);
    context.restore();
    if (p.starTime > 0) {
      context.strokeStyle = PALETTE.star;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(p.x, p.y, p.radius + 8 + 2 * Math.sin(state.elapsed * 6), 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawField(state) {
    drawBackground(state.elapsed);
    for (const p of state.pickups) {
      if (!p.active) continue;
      if (p.kind === 'ember') {
        context.fillStyle = PALETTE.ember;
        context.beginPath();
        context.arc(p.x, p.y, 8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#fff3c4';
        context.beginPath();
        context.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        context.fill();
      } else if (p.kind === 'heart') {
        context.fillStyle = PALETTE.heart;
        context.beginPath();
        context.arc(p.x - 4, p.y - 2, 6, 0, Math.PI * 2);
        context.arc(p.x + 4, p.y - 2, 6, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(p.x - 9, p.y + 1);
        context.lineTo(p.x + 9, p.y + 1);
        context.lineTo(p.x, p.y + 11);
        context.closePath();
        context.fill();
      } else {
        context.fillStyle = PALETTE.star;
        context.beginPath();
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const a2 = a + Math.PI / 5;
          context.lineTo(p.x + Math.cos(a) * 11, p.y + Math.sin(a) * 11);
          context.lineTo(p.x + Math.cos(a2) * 5, p.y + Math.sin(a2) * 5);
        }
        context.closePath();
        context.fill();
      }
    }
    for (const e of state.enemies) if (e.active) drawEnemy(e, state.elapsed);
    for (const b of state.enemyBullets) {
      if (!b.active) continue;
      context.fillStyle = PALETTE.enemyBullet;
      context.beginPath();
      context.arc(b.x, b.y, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd6e0';
      context.beginPath();
      context.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.fillStyle = PALETTE.bullet;
      context.beginPath();
      context.arc(b.x, b.y, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
    drawPlayer(state);
    for (const f of state.floaters) {
      if (!f.active) continue;
      context.globalAlpha = Math.max(0, Math.min(1, f.life * 2));
      text(f.text, f.x, f.y, 18, f.color, 'center');
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, muted) {
    const p = state.player;
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 16, 26, PALETTE.text, 'left');
    text(waveLabel(state.wave), FIELD.width / 2, 16, 26, PALETTE.text, 'center');
    // Health bar, top right.
    const barX = FIELD.width - 24 - LIFE_BAR.width;
    text('HP', barX - 10, 16, 22, PALETTE.text, 'right');
    context.fillStyle = '#0b0e1a';
    context.fillRect(barX, 20, LIFE_BAR.width, LIFE_BAR.height);
    context.fillStyle = p.hp > 30 ? PALETTE.star : PALETTE.danger;
    context.fillRect(barX, 20, LIFE_BAR.width * Math.max(0, p.hp / p.maxHp), LIFE_BAR.height);
    context.strokeStyle = PALETTE.panelEdge;
    context.strokeRect(barX, 20, LIFE_BAR.width, LIFE_BAR.height);
    text(`${Math.ceil(p.hp)} / ${p.maxHp}`, barX + LIFE_BAR.width / 2, 44, 15, PALETTE.muted, 'center');
    // Dash cooldown, bottom left; combo, bottom right.
    text('DASH', 24, FIELD.height - 52, 16, PALETTE.muted, 'left');
    context.fillStyle = '#0b0e1a';
    context.fillRect(24, FIELD.height - 30, 140, 10);
    context.fillStyle = p.dashCooldown <= 0 ? PALETTE.wisp : PALETTE.panelEdge;
    context.fillRect(24, FIELD.height - 30, 140 * (1 - Math.max(0, p.dashCooldown) / p.dashCooldownMax), 10);
    text(p.dashCooldown <= 0 ? 'READY  [Space]' : 'charging…', 172, FIELD.height - 34, 15, PALETTE.muted, 'left');
    if (state.combo >= 2) {
      text(`COMBO x${state.combo}`, FIELD.width - 24, FIELD.height - 52, 22, PALETTE.gold, 'right');
      context.fillStyle = '#0b0e1a';
      context.fillRect(FIELD.width - 164, FIELD.height - 26, 140, 6);
      context.fillStyle = PALETTE.gold;
      context.fillRect(FIELD.width - 164, FIELD.height - 26, 140 * Math.max(0, state.comboTimer / 4), 6);
    }
    if (p.starTime > 0) text(`STARFLAME ${Math.ceil(p.starTime)}s`, FIELD.width / 2, FIELD.height - 52, 20, PALETTE.star, 'center');
    if (muted) text('MUTED [M]', 24, 52, 15, PALETTE.muted, 'left');
    // Boss bar.
    if (state.boss !== null && state.boss.active) {
      const boss = state.boss;
      const w = 520;
      const x = (FIELD.width - w) / 2;
      text('THE GLOOMWARDEN', FIELD.width / 2, 52, 20, PALETTE.warden, 'center');
      context.fillStyle = '#0b0e1a';
      context.fillRect(x, 78, w, 12);
      context.fillStyle = PALETTE.warden;
      context.fillRect(x, 78, w * Math.max(0, boss.hp / boss.maxHp), 12);
      context.strokeStyle = PALETTE.panelEdge;
      context.strokeRect(x, 78, w, 12);
    }
    // Wave banner for two seconds after a wave starts.
    if (state.wave !== lastWave) {
      lastWave = state.wave;
      waveBannerUntil = state.elapsed + 2;
    }
    if (state.wave > 0 && state.elapsed < waveBannerUntil && state.waveState === 'fighting') {
      const label = state.wave === FINAL_WAVE ? `WAVE ${state.wave} — THE GLOOMWARDEN` : `WAVE ${state.wave}`;
      context.globalAlpha = Math.min(1, (waveBannerUntil - state.elapsed) * 2);
      text(label, FIELD.width / 2, 150, 44, PALETTE.text, 'center');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(5, 7, 16, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 23, PALETTE.gold, 'center');
  }

  function drawUpgradeCards(state) {
    context.fillStyle = 'rgba(5, 7, 16, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textBaseline = 'alphabetic';
    text(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, 130, 44, PALETTE.text, 'center');
    text('Choose a blessing — click a card or press 1, 2 or 3', FIELD.width / 2, 180, 22, PALETTE.muted, 'center');
    text(scoreLabel(state.score), FIELD.width / 2, 212, 22, PALETTE.gold, 'center');
    for (let i = 0; i < state.offers.length; i += 1) {
      const offer = state.offers[i];
      const rect = cardRect(i);
      context.fillStyle = PALETTE.panel;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
      text(`[${i + 1}]`, rect.x + rect.width / 2, rect.y + 44, 20, PALETTE.muted, 'center');
      text(offer.name, rect.x + rect.width / 2, rect.y + 88, 26, PALETTE.text, 'center');
      text(offer.desc, rect.x + rect.width / 2, rect.y + 128, 19, PALETTE.gold, 'center');
      text('a lantern blessing', rect.x + rect.width / 2, rect.y + 158, 16, PALETTE.muted, 'center');
    }
  }

  const TITLE_LINES = [
    'The shades are coming for the last lantern. Hold the keep.',
    'Move WASD / arrows · Aim mouse · Hold click to shoot · Space to dash',
    'Clear 10 waves, fell the Gloomwarden, and keep the light alive.',
    '',
  ];
  const PAUSED_LINES = ['The shades wait in the dark.'];
  const OVER_LINES = ['', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[3] = best > 0 ? bestLabel(best) : 'No keeper has scored yet — be the first.';
      drawPanel('EMBERFALL KEEP', TITLE_LINES, 'Press Space or click to light the lantern');
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_UPGRADE) drawUpgradeCards(state);
    else if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to return to the fight');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      OVER_LINES[2] = `Reached wave ${state.wave} · ${killsLabel(state.kills)}`;
      drawPanel('THE LIGHT GOES OUT', OVER_LINES, 'Press Space or click to try again');
    } else if (screen === SCREEN_VICTORY) {
      const accuracy = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
      const lines = [
        finalLabel(state.score),
        bestLabel(best),
        `${killsLabel(state.kills)} · ${embersLabel(state.embers)}`,
        `${accuracyLabel(accuracy)}% · ${timeLabel(Math.round(state.elapsed))}s · ${state.upgradesTaken} blessings`,
      ];
      const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
      const x = (FIELD.width - PANEL.width) / 2;
      const y = (FIELD.height - height) / 2;
      context.fillStyle = 'rgba(5, 7, 16, 0.72)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.fillStyle = PALETTE.panel;
      context.fillRect(x, y, PANEL.width, height);
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      context.strokeRect(x, y, PANEL.width, height);
      context.textBaseline = 'alphabetic';
      text('THE KEEP STANDS!', FIELD.width / 2, y + 78, 46, PALETTE.gold, 'center');
      for (let i = 0; i < lines.length; i += 1) {
        text(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 21, PALETTE.muted, 'center');
      }
      text('Press Space or click to play again', FIELD.width / 2, y + height - 36, 23, PALETTE.gold, 'center');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    toField(clientX, clientY) {
      return {
        x: (clientX * (window.devicePixelRatio || 1) - view.x) / view.scale,
        y: (clientY * (window.devicePixelRatio || 1) - view.y) / view.scale,
      };
    },
  };
}
