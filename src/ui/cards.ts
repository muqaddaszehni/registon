import { getCard, Lang } from '../content/i18n';

// ─── Palette (echoes the madrasa tilework) ──────────────────────────────────
//   parchment  #fbf3df  warm ivory ground (aged paper / plaster)
//   ink        #2a2350  deep indigo text
//   gold       #b8893d  burnished tile gold (inner frame, flourish)
//   gold-soft  #d8b06a  highlight gold
//   turquoise  #3fc1c9  Samarkand cobalt-turquoise top accent
//   lapis      #123a66  deep blue for chrome (toggle / buttons)

const css = `
#ui .card {
  position: absolute; left: 50%; bottom: 32px;
  transform: translateX(-50%) translateY(10px);
  width: min(440px, calc(100vw - 32px));
  color: #2a2350;
  background:
    radial-gradient(120% 90% at 50% 0%, #fffaf0 0%, #fbf3df 55%, #f4e8cc 100%);
  border-radius: 16px;
  padding: 0;
  box-shadow:
    0 10px 34px rgba(20, 14, 50, .38),
    0 2px 0 rgba(255,255,255,.5) inset;
  border-top: 6px solid #3fc1c9;
  opacity: 0;
  transition: opacity .28s ease, transform .28s cubic-bezier(.2,.7,.3,1);
  pointer-events: none;
  overflow: hidden;
}
#ui .card.open { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }

/* Thin gold inner border echoing tile banding, inset from the edge. */
.card .frame {
  position: relative;
  margin: 10px;
  padding: 18px 22px 20px;
  border: 1px solid rgba(184, 137, 61, .55);
  border-radius: 9px;
  box-shadow: 0 0 0 1px rgba(184, 137, 61, .14) inset;
}

/* Girih-style corner motifs sit on the four corners of the gold frame. */
.card .corner {
  position: absolute; width: 18px; height: 18px; color: #b8893d;
  opacity: .85; pointer-events: none;
}
.card .corner.tl { top: -6px;  left: -6px;  }
.card .corner.tr { top: -6px;  right: -6px;  transform: scaleX(-1); }
.card .corner.bl { bottom: -6px; left: -6px;  transform: scaleY(-1); }
.card .corner.br { bottom: -6px; right: -6px; transform: scale(-1,-1); }

.card h3 {
  margin: 2px 26px 4px 0;
  font-size: 27px;
  line-height: 1.15;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #1f1a40;
}
/* EN titles → Kufic display; TJ titles → Perso-Arabic Nastaliq (Samarkand script). */
.card[data-lang="en"] h3 { font-family: 'Reem Kufi', 'Cormorant Garamond', Georgia, serif; letter-spacing: 0.005em; }
.card[data-lang="tj"] h3 {
  font-family: 'Noto Nastaliq Urdu', 'Cormorant Garamond', Georgia, serif;
  direction: rtl; text-align: right; unicode-bidi: plaintext;
  font-weight: 500; letter-spacing: 0;
  font-size: 30px; line-height: 2.0;            /* Nastaliq needs generous vertical room */
  margin: 0 0 6px; padding: 2px 2px 6px;
}
/* TJ body → Yeseva One (elegant Cyrillic with full Tajik coverage). */
.card[data-lang="tj"] p { font-family: 'Yeseva One', 'Cormorant Garamond', Georgia, serif; font-size: 16px; line-height: 1.85; }

/* Decorative flourish: a slim gold rule with a central diamond, under the title. */
.card .flourish {
  display: flex; align-items: center; gap: 9px;
  margin: 0 0 11px; height: 10px; color: #b8893d;
}
.card .flourish::before,
.card .flourish::after {
  content: ""; flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(184,137,61,.65) 35%, rgba(184,137,61,.65) 65%, transparent);
}
.card .flourish svg { flex: none; width: 14px; height: 10px; }

.card p {
  margin: 0; line-height: 1.7; font-size: 16.5px; font-weight: 400;
  color: #2a2350;
}

.card .close {
  position: absolute; top: 10px; right: 12px;
  width: 30px; height: 30px; line-height: 28px; text-align: center;
  border: 1px solid rgba(184,137,61,.45); background: rgba(255,255,255,.4);
  border-radius: 50%; font-size: 19px; cursor: pointer; color: #6b5526;
  transition: background .15s, color .15s, border-color .15s;
}
.card .close:hover { background: #b8893d; color: #fffaf0; border-color: #b8893d; }
.card .close:focus-visible { outline: 2px solid #123a66; outline-offset: 2px; }

@media (orientation: portrait) {
  #ui .card { bottom: 0; border-radius: 16px 16px 0 0; width: 100vw; }
  .card .frame { margin: 12px 14px 16px; }
}
@media (prefers-reduced-motion: reduce) {
  #ui .card { transition: opacity .01s; }
}

/* ─── Language toggle — warm lapis tile pill with gold edge ──────────────── */
.langtoggle {
  position: absolute; left: 16px; bottom: 16px; border: 1px solid rgba(216,176,106,.7);
  cursor: pointer; color: #fff3da; border-radius: 22px; padding: 9px 18px 10px;
  font-family: 'Cormorant Garamond', Georgia, serif; font-size: 17px; font-weight: 600;
  letter-spacing: 0.03em;
  background: linear-gradient(180deg, #1a4e84 0%, #123a66 100%);
  box-shadow: 0 2px 10px rgba(8,22,44,.4), 0 1px 0 rgba(255,255,255,.12) inset;
  transition: transform .12s ease, box-shadow .15s ease, filter .15s ease;
}
.langtoggle:hover { filter: brightness(1.12); }
.langtoggle:active { transform: translateY(1px); }
.langtoggle:focus-visible { outline: 2px solid #3fc1c9; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .langtoggle { transition: none; } }
`;

