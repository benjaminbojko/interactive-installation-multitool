// Pure optics & 4x4 matrix math for 3D projection canvases. No React, no Three.js.
// World units are FEET. Matrices are 16-element column-major numbers matching WebGL.

import type { Vec3, LensOrigin } from './projectionMath';

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
  tiltDeg: number;
}

export function projectorViewMatrix(pose: ProjectorPose): Mat4 {
  const tilt = (pose.tiltDeg * Math.PI) / 180;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const [lx, ly, lz] = pose.lens;
  return [
    1, 0, 0, 0,
    0, cosT, -sinT, 0,
    0, sinT, cosT, 0,
    -lx, -(ly * cosT + lz * sinT), -(-ly * sinT + lz * cosT), 1,
  ];
}

export interface ProjectorIntrinsics {
  throwRatio: number;
  aspectW: number;
  aspectH: number;
  lensShiftPct: number;
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
  const n = i.nearFt ?? 0.5;
  const f = i.farFt ?? 500;
  const invD = 1 / (f - n);
  return [
    1 / tanX, 0, 0, 0,
    0, 1 / tanY, 0, 0,
    0, shiftY / tanY, -(f + n) * invD, -1,
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
