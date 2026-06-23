import { cornerButton } from './ui/buttons';

// ─── Licensed track path (spec open item) ─────────────────────────────────────
// When a licensed track ships, set TRACK_URL and swap the engine for an <audio>.
const TRACK_URL = ''; // empty = generative engine active

// ─── Music: a peaceful plucked-string raga, dutar/tanbur in feel ─────────────
// Synth: Karplus–Strong (real plucked-string physical model). Mode: Hijaz on A
// (A Bb C# D E F G#) — the augmented-2nd colour of Samarkand/Central-Asian maqam,
// played slow and sparse over a soft tonic drone so it reads serene, not exotic.
const A = 220; // melody tonic A3
const HIJAZ = [0, 1, 4, 5, 7, 8, 11]; // semitone offsets within the mode

/** Frequency for scale degree `deg` (can exceed 0..6 to wrap octaves), `oct` shift. */
function noteFreq(deg: number, oct: number): number {
  const idx = ((deg % 7) + 7) % 7;
  const octWrap = Math.floor(deg / 7);
  const semis = HIJAZ[idx] + 12 * (oct + octWrap);
  return A * Math.pow(2, semis / 12);
}

// Phrase: [degree, octave, durationSecs]. duration<=0 marks a rest of |dur|.
// A slow descending contemplative line resolving to the tonic, with breaths.
const PHRASE: [number, number, number][] = [
  [4, 0, 1.1], [5, 0, 0.85], [4, 0, 0.6], [2, 0, 1.3], [0, 0, -0.6],
  [3, 0, 0.8], [2, 0, 0.7], [1, 0, 0.75], [0, 0, 1.7], [0, 0, -1.1],
  [4, 0, 0.7], [5, 0, 0.7], [6, 0, 1.5], [4, 0, 0.7], [0, 0, -0.7],
  [3, 0, 0.8], [2, 0, 0.75], [1, 0, 0.8], [0, 0, 2.0], [0, 0, -2.0],
];

// ─── State ────────────────────────────────────────────────────────────────────
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;   // music bus
let wetGain: GainNode | null = null;      // reverb send for music
let reverb: ConvolverNode | null = null;  // shared hall reverb
let sfxGain: GainNode | null = null;      // sound-effects bus (bird scatter)
let melodyTimer: ReturnType<typeof setTimeout> | null = null;
let droneTimer: ReturnType<typeof setTimeout> | null = null;
let phraseIdx = 0;
let droneCount = 0;
let audioEnabled = false;
let lastScatter = -1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Smooth exponential-decay impulse response → warm, serene hall reverb. */
function makeReverb(c: AudioContext): ConvolverNode {
  const conv = c.createConvolver();
  const len = Math.floor(c.sampleRate * 3.6);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const decay = Math.pow(1 - t, 2.6);
      const h = Math.sin((i + 1) * (12.9898 + ch * 2.1)) * 43758.5453;
      data[i] = ((h - Math.floor(h)) * 2 - 1) * decay;
    }
  }
  conv.buffer = buf;
  return conv;
}

/**
 * Karplus–Strong plucked string → an AudioBuffer at `freq`.
 * Deterministic excitation (sin-hash, no Math.random). `damping` ≈ sustain
 * (0.99 short, 0.997 long/singing). `tone` (0..1) lowpasses the excitation for
 * a mellower, woodier pluck (dutar) vs a brighter one.
 */
function ksBuffer(c: AudioContext, freq: number, dur: number, damping: number, tone: number): AudioBuffer {
  const N = Math.max(2, Math.round(c.sampleRate / freq));
  const total = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, total, c.sampleRate);
  const data = buf.getChannelData(0);

  // Excitation: short noise burst, length N+1, lowpassed by `tone`.
  let prev = 0;
  const a = 0.35 + 0.6 * (1 - tone); // smoothing amount (more tone-down → smoother)
  for (let i = 0; i <= N && i < total; i++) {
    const hsh = Math.sin((i + 1) * 12.9898 + freq * 0.0013) * 43758.5453;
    const white = (hsh - Math.floor(hsh)) * 2 - 1;
    prev = prev + a * (white - prev); // one-pole lowpass
    data[i] = prev;
  }
  // KS loop: averaging filter + damping → string decay.
  for (let i = N + 1; i < total; i++) {
    data[i] = damping * 0.5 * (data[i - N] + data[i - N - 1]);
  }
  return buf;
}

/** Pluck a note: KS buffer → soft amplitude envelope → dry + reverb. */
function pluck(c: AudioContext, freq: number, level: number, dur: number, damping: number, tone: number) {
  if (!masterGain) return;
  const src = c.createBufferSource();
  src.buffer = ksBuffer(c, freq, dur, damping, tone);

  const env = c.createGain();
  const now = c.currentTime;
  env.gain.setValueAtTime(0.0001, now);
  env.gain.linearRampToValueAtTime(level, now + 0.012); // gentle pluck attack
  env.gain.setTargetAtTime(0.0001, now + dur * 0.6, dur * 0.5);

  src.connect(env);
  env.connect(masterGain);
  if (wetGain) env.connect(wetGain);
  src.start(now);
  src.stop(now + dur + 0.05);
}

