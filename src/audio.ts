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
let masterGain: GainNode | null = null;
let lfoNode: OscillatorNode | null = null;
let lfoGain: GainNode | null = null;
let padOscillators: OscillatorNode[] = [];
let pluckTimer: ReturnType<typeof setTimeout> | null = null;
let pluckCounter = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createPad(c: AudioContext, master: GainNode) {
  // 3 detuned oscillators: sine, triangle, triangle — form a warm minor-pentatonic pad
  const specs: Array<{ type: OscillatorType; detune: number; gain: number }> = [
    { type: 'sine', detune: 0, gain: 0.4 },
    { type: 'triangle', detune: +7, gain: 0.25 },
    { type: 'triangle', detune: -5, gain: 0.20 },
  ];

  // LFO for slow breathing (~0.05 Hz)
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.05;
  lfo.type = 'sine';

  const lfoG = c.createGain();
  lfoG.gain.value = 0.06; // modulation depth
  lfo.connect(lfoG);

  // Gentle lowpass for warmth
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 0.7;

  const oscs: OscillatorNode[] = [];
  for (const spec of specs) {
    const osc = c.createOscillator();
    osc.type = spec.type;
    osc.frequency.value = D3;
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

  filter.connect(master);
  lfo.start();

  lfoNode = lfo;
  lfoGain = lfoG;
  padOscillators = oscs;
}

function scheduleNextPluck(c: AudioContext, master: GainNode) {
  // Deterministic spacing: golden-angle counter maps to 6–12 s interval
  const intervalMs = 6000 + (((pluckCounter * GOLDEN) % 1) * 6000);
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
  const freq = D3 * PENTATONIC_RATIOS[idx];

  // Short triangle pluck: fast attack (5 ms), exponential decay (2–4 s)
  const decaySecs = 2 + (((pluckCounter * GOLDEN * 1.618) % 1) * 2);

  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;

  const env = c.createGain();
  env.gain.setValueAtTime(0, c.currentTime);
  env.gain.linearRampToValueAtTime(0.18, c.currentTime + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + decaySecs);

  // Light lowpass to soften the pluck
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 1200;

  osc.connect(env);
  env.connect(filt);
  filt.connect(master);

  osc.start(c.currentTime);
  osc.stop(c.currentTime + decaySecs + 0.1);
}

function startEngine() {
  // AudioContext must be created inside user gesture (autoplay policy)
  if (!ctx) {
    ctx = new AudioContext();

    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);

    createPad(ctx, masterGain);
    pluckCounter = 0;

    // Expose on window for E2E RMS verification (harmless in production)
    (window as unknown as Record<string, unknown>).__audioCtx = ctx;
    (window as unknown as Record<string, unknown>).__masterGain = masterGain;
  }

  if (ctx.state === 'suspended') ctx.resume();

  // Ramp master gain up
  masterGain!.gain.cancelScheduledValues(ctx.currentTime);
  masterGain!.gain.setValueAtTime(masterGain!.gain.value, ctx.currentTime);
  masterGain!.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.8);

  // Kick off deterministic pluck sequence
  pluckCounter = 0;
  scheduleNextPluck(ctx, masterGain!);
}

function stopEngine() {
  if (!ctx || !masterGain) return;

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
  masterGain.gain.linearRampToValueAtTime(0, t + 0.5);

  setTimeout(() => { ctx?.suspend(); }, 600);
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

// (window.__audioCtx / window.__masterGain set in startEngine for E2E RMS tests)
