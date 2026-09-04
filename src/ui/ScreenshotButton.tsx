// Captures whichever 3D scene is currently mounted (registered via
// CaptureRegistrar) and downloads it as a dated, timestamped PNG.

import { useState } from 'react';
import { captureActiveCanvasScreenshot } from '../scene/activeCanvas';

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function ScreenshotButton() {
  const [flash, setFlash] = useState<string | null>(null);

  const say = (text: string) => {
    setFlash(text);
    window.setTimeout(() => setFlash(null), 3500);
  };

  async function handleClick() {
    const blob = await captureActiveCanvasScreenshot();
    if (!blob) {
      say('No 3D view to capture here.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screenshot-${timestamp()}.png`;
    a.click();
    URL.revokeObjectURL(url);
    say('Screenshot saved.');
  }

  return (
    <div className="save-menu">
      <button className="screenshot-btn" title="Save a PNG of the current 3D view" onClick={handleClick}>
        Screenshot
      </button>
      {flash && <span className="save-flash">{flash}</span>}
    </div>
  );
}
