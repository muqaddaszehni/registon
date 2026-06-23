import { cornerButton } from './ui/buttons';

// ─── Licensed track path (spec open item) ─────────────────────────────────────
// When a licensed track ships, replace the generative engine below with:
//   const TRACK_URL = '/music/ambient.ogg';
//   audio = new Audio(TRACK_URL); audio.loop = true; audio.volume = 0.35;
//   audio.play().catch(() => {});
// and suspend ctx / ramp master gain for toggle-off as today.
const TRACK_URL = ''; // empty = generative engine active

// ─── Musical constants ─────────────────────────────────────────────────────────
// D3 minor-pentatonic drone: D3 F3 G3 A3 C4 D4
const D3 = 146.83;
const PENTATONIC_RATIOS = [1, 4 / 3, 3 / 2, 5 / 3, 16 / 9, 2]; // root, m3, 4, 5, m7, octave
// i * golden-angle (2.39996 rad) spreads pseudo-random but deterministic picks
const GOLDEN = 2.39996;

// ─── State ────────────────────────────────────────────────────────────────────
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;   // music bus
let wetGain: GainNode | null = null;      // reverb send for music
let reverb: ConvolverNode | null = null;  // shared hall reverb
let sfxGain: GainNode | null = null;      // sound-effects bus (bird scatter, …)
let lfoNode: OscillatorNode | null = null;
let lfoGain: GainNode | null = null;
let padOscillators: OscillatorNode[] = [];
let pluckTimer: ReturnType<typeof setTimeout> | null = null;
let pluckCounter = 0;
let audioEnabled = false;
let lastScatter = -1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Smooth exponential-decay impulse response → warm, serene hall reverb.
 *  Deterministic pseudo-noise (sin-hash), no Math.random. */
function makeReverb(c: AudioContext): ConvolverNode {
  const conv = c.createConvolver();
  const seconds = 3.4;
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const decay = Math.pow(1 - t, 2.6);            // long smooth tail
      const h = Math.sin((i + 1) * (12.9898 + ch * 2.1)) * 43758.5453;
      data[i] = ((h - Math.floor(h)) * 2 - 1) * decay;
    }
  }
  conv.buffer = buf;
  return conv;
}

function createPad(c: AudioContext, master: GainNode, wet: GainNode) {
  // 4 detuned oscillators: a warm minor-pentatonic pad + a soft sub for depth.
  const specs: Array<{ type: OscillatorType; detune: number; gain: number; freq: number }> = [
    { type: 'sine',     detune: 0,   gain: 0.34, freq: D3 },
    { type: 'triangle', detune: +6,  gain: 0.20, freq: D3 },
    { type: 'triangle', detune: -4,  gain: 0.16, freq: D3 },
    { type: 'sine',     detune: 0,   gain: 0.16, freq: D3 / 2 }, // sub-octave warmth
  ];

  // LFO for slow breathing (~0.045 Hz) — gentle, meditative swell.
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.045;
  lfo.type = 'sine';

  const lfoG = c.createGain();
  lfoG.gain.value = 0.05; // modulation depth
  lfo.connect(lfoG);

  // Warm lowpass — softer than before for a more serene timbre.
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 680;
  filter.Q.value = 0.6;

  const oscs: OscillatorNode[] = [];
  for (const spec of specs) {
    const osc = c.createOscillator();
    osc.type = spec.type;
    osc.frequency.value = spec.freq;
    osc.detune.value = spec.detune;

    const g = c.createGain();
    g.gain.value = spec.gain;

    // LFO modulates each osc's gain node
    lfoG.connect(g.gain);

    osc.connect(g);
    g.connect(filter);
    osc.start();
    oscs.push(osc);
  }

  // Dry + generous reverb send for a spacious, peaceful pad.
  filter.connect(master);
  filter.connect(wet);
  lfo.start();

  lfoNode = lfo;
  lfoGain = lfoG;
  padOscillators = oscs;
}

function scheduleNextPluck(c: AudioContext, master: GainNode) {
  // Slower, sparser spacing for calm: 10–20 s between bell tones.
  const intervalMs = 10000 + (((pluckCounter * GOLDEN) % 1) * 10000);
  pluckTimer = setTimeout(() => {
    if (!ctx || !masterGain) return;
    firePluck(c, master);
    pluckCounter++;
    scheduleNextPluck(c, master);
  }, intervalMs);
}

function firePluck(c: AudioContext, master: GainNode) {
  // Pick a pentatonic note deterministically
  const idx = Math.floor(((pluckCounter * GOLDEN) % 1) * PENTATONIC_RATIOS.length);
  const freq = D3 * PENTATONIC_RATIOS[idx] * 2; // up an octave → gentle bell register

  // Soft bell tone: gentle attack (40 ms), long exponential decay (5–8 s).
  const decaySecs = 5 + (((pluckCounter * GOLDEN * 1.618) % 1) * 3);

  // Fundamental (sine) + a quiet octave partial → bell-like shimmer.
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, c.currentTime);
  env.gain.linearRampToValueAtTime(0.12, c.currentTime + 0.04);
  env.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + decaySecs);

  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 1600;

  for (const [mult, gain] of [[1, 1.0], [2, 0.32], [3, 0.12]] as [number, number][]) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    const pg = c.createGain();
    pg.gain.value = gain;
    osc.connect(pg);
    pg.connect(env);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + decaySecs + 0.1);
  }

  env.connect(filt);
  filt.connect(master);          // dry
  if (wetGain) filt.connect(wetGain); // reverb send — long, serene tail
}

