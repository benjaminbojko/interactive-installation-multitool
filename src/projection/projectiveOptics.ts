// Pure optics & 4x4 matrix math for 3D projection canvases. No React, no Three.js.
// World units are FEET. Matrices are 16-element column-major numbers matching WebGL.

import type { Vec3, LensOrigin } from './projectionMath';
import { fieldCurvatureFrac } from './focusOptics';

export type Mat4 = number[];

export function identityMat4(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

export function transformPointMat4(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z] = p;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  const invW = w !== 0 ? 1 / w : 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) * invW,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) * invW,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) * invW,
  ];
}

export function biasMatrix(): Mat4 {
  return [
    0.5, 0, 0, 0,
    0, 0.5, 0, 0,
    0, 0, 0.5, 0,
    0.5, 0.5, 0.5, 1,
  ];
}

export interface ProjectorPose {
  lens: Vec3;
  tiltDeg?: number;
  rotDeg?: Vec3; // [pitchDeg, yawDeg, rollDeg]
}

export function eulerToRotationMat3(rotDeg: Vec3): number[] {
  const toRad = Math.PI / 180;
  const pitch = (rotDeg[0] ?? 0) * toRad;
  const yaw = (rotDeg[1] ?? 0) * toRad;
  const roll = (rotDeg[2] ?? 0) * toRad;

  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cz = Math.cos(roll);
  const sz = Math.sin(roll);

  return [
    cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
    cx * sz,                cx * cz,                -sx,
    -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx,
  ];
}

export function projectorViewMatrix(pose: ProjectorPose): Mat4 {
  const rot = pose.rotDeg ?? [pose.tiltDeg ?? 0, 0, 0];
  const r = eulerToRotationMat3(rot);
  const [lx, ly, lz] = pose.lens;

  const tx = -(r[0] * lx + r[3] * ly + r[6] * lz);
  const ty = -(r[1] * lx + r[4] * ly + r[7] * lz);
  const tz = -(r[2] * lx + r[5] * ly + r[8] * lz);

  return [
    r[0], r[1], r[2], 0,
    r[3], r[4], r[5], 0,
    r[6], r[7], r[8], 0,
    tx,   ty,   tz,   1,
  ];
}

export interface ProjectorIntrinsics {
  throwRatio: number;
  aspectW: number;
  aspectH: number;
  lensShiftPct: number;
  lensShiftXPct?: number;
  lensOrigin: LensOrigin;
  nearFt?: number;
  farFt?: number;
}

export function projectorProjectionMatrix(i: ProjectorIntrinsics): Mat4 {
  const tanX = i.throwRatio > 0 ? 1 / (2 * i.throwRatio) : 1;
  const aspect = i.aspectW > 0 ? i.aspectH / i.aspectW : 1;
  const tanY = tanX * aspect;
  const baseline = i.lensOrigin === 'top' ? -tanY : 0;
  const shiftY = (i.lensShiftPct / 100) * tanY + baseline;
  const shiftX = ((i.lensShiftXPct ?? 0) / 100) * tanX;
  const n = i.nearFt ?? 0.5;
  const f = i.farFt ?? 500;
  const invD = 1 / (f - n);
  return [
    1 / tanX, 0, 0, 0,
    0, 1 / tanY, 0, 0,
    shiftX / tanX, shiftY / tanY, -(f + n) * invD, -1,
    0, 0, -2 * f * n * invD, 0,
  ];
}

export function unifiedProjectorMatrix(pose: ProjectorPose, i: ProjectorIntrinsics): Mat4 {
  const view = projectorViewMatrix(pose);
  const proj = projectorProjectionMatrix(i);
  return multiplyMat4(biasMatrix(), multiplyMat4(proj, view));
}

export interface ProjectorSpec {
  lens: Vec3;
  viewMatrix: Mat4;
  projMatrix: Mat4;
  textureMatrix: Mat4;
  contentSlice: [number, number];
  lumens?: number;
  focusNearFt: number;
  focusFarFt: number;
  fieldCurvatureFrac: number;
}

