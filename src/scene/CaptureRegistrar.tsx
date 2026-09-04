// Dropped inside each scene's <Canvas> so the screenshot button (in the
// topbar, outside the r3f tree) can reach that scene's renderer. Captures by
// rendering and reading the canvas back in the same synchronous call — with
// frameloop="demand", waiting on invalidate() + a couple of animation frames
// left a window where the compositor had already cleared the drawing buffer
// (or "demand" skipped the re-render entirely), producing blank screenshots.

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { registerActiveCanvas } from './activeCanvas';

export function CaptureRegistrar() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const capture = () =>
      new Promise<Blob | null>((resolve) => {
        gl.render(scene, camera);
        gl.domElement.toBlob((blob) => resolve(blob), 'image/png');
      });
    return registerActiveCanvas({ capture });
  }, [gl, scene, camera]);

  return null;
}
