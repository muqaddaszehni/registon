export function cornerButton(label: string, title: string, slot: number, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.title = title;
  b.setAttribute('aria-label', title);
  // Warm lapis-tile disc with a thin gold rim, matching the language toggle.
  b.style.cssText = `position:absolute;right:16px;bottom:${16 + slot * 56}px;width:44px;height:44px;
    border-radius:50%;border:1px solid rgba(216,176,106,.7);
    background:radial-gradient(120% 120% at 35% 25%, #1f5a94 0%, #123a66 70%);
    color:#fff3da;font-size:20px;line-height:1;cursor:pointer;
    box-shadow:0 2px 9px rgba(8,22,44,.4), 0 1px 0 rgba(255,255,255,.14) inset;
    font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;
    transition:filter .15s ease, transform .12s ease;`;
  b.addEventListener('mouseenter', () => { b.style.filter = 'brightness(1.14)'; });
  b.addEventListener('mouseleave', () => { b.style.filter = ''; });
  b.addEventListener('focus', () => { b.style.outline = '2px solid #3fc1c9'; b.style.outlineOffset = '2px'; });
  b.addEventListener('blur', () => { b.style.outline = ''; });
  b.addEventListener('click', onClick);
  document.getElementById('ui')!.appendChild(b);
  return b;
}
