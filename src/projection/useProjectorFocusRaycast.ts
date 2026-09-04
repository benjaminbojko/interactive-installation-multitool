// Keeps auto-focus bands tracking each projector's actual aim rather than
// its raw Z position, so the band stays correct once a projector is rotated
// or aimed at a non-planar (model) surface — see focusRaycast.ts. Runs
// inside the R3F render tree (only there is the live canvas mesh available
// to raycast against); withAutoFocus's posIn[2] estimate remains the
// fallback for any projector whose ray doesn't hit anything yet.
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useConfigStore } from '../store/useConfigStore';
import { depthOfFocusIn } from './focusOptics';
import { raycastThrowDistanceIn } from './focusRaycast';

// Below this, a recomputed band is indistinguishable from the stored one —
// skip the store write so a settled scene stops re-triggering itself under
// the demand frameloop.
const EPSILON_IN = 0.02;

export function useProjectorFocusRaycast(targetRef: React.RefObject<THREE.Object3D | null>): void {
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  useFrame(() => {
    const target = targetRef.current;
    if (!target) return;
    const store = useConfigStore.getState();
    if (!store.projFocusAuto) return;

    for (const p of store.projectors) {
      if (!p.enabled) continue;
      const distIn = raycastThrowDistanceIn(p.posIn, p.rotDeg, target, raycaster);
      if (distIn == null) continue;

      const { nearIn, farIn } = depthOfFocusIn(p.throwRatio, distIn, p.resW);
      if (Math.abs(nearIn - p.focusNearIn) < EPSILON_IN && Math.abs(farIn - p.focusFarIn) < EPSILON_IN) {
        continue;
      }
      store.updateProjector(p.id, {}, distIn);
    }
  });
}
