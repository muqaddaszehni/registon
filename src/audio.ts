import { cornerButton } from './ui/buttons';

const TRACK_URL = ''; // set when a track is chosen (spec open item)

export function addAudioToggle() {
  let audio: HTMLAudioElement | null = null;
  let on = false;
  const btn = cornerButton('♪', 'Music', 1, () => {
    on = !on;
    btn.style.opacity = on ? '1' : '0.55';
    if (!TRACK_URL) return; // silent until a track ships
    if (!audio) { audio = new Audio(TRACK_URL); audio.loop = true; audio.volume = 0.35; }
    if (on) { audio.play().catch(() => {}); } else { audio.pause(); }
  });
  btn.style.opacity = '0.55'; // starts muted (autoplay policy + spec)
}