// Girih-flavoured corner motif: an eight-point star fragment on the corner.
const CORNER_SVG = `<svg class="corner CLS" viewBox="0 0 18 18" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="1.1">
    <path d="M0 9 L4.5 9 L9 4.5 L9 0" />
    <path d="M3 9 L9 3" />
    <path d="M0 4.5 L4.5 0" />
  </g>
  <circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/>
</svg>`;

const FLOURISH_SVG = `<svg viewBox="0 0 14 10" aria-hidden="true">
  <g fill="currentColor"><path d="M7 0 L11 5 L7 10 L3 5 Z"/></g>
  <circle cx="7" cy="5" r="1.1" fill="#fbf3df"/>
</svg>`;

export class Cards {
  private lang: Lang = (localStorage.getItem('lang') as Lang) || 'en';
  private el: HTMLDivElement;
  private currentId: number | null = null;

  constructor() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const ui = document.getElementById('ui')!;

    this.el = document.createElement('div');
    this.el.className = 'card';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-live', 'polite');
    this.el.dataset.lang = this.lang;
    ui.appendChild(this.el);

    const toggle = document.createElement('button');
    toggle.className = 'langtoggle';
    toggle.lang = 'tg';
    const label = () => (this.lang === 'en' ? 'Тоҷикӣ' : 'English');
    const title = () => (this.lang === 'en' ? 'Забон иваз кунед — English' : 'Switch language — Тоҷикӣ');
    toggle.textContent = label();
    toggle.title = title();
    toggle.setAttribute('aria-label', title());
    toggle.addEventListener('click', () => {
      this.lang = this.lang === 'en' ? 'tj' : 'en';
      localStorage.setItem('lang', this.lang);
      toggle.textContent = label();
      toggle.title = title();
      toggle.setAttribute('aria-label', title());
      this.el.dataset.lang = this.lang;
      if (this.currentId) this.show(this.currentId);
    });
    ui.appendChild(toggle);

    // Expose for the UI screenshot/verify harness (harmless in production).
    (window as unknown as Record<string, unknown>).__cards = this;
  }

  show(id: number) {
    const c = getCard(id, this.lang);
    this.currentId = id;
    this.el.dataset.lang = this.lang;
    this.el.lang = this.lang === 'tj' ? 'tg' : 'en';
    this.el.innerHTML = `
      <div class="frame">
        ${CORNER_SVG.replace('CLS', 'tl')}
        ${CORNER_SVG.replace('CLS', 'tr')}
        ${CORNER_SVG.replace('CLS', 'bl')}
        ${CORNER_SVG.replace('CLS', 'br')}
        <button class="close" aria-label="Close">×</button>
        <h3></h3>
        <div class="flourish">${FLOURISH_SVG}</div>
        <p></p>
      </div>`;
    const h3 = this.el.querySelector('h3')!;
    h3.textContent = c.title;
    if (this.lang === 'tj') {
      // Perso-Arabic Nastaliq title; keep Cyrillic for screen readers/search.
      h3.setAttribute('lang', 'fa');
      h3.setAttribute('dir', 'rtl');
      if (c.titleAlt) h3.setAttribute('aria-label', c.titleAlt);
    } else {
      h3.removeAttribute('lang');
      h3.removeAttribute('dir');
      h3.removeAttribute('aria-label');
    }
    this.el.querySelector('p')!.textContent = c.body;
    this.el.querySelector('.close')!.addEventListener('click', () => this.hide());
    this.el.classList.add('open');
  }

  hide() { this.el.classList.remove('open'); this.currentId = null; }
}
