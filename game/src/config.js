// Every tuning number and colour for Emberfall Keep, in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The last wave. Clearing it (by felling the Gloomwarden) wins the game. */
export const FINAL_WAVE = 10;

export const PLAYER = {
  radius: 16,
  speed: 300,
  maxHp: 100,
  fireInterval: 0.22,
  bulletSpeed: 640,
  bulletDamage: 12,
  dashSpeed: 820,
  dashTime: 0.16,
  dashCooldown: 1.6,
  invulnerable: 0.8,
  pickupRadius: 90,
};

export const ENEMY = {
  drifter: { hp: 22, speed: 95, radius: 16, damage: 10, score: 50, ember: 1 },
  wisp: { hp: 12, speed: 190, radius: 11, damage: 8, score: 70, ember: 1 },
  spitter: { hp: 30, speed: 70, radius: 17, damage: 8, score: 90, ember: 2 },
  brute: { hp: 90, speed: 52, radius: 26, damage: 18, score: 150, ember: 3 },
  warden: { hp: 620, speed: 46, radius: 46, damage: 22, score: 1500, ember: 12 },
};

/** Enemy kinds unlocked by wave, and how many of each a wave spawns (before scaling). */
export const WAVE_TABLE = [
  { drifter: 6 },
  { drifter: 8, wisp: 3 },
  { drifter: 8, wisp: 5, spitter: 2 },
  { drifter: 10, wisp: 6, spitter: 3 },
  { drifter: 10, wisp: 8, spitter: 4, brute: 2 },
  { drifter: 12, wisp: 8, spitter: 5, brute: 3 },
  { drifter: 12, wisp: 10, spitter: 6, brute: 4 },
  { drifter: 14, wisp: 12, spitter: 6, brute: 5 },
  { drifter: 14, wisp: 12, spitter: 8, brute: 6 },
  { drifter: 10, wisp: 10, spitter: 6, brute: 4, warden: 1 },
];

export const PICKUP = {
  ember: { score: 25, radius: 9 },
  heart: { heal: 25, radius: 11 },
  star: { radius: 11, duration: 8 },
};

export const COMBO = { window: 4, cap: 8 };

export const POOLS = { enemies: 96, bullets: 256, enemyBullets: 128, particles: 512, pickups: 64, floaters: 48 };

export const PALETTE = {
  backdrop: '#0b0e1a',
  field: '#12162b',
  fieldAlt: '#171c36',
  grid: '#1e2447',
  groundGlow: '#232a52',
  player: '#ffd166',
  playerCore: '#fff3c4',
  playerRing: '#ff9f43',
  bullet: '#ffe66d',
  drifter: '#b388ff',
  wisp: '#7ee8fa',
  spitter: '#ff6b9d',
  brute: '#ff5d5d',
  warden: '#c77dff',
  ember: '#ffb703',
  heart: '#ff5d8f',
  star: '#9dff57',
  enemyBullet: '#ff7b9c',
  panel: '#191e33',
  panelEdge: '#3a4370',
  text: '#f2f4ff',
  muted: '#9aa3c7',
  gold: '#ffd166',
  danger: '#ff5d5d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall-keep.best';