function buildGraph(c: AudioContext) {
  masterGain = c.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(c.destination);

  reverb = makeReverb(c);
  const reverbReturn = c.createGain();
  reverbReturn.gain.value = 0.9;
  reverb.connect(reverbReturn);
  reverbReturn.connect(c.destination);

  wetGain = c.createGain();
  wetGain.gain.value = 0.32; // music reverb send level
  wetGain.connect(reverb);

  sfxGain = c.createGain();
  sfxGain.gain.value = 0.7;
  sfxGain.connect(c.destination);
  sfxGain.connect(reverb); // SFX also picks up a touch of the hall

  createPad(c, masterGain, wetGain);

  // Expose on window for E2E RMS verification (harmless in production)
  (window as unknown as Record<string, unknown>).__audioCtx = c;
  (window as unknown as Record<string, unknown>).__masterGain = masterGain;
}

function startEngine() {
  // AudioContext must be created inside user gesture (autoplay policy)
  if (!ctx) {
    ctx = new AudioContext();
    buildGraph(ctx);
    pluckCounter = 0;
  }

  if (ctx.state === 'suspended') ctx.resume();
  audioEnabled = true;

  // Ramp master gain up
  masterGain!.gain.cancelScheduledValues(ctx.currentTime);
  masterGain!.gain.setValueAtTime(masterGain!.gain.value, ctx.currentTime);
  masterGain!.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.2);

  // Kick off deterministic bell sequence
  pluckCounter = 0;
  scheduleNextPluck(ctx, masterGain!);
}

function stopEngine() {
  if (!ctx || !masterGain) return;
  audioEnabled = false;

  // Clear pad oscillator and lfo references (held to prevent GC during playback)
  void padOscillators;
  void lfoNode;
  void lfoGain;

  // Clear pending pluck
  if (pluckTimer != null) { clearTimeout(pluckTimer); pluckTimer = null; }

  // Smooth ramp to silence then suspend
  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(masterGain.gain.value, t);
  masterGain.gain.linearRampToValueAtTime(0, t + 0.6);

  setTimeout(() => { ctx?.suspend(); }, 700);
}

// ─── Bird-scatter SFX ─────────────────────────────────────────────────────────
/**
 * Wing-flutter whoosh + soft chirps — played when ground doves take flight.
 * Routed through the shared SFX bus (and a touch of hall reverb). Only audible
 * while audio is enabled (the ♪ toggle unlocks the AudioContext via gesture).
 * A short cooldown prevents machine-gun retriggering.
 */
export function playBirdScatter(): void {
  if (!audioEnabled || !ctx || !sfxGain || ctx.state !== 'running') return;
  const c = ctx, now = c.currentTime;
  if (now - lastScatter < 0.45) return; // cooldown
  lastScatter = now;

  // ── Wing flutter: bandpassed noise burst with a fast tremolo flutter ──
  const dur = 0.55;
  const noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const h = Math.sin((i + 1) * 12.9898) * 43758.5453;
    data[i] = (h - Math.floor(h)) * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;

  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1700;
  bp.Q.value = 0.7;

  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.gain.linearRampToValueAtTime(0.11, now + 0.03);
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  // Tremolo (~20 Hz) modulating the envelope → wing-beat flutter.
  const trem = c.createOscillator();
  trem.type = 'sine';
  trem.frequency.value = 20;
  const tg = c.createGain();
  tg.gain.value = 0.045;
  trem.connect(tg);
  tg.connect(env.gain);
  trem.start(now);
  trem.stop(now + dur);

  src.connect(bp);
  bp.connect(env);
  env.connect(sfxGain);
  src.start(now);
  src.stop(now + dur);

  // ── Two soft descending chirps (startled doves) ──
  for (let k = 0; k < 2; k++) {
    const t0 = now + 0.04 + k * 0.07;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(2300 + k * 250, t0);
    o.frequency.exponentialRampToValueAtTime(1400, t0 + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    o.connect(g);
    g.connect(sfxGain);
    o.start(t0);
    o.stop(t0 + 0.25);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function addAudioToggle() {
  let on = false;

  const btn = cornerButton('♪', 'Music', 1, () => {
    on = !on;
    btn.style.opacity = on ? '1' : '0.55';

    if (TRACK_URL) {
      // Licensed track path — see comment at top of file
      return;
    }

    // Generative engine
    if (on) { startEngine(); } else { stopEngine(); }
  });

  btn.style.opacity = '0.55'; // starts muted (autoplay policy + spec)
}

// (window.__audioCtx / window.__masterGain set in buildGraph for E2E RMS tests)
