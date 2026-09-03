import { describe, expect, it } from 'vitest';
import {
  biasMatrix,
  blendWeight,
  buildProjectorSpecs,
  identityMat4,
  multiplyMat4,
  pointIlluminance,
  projectorViewMatrix,
  transformPointMat4,
  unifiedProjectorMatrix,
  type ProjectorIntrinsics,
  type ProjectorPose,
} from './projectiveOptics';
import { frustumGeometry, type FrustumParams } from './projectionMath';

const intrinsics: ProjectorIntrinsics = {
  throwRatio: 1.5,
  aspectW: 16,
  aspectH: 9,
  lensShiftPct: 0,
  lensOrigin: 'center',
  nearFt: 0.5,
  farFt: 500,
};

const pose: ProjectorPose = {
  lens: [0, 7.5, 15],
  tiltDeg: 0,
};

const frustum: FrustumParams = {
  distanceIn: 180, // 15 ft
  throwRatio: 1.5,
  aspectW: 16,
  aspectH: 9,
  lensAffIn: 90, // 7.5 ft
  lensShiftPct: 0,
  lensOrigin: 'center',
  tiltDeg: 0,
};

describe('matrix utilities', () => {
  it('identity matrix preserves vectors', () => {
    const p: [number, number, number] = [3, -4, 5];
    const out = transformPointMat4(identityMat4(), p);
    expect(out[0]).toBeCloseTo(3, 6);
    expect(out[1]).toBeCloseTo(-4, 6);
    expect(out[2]).toBeCloseTo(5, 6);
  });

  it('bias matrix maps NDC [-1, 1] to UV [0, 1]', () => {
    const b = biasMatrix();
    const min = transformPointMat4(b, [-1, -1, -1]);
    expect(min[0]).toBeCloseTo(0, 6);
    expect(min[1]).toBeCloseTo(0, 6);
    expect(min[2]).toBeCloseTo(0, 6);

    const max = transformPointMat4(b, [1, 1, 1]);
    expect(max[0]).toBeCloseTo(1, 6);
    expect(max[1]).toBeCloseTo(1, 6);
    expect(max[2]).toBeCloseTo(1, 6);
  });

  it('multiplying by identity leaves matrix unchanged', () => {
    const v = projectorViewMatrix(pose);
    const id = identityMat4();
    const prod = multiplyMat4(v, id);
    for (let i = 0; i < 16; i++) {
      expect(prod[i]).toBeCloseTo(v[i], 6);
    }
  });
});

describe('unifiedProjectorMatrix', () => {
  it('transforms the 4 frustum corners on flat wall to [0, 1] UV bounds', () => {
    const g = frustumGeometry(frustum);
    const m = unifiedProjectorMatrix(pose, intrinsics);

    const tl = transformPointMat4(m, g.topLeft);
    expect(tl[0]).toBeCloseTo(0, 4);
    expect(tl[1]).toBeCloseTo(1, 4);

    const tr = transformPointMat4(m, g.topRight);
    expect(tr[0]).toBeCloseTo(1, 4);
    expect(tr[1]).toBeCloseTo(1, 4);

    const br = transformPointMat4(m, g.bottomRight);
    expect(br[0]).toBeCloseTo(1, 4);
    expect(br[1]).toBeCloseTo(0, 4);

    const bl = transformPointMat4(m, g.bottomLeft);
    expect(bl[0]).toBeCloseTo(0, 4);
    expect(bl[1]).toBeCloseTo(0, 4);

    const center = transformPointMat4(m, [0, 7.5, 0]);
    expect(center[0]).toBeCloseTo(0.5, 4);
    expect(center[1]).toBeCloseTo(0.5, 4);
  });

  it('correctly maps corners under vertical lens shift', () => {
    const shiftFrustum: FrustumParams = { ...frustum, lensShiftPct: 50 };
    const shiftIntrinsics: ProjectorIntrinsics = { ...intrinsics, lensShiftPct: 50 };
    const g = frustumGeometry(shiftFrustum);
    const m = unifiedProjectorMatrix(pose, shiftIntrinsics);

    const tl = transformPointMat4(m, g.topLeft);
    expect(tl[0]).toBeCloseTo(0, 4);
    expect(tl[1]).toBeCloseTo(1, 4);

    const br = transformPointMat4(m, g.bottomRight);
    expect(br[0]).toBeCloseTo(1, 4);
    expect(br[1]).toBeCloseTo(0, 4);
  });

  it('correctly maps keystoned corners under tilt', () => {
    const tiltFrustum: FrustumParams = { ...frustum, tiltDeg: 12 };
    const tiltPose: ProjectorPose = { ...pose, tiltDeg: 12 };
    const g = frustumGeometry(tiltFrustum);
    const m = unifiedProjectorMatrix(tiltPose, intrinsics);

    const tl = transformPointMat4(m, g.topLeft);
    expect(tl[0]).toBeCloseTo(0, 4);
    expect(tl[1]).toBeCloseTo(1, 4);

    const br = transformPointMat4(m, g.bottomRight);
    expect(br[0]).toBeCloseTo(1, 4);
    expect(br[1]).toBeCloseTo(0, 4);
  });
});

