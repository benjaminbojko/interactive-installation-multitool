// Raycasts a projector's aim direction against the live projection-canvas
// mesh to find its real throw distance — the distance from the lens to
// whatever the projector is actually pointed at, as opposed to
// projectorConfig.ts's posIn[2] fallback (only correct for an unrotated
// projector facing a flat surface at z=0). Requires Three.js scene access,
// so unlike focusOptics.ts/projectiveOptics.ts this isn't pure math.
import * as THREE from 'three';

// Local -Z matches the frustum convention in ProjectionFrustum.tsx
// (computeLocalFrustumCorners places the image plane at z = -distanceFt)
// and the <group rotation={rotRad}> the projector node is rendered under, so
// rotating rotDeg[1] (yaw) etc. rotates this same forward axis.
const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);

const scratchOrigin = new THREE.Vector3();
const scratchDir = new THREE.Vector3();
const scratchEuler = new THREE.Euler();

/**
 * Distance in inches from a projector's lens to the first surface its aim
 * direction hits on `target`, or null if the ray misses (nothing loaded yet,
 * aimed off into space, etc).
 */
export function raycastThrowDistanceIn(
  posIn: readonly [number, number, number],
  rotDeg: readonly [number, number, number],
  target: THREE.Object3D,
  raycaster: THREE.Raycaster,
): number | null {
  scratchOrigin.set(posIn[0] / 12, posIn[1] / 12, posIn[2] / 12);
  scratchEuler.set(
    (rotDeg[0] * Math.PI) / 180,
    (rotDeg[1] * Math.PI) / 180,
    (rotDeg[2] * Math.PI) / 180,
    'XYZ',
  );
  scratchDir.copy(LOCAL_FORWARD).applyEuler(scratchEuler).normalize();
  raycaster.set(scratchOrigin, scratchDir);
  const hit = raycaster.intersectObject(target, true)[0];
  return hit ? hit.distance * 12 : null;
}
