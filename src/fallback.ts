export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export function showFallback() {
  document.getElementById('app')!.innerHTML = `
    <div style="height:100%;display:flex;align-items:center;justify-content:center;
                background:linear-gradient(#8d6a9f,#f7b690);font-family:Georgia,serif;">
      <div style="background:#fff8e7;color:#2a2350;max-width:420px;margin:16px;padding:28px;
                  border-radius:14px;border-top:6px solid #3fc1c9;text-align:center;">
        <h2 style="margin-top:0">Registon</h2>
        <p>This experience needs WebGL, which your browser has turned off.
           Registan Square will be waiting when you return on a WebGL-enabled browser.</p>
      </div>
    </div>`;
}
