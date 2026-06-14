export function cornerButton(label: string, title: string, slot: number, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.title = title;
  b.style.cssText = `position:absolute;right:16px;bottom:${16 + slot * 56}px;width:44px;height:44px;
    border-radius:50%;border:none;background:#123a66;color:#fff3da;font-size:20px;cursor:pointer;
    box-shadow:0 2px 8px rgba(0,0,0,.25);font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;`;
  b.addEventListener('click', onClick);
  document.getElementById('ui')!.appendChild(b);
  return b;
}