describe('multi-projector specs & edge blend', () => {
  it('buildProjectorSpecs generates per-projector transforms', () => {
    const specs = buildProjectorSpecs(
      [-4, 4],
      15,
      7.5,
      0,
      intrinsics,
      [
        [0, 0.6],
        [0.4, 1],
      ],
    );
    expect(specs).toHaveLength(2);
    expect(specs[0].lens[0]).toBe(-4);
    expect(specs[1].lens[0]).toBe(4);
    expect(specs[0].contentSlice).toEqual([0, 0.6]);
    expect(specs[1].contentSlice).toEqual([0.4, 1]);
  });

  it('blendWeight smoothstep ramps in overlap zone and sums to 1.0', () => {
    const overlapFrac = 0.2;
    // Left projector covering [0, 0.6] (right edge ramps down from u=0.8 to 1.0 in projector space)
    // Right projector covering [0.4, 1] (left edge ramps up from u=0 to 0.2 in projector space)
    const midLeft = blendWeight(0.9, 0, 0.6, overlapFrac);
    const midRight = blendWeight(0.1, 0.4, 1, overlapFrac);
    expect(midLeft + midRight).toBeCloseTo(1.0, 5);

    // Deep inside non-overlapping core
    expect(blendWeight(0.5, 0, 0.6, overlapFrac)).toBe(1.0);
    // Outside projector aperture
    expect(blendWeight(-0.1, 0, 0.6, overlapFrac)).toBe(0);
    expect(blendWeight(1.1, 0, 0.6, overlapFrac)).toBe(0);
  });
});

describe('pointIlluminance 3D falloff', () => {
  const nominalArea = 10 * 5.625; // 56.25 sq ft
  const nominalDist = 15; // ft
  const lumens = 4000;
  const nominalFc = lumens / nominalArea;

  it('on-axis normal at nominal distance equals nominal foot-candles', () => {
    const fc = pointIlluminance(
      [0, 7.5, 0],
      [0, 0, 1],
      [0, 7.5, 15],
      lumens,
      nominalArea,
      nominalDist,
    );
    expect(fc).toBeCloseTo(nominalFc, 4);
  });

  it('grazing angle obeys Lambertian cosine law', () => {
    // 60 deg incidence: cos(60) = 0.5
    const angleRad = (60 * Math.PI) / 180;
    const normal: [number, number, number] = [Math.sin(angleRad), 0, Math.cos(angleRad)];
    const fc = pointIlluminance(
      [0, 7.5, 0],
      normal,
      [0, 7.5, 15],
      lumens,
      nominalArea,
      nominalDist,
    );
    expect(fc).toBeCloseTo(nominalFc * 0.5, 4);
  });

  it('backfaces receive zero illuminance', () => {
    const backNormal: [number, number, number] = [0, 0, -1];
    const fc = pointIlluminance(
      [0, 7.5, 0],
      backNormal,
      [0, 7.5, 15],
      lumens,
      nominalArea,
      nominalDist,
    );
    expect(fc).toBe(0);
  });

  it('inverse-square dropoff at double distance yields 1/4 illuminance', () => {
    const fc = pointIlluminance(
      [0, 7.5, 0],
      [0, 0, 1],
      [0, 7.5, 30], // 30 ft throw vs 15 ft nominal
      lumens,
      nominalArea,
      nominalDist,
    );
    expect(fc).toBeCloseTo(nominalFc * 0.25, 4);
  });
});
