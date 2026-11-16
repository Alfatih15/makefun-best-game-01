// All sound is synthesised with WebAudio: short oscillator blips and filtered noise, no
// audio files. The audio context is created on the first user gesture (browsers require
// that), and every effect is a fire-and-forget call so the game never waits on sound.

export function createAudio() {
  let context = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  /** A quiet four-note loop that drifts under play; started once, on the first gesture. */
  const MUSIC_NOTES = [220, 261.63, 329.63, 392, 329.63, 261.63, 196, 246.94];

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(frequency, duration, type, volume, slideTo) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null || ctx.state === 'suspended') return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration + 0.02);
  }

  function noise(duration, volume, frequency) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null || ctx.state === 'suspended') return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  }

  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const note = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      musicStep += 1;
      tone(note, 0.5, 'sine', 0.035);
      if (musicStep % 4 === 1) tone(note / 2, 0.9, 'triangle', 0.03);
    }, 420);
  }

  return {
    unlock() {
      const ctx = ensure();
      if (ctx !== null && ctx.state === 'suspended') ctx.resume().catch(() => {});
      startMusic();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(720, 0.07, 'square', 0.045, 380);
    },
    hit() {
      noise(0.08, 0.08, 2400);
    },
    hurt() {
      tone(160, 0.25, 'sawtooth', 0.12, 60);
      noise(0.15, 0.1, 900);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.07, 1320);
    },
    heal() {
      tone(523, 0.12, 'sine', 0.08, 784);
      tone(784, 0.16, 'sine', 0.06, 1046);
    },
    dash() {
      noise(0.12, 0.06, 3200);
    },
    wave() {
      tone(330, 0.14, 'triangle', 0.09, 495);
      tone(495, 0.2, 'triangle', 0.08, 660);
    },
    boss() {
      tone(98, 0.6, 'sawtooth', 0.12, 49);
      noise(0.4, 0.08, 500);
    },
    upgrade() {
      tone(523, 0.1, 'triangle', 0.09);
      tone(659, 0.1, 'triangle', 0.09);
      tone(784, 0.22, 'triangle', 0.09);
    },
    victory() {
      [523, 659, 784, 1046].forEach((note, i) => {
        window.setTimeout(() => tone(note, 0.3, 'triangle', 0.1), i * 130);
      });
    },
    defeat() {
      [392, 330, 262, 196].forEach((note, i) => {
        window.setTimeout(() => tone(note, 0.35, 'sawtooth', 0.07), i * 160);
      });
    },
  };
}
