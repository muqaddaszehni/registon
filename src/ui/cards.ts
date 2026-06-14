import { getCard, Lang } from '../content/i18n';

const css = `
#ui .card { position: absolute; left: 50%; bottom: 32px; transform: translateX(-50%) translateY(8px);
  width: min(420px, calc(100vw - 32px)); background: #fff8e7; color: #2a2350;
  border-radius: 14px; padding: 20px 22px; box-shadow: 0 8px 30px rgba(42,35,80,.35);
  border-top: 6px solid #3fc1c9; opacity: 0; transition: opacity .25s, transform .25s; pointer-events: none; }
#ui .card.open { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }
.card h3 { margin: 0 0 8px; font-size: 22px; font-weight: 600; letter-spacing: 0.03em; }
.card p { margin: 0; line-height: 1.65; font-size: 16px; font-weight: 400; }
.card .close { position: absolute; top: 8px; right: 12px; border: none; background: none;
  font-size: 20px; cursor: pointer; color: #2a2350; }
@media (orientation: portrait) {
  #ui .card { bottom: 0; border-radius: 14px 14px 0 0; width: 100vw; }
}
@media (prefers-reduced-motion: reduce) {
  #ui .card { transition: none; }
}
.langtoggle { position: absolute; left: 16px; bottom: 16px; border: none; cursor: pointer;
  background: #123a66; color: #fff3da; border-radius: 22px; padding: 10px 18px; font-size: 15px;
  font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; letter-spacing: 0.04em; }
`;

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
    ui.appendChild(this.el);

    const toggle = document.createElement('button');
    toggle.className = 'langtoggle';
    const label = () => (this.lang === 'en' ? 'Тоҷикӣ' : 'English');
    toggle.textContent = label();
    toggle.addEventListener('click', () => {
      this.lang = this.lang === 'en' ? 'tj' : 'en';
      localStorage.setItem('lang', this.lang);
      toggle.textContent = label();
      if (this.currentId) this.show(this.currentId);
    });
    ui.appendChild(toggle);
  }

  show(id: number) {
    const c = getCard(id, this.lang);
    this.currentId = id;
    this.el.innerHTML = `<button class="close" aria-label="Close">×</button><h3></h3><p></p>`;
    this.el.querySelector('h3')!.textContent = c.title;
    this.el.querySelector('p')!.textContent = c.body;
    this.el.querySelector('.close')!.addEventListener('click', () => this.hide());
    this.el.classList.add('open');
  }

  hide() { this.el.classList.remove('open'); this.currentId = null; }
}
