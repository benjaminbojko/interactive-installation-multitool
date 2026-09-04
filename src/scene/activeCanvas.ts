// Tracks whichever 3D canvas is currently mounted so a single topbar button
// can screenshot it without every scene needing its own capture UI. Only one
// scene is ever mounted at a time (App.tsx renders one tab), so a module-level
// singleton is simpler than threading a ref/context through five scene files.

type Registration = { domElement: HTMLCanvasElement; invalidate: () => void };

let active: Registration | null = null;

export function registerActiveCanvas(reg: Registration): () => void {
  active = reg;
  return () => {
    if (active === reg) active = null;
  };
}

// Requests a fresh render (scenes use frameloop="demand", so the buffer can be
// stale) and waits two frames before reading pixels, so the render has landed.
export function captureActiveCanvasScreenshot(): Promise<Blob | null> {
  const reg = active;
  if (!reg) return Promise.resolve(null);
  reg.invalidate();
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        reg.domElement.toBlob((blob) => resolve(blob), 'image/png');
      });
    });
  });
}