export function buildProjectorSpecs(
  centersX: number[],
  distFt: number,
  lensYFt: number,
  tiltDeg: number,
  intrinsics: ProjectorIntrinsics,
  uRanges: [number, number][],
): ProjectorSpec[] {
  return centersX.map((cx, idx) => {
    const pose: ProjectorPose = { lens: [cx, lensYFt, distFt], tiltDeg };
    const view = projectorViewMatrix(pose);
    const proj = projectorProjectionMatrix(intrinsics);
    const texture = multiplyMat4(biasMatrix(), multiplyMat4(proj, view));
    return {
      lens: pose.lens,
      viewMatrix: view,
      projMatrix: proj,
      textureMatrix: texture,
      contentSlice: uRanges[idx] ?? [0, 1],
      // Hardcoded legacy default, not wired to the physical depthOfFocusIn
      // model used elsewhere (this builder's signature lacks resW). Used
      // only by this function's own test.
      focusNearFt: distFt * 0.85,
      focusFarFt: distFt * 1.25,
      fieldCurvatureFrac: fieldCurvatureFrac(intrinsics.throwRatio),
    };
  });
}

export interface ProjectorOpticsInstance {
  posIn: [number, number, number];
  rotDeg: [number, number, number];
  throwRatio: number;
  aspectW: number;
  aspectH: number;
  lensShiftPct: number;
  lensShiftXPct: number;
  lensOrigin: LensOrigin;
  lumens: number;
  enabled: boolean;
  focusNearIn: number;
  focusFarIn: number;
}

export function buildProjectorSpecsFromInstances(
  projectors: ProjectorOpticsInstance[],
  uRanges?: [number, number][],
): ProjectorSpec[] {
  return projectors
    .filter((p) => p.enabled)
    .map((p, idx) => {
      const lens: Vec3 = [p.posIn[0] / 12, p.posIn[1] / 12, p.posIn[2] / 12];
      const view = projectorViewMatrix({ lens, rotDeg: p.rotDeg });
      const proj = projectorProjectionMatrix({
        throwRatio: p.throwRatio,
        aspectW: p.aspectW,
        aspectH: p.aspectH,
        lensShiftPct: p.lensShiftPct,
        lensShiftXPct: p.lensShiftXPct,
        lensOrigin: p.lensOrigin,
      });
      const texture = multiplyMat4(biasMatrix(), multiplyMat4(proj, view));
      return {
        lens,
        viewMatrix: view,
        projMatrix: proj,
        textureMatrix: texture,
        contentSlice: uRanges?.[idx] ?? [0, 1],
        lumens: p.lumens,
        focusNearFt: Math.max(0.1, p.focusNearIn / 12),
        focusFarFt: p.focusFarIn / 12,
        fieldCurvatureFrac: fieldCurvatureFrac(p.throwRatio),
      };
    });
}

export function pointIlluminance(
  surfacePos: Vec3,
  surfaceNormal: Vec3,
  lensPos: Vec3,
  lumens: number,
  nominalAreaSqFt: number,
  nominalDistFt: number,
): number {
  const dx = lensPos[0] - surfacePos[0];
  const dy = lensPos[1] - surfacePos[1];
  const dz = lensPos[2] - surfacePos[2];
  const r = Math.hypot(dx, dy, dz);
  if (r <= 0 || nominalAreaSqFt <= 0) return 0;
  const dir: Vec3 = [dx / r, dy / r, dz / r];
  const cosIncidence = Math.max(
    0,
    surfaceNormal[0] * dir[0] + surfaceNormal[1] * dir[1] + surfaceNormal[2] * dir[2],
  );
  const nominalFc = lumens / nominalAreaSqFt;
  const distFactor = (nominalDistFt * nominalDistFt) / (r * r);
  return nominalFc * distFactor * cosIncidence;
}

export function blendWeight(uProj: number, sliceMin: number, sliceMax: number, overlapFrac: number): number {
  if (uProj < 0 || uProj > 1) return 0;
  const span = sliceMax - sliceMin;
  if (span <= 0 || overlapFrac <= 0) return 1;
  let weight = 1;
  if (sliceMin > 0.001) {
    const t = Math.min(1, Math.max(0, uProj / overlapFrac));
    weight *= t * t * (3 - 2 * t);
  }
  if (sliceMax < 0.999) {
    const t = Math.min(1, Math.max(0, (1 - uProj) / overlapFrac));
    weight *= t * t * (3 - 2 * t);
  }
  return weight;
}
