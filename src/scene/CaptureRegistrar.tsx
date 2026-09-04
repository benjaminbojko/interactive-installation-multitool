// Dropped inside each scene's <Canvas> so the screenshot button (in the
// topbar, outside the r3f tree) can reach that scene's renderer.

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { registerActiveCanvas } from './activeCanvas';

export function CaptureRegistrar() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(
    () => registerActiveCanvas({ domElement: gl.domElement, invalidate }),
    [gl, invalidate],
  );

  return null;
}