function scheduleMelody(c: AudioContext) {
  const [deg, oct, dur] = PHRASE[phraseIdx];
  const isRest = dur <= 0;
  if (!isRest) {
    // Slight humanised level so repeats breathe; deterministic from index.
    const lvl = 0.34 + 0.06 * (((phraseIdx * 2.39996) % 1) - 0.5);
    pluck(c, noteFreq(deg, oct), lvl, Math.min(3.4, Math.abs(dur) + 1.4), 0.9965, 0.62);
  }
  phraseIdx = (phraseIdx + 1) % PHRASE.length;
  melodyTimer = setTimeout(() => { if (ctx && audioEnabled) scheduleMelody(c); }, Math.abs(dur) * 1000);
}

function scheduleDrone(c: AudioContext) {
  // Soft low tonic drone (open bass string) every ~6.5 s, long singing decay.
  pluck(c, noteFreq(0, -1), 0.20, 6.5, 0.9975, 0.5);
  // occasional fifth under it for warmth
  if (droneCount % 2 === 1) pluck(c, noteFreq(4, -1), 0.12, 6.0, 0.9975, 0.5);
  droneCount++;
  droneTimer = setTimeout(() => { if (ctx && audioEnabled) scheduleDrone(c); }, 6500);
}

function buildGraph(c: AudioContext) {
  // Master limiter → catches overlapping-pluck + reverb peaks so nothing clips.
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.25;
  limiter.connect(c.destination);

  masterGain = c.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(limiter);

  reverb = makeReverb(c);
  const reverbReturn = c.createGain();
  reverbReturn.gain.value = 0.95;
  reverb.connect(reverbReturn);
  reverbReturn.connect(limiter);

  wetGain = c.createGain();
  wetGain.gain.value = 0.40; // generous hall send for a spacious, peaceful string
  wetGain.connect(reverb);

  sfxGain = c.createGain();
  sfxGain.gain.value = 0.8;
  sfxGain.connect(limiter);
  sfxGain.connect(reverb);

  // Expose on window for E2E RMS verification (harmless in production)
  (window as unknown as Record<string, unknown>).__audioCtx = c;
  (window as unknown as Record<string, unknown>).__masterGain = masterGain;
}

function startEngine() {
  if (!ctx) { ctx = new AudioContext(); buildGraph(ctx); }
  if (ctx.state === 'suspended') ctx.resume();
  audioEnabled = true;

  masterGain!.gain.cancelScheduledValues(ctx.currentTime);
  masterGain!.gain.setValueAtTime(masterGain!.gain.value, ctx.currentTime);
  masterGain!.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 1.5); // string bus runs hotter (KS is quiet)

  phraseIdx = 0; droneCount = 0;
  scheduleMelody(ctx);
  scheduleDrone(ctx);
}

function stopEngine() {
  if (!ctx || !masterGain) return;
  audioEnabled = false;
  if (melodyTimer != null) { clearTimeout(melodyTimer); melodyTimer = null; }
  if (droneTimer != null) { clearTimeout(droneTimer); droneTimer = null; }

  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(masterGain.gain.value, t);
  masterGain.gain.linearRampToValueAtTime(0, t + 0.6);
  setTimeout(() => { ctx?.suspend(); }, 700);
}

// ─── Bird-scatter SFX ─────────────────────────────────────────────────────────
/**
 * Doves taking flight: a short burst of soft wing-flap whooshes — band-limited
 * noise swishes, ~8 per second, fading out. (The old version used a 20 Hz
 * tremolo that stuttered like a machine gun; this models discrete wing beats.)
 */
export function playBirdScatter(): void {
  if (!audioEnabled || !ctx || !sfxGain || ctx.state !== 'running') return;
  const c = ctx, now = c.currentTime;
  if (now - lastScatter < 0.5) return; // cooldown
  lastScatter = now;

  const flaps = 6;
  for (let k = 0; k < flaps; k++) {
    const t0 = now + k * 0.115 + 0.015 * Math.sin(k * 1.7); // slight irregular spacing
    const dur = 0.14;
    const nb = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const hsh = Math.sin((i + 1 + k * 131) * 12.9898) * 43758.5453;
      d[i] = (hsh - Math.floor(hsh)) * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = nb;

    // Each flap: a low airy whoosh. Slight downward filter sweep across the burst.
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(620 - k * 45, t0);
    lp.Q.value = 0.5;

    const g = c.createGain();
    const amp = 0.16 * (1 - k * 0.12);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(amp, t0 + 0.035); // soft swish in
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(lp); lp.connect(g); g.connect(sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function addAudioToggle() {
  // On by default. Autoplay policy forbids sound before any user gesture, so the
  // engine is armed to start on the user's FIRST interaction (tap/click/key) —
  // e.g. the very first tap-to-move — which is as close to "plays on landing" as
  // browsers allow.
  let on = true;
  let started = false;
  const start = () => { if (on && !started) { started = true; startEngine(); } };

  const btn = cornerButton('♪', 'Music', 1, () => {
    on = !on;
    btn.style.opacity = on ? '1' : '0.55';
    if (TRACK_URL) return;
    if (on) { started = true; startEngine(); } else { stopEngine(); }
  });
  btn.style.opacity = '1'; // on by default

  // Arm autostart on first gesture (each fires once; resume is idempotent).
  for (const ev of ['pointerdown', 'touchstart', 'keydown'] as const) {
    window.addEventListener(ev, start, { once: true });
  }
}

// (window.__audioCtx / window.__masterGain set in buildGraph for E2E RMS tests)
