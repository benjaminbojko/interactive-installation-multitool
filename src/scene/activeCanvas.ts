// Tracks whichever 3D canvas is currently mounted so a single topbar button
// can screenshot it without every scene needing its own capture UI. Only one
// scene is ever mounted at a time (App.tsx renders one tab), so a module-level
// singleton is simpler than threading a ref/context through five scene files.

type Registration = { capture: () => Promise<Blob | null> };

let active: Registration | null = null;

export function registerActiveCanvas(reg: Registration): () => void {
  active = reg;
  return () => {
    if (active === reg) active = null;
  };
}

export function captureActiveCanvasScreenshot(): Promise<Blob | null> {
  return active ? active.capture() : Promise.resolve(null);
}
