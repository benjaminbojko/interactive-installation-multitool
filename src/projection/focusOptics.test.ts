import { describe, expect, it } from 'vitest';
import {
  chipSpecForResW,
  depthOfFocusIn,
  fieldCurvatureFrac,
  FIELD_CURVATURE_MAX_FRAC,
  focusBandAtFieldRadius,
  type FocusBand,
} from './focusOptics';

describe('chipSpecForResW', () => {
  it('1080p-class resolution (1920) uses the 0.65" DMD chip spec', () => {
    const chip = chipSpecForResW(1920);
    expect(chip.chipWidthMm).toBeCloseTo(14.0, 6);
    expect(chip.pixelPitchMm).toBeCloseTo(14.0 / 1920, 6);
  });

  it('4K UHD-class resolution (3840) uses the 0.47" DMD chip spec', () => {
    const chip = chipSpecForResW(3840);
    expect(chip.chipWidthMm).toBeCloseTo(15.36, 6);
    expect(chip.pixelPitchMm).toBeCloseTo(15.36 / 3840, 6);
  });

  it('buckets 2999 and 3000 into different chip classes', () => {
    const below = chipSpecForResW(2999);
    const at = chipSpecForResW(3000);
    expect(below.chipWidthMm).toBeCloseTo(14.0, 6);
    expect(at.chipWidthMm).toBeCloseTo(15.36, 6);
    expect(below.chipWidthMm).not.toBe(at.chipWidthMm);
  });
});

describe('depthOfFocusIn', () => {
  it('matches hand-verified near/far for a 1.5:1 throw ratio at 15ft', () => {
    const { nearIn, farIn } = depthOfFocusIn(1.5, 180, 1920);
    expect(nearIn).toBeCloseTo(154.3, 0);
    expect(farIn).toBeCloseTo(215.9, 0);
  });

  it('brackets the nominal throw distance across a spread of configs', () => {
    const combos: Array<[number, number, number]> = [
      [0.37, 120, 1920],
      [0.9, 150, 1920],
      [1.2, 200, 3840],
      [1.5, 180, 1920],
      [2.5, 300, 1920],
    ];
    for (const [throwRatio, throwDistanceIn, resW] of combos) {
      const { nearIn, farIn } = depthOfFocusIn(throwRatio, throwDistanceIn, resW);
      expect(nearIn).toBeLessThan(throwDistanceIn);
      expect(farIn).toBeGreaterThan(throwDistanceIn);
    }
  });

  it('short throw has wider fractional tolerance than long throw', () => {
    const short = depthOfFocusIn(0.4, 200, 1920);
    const long = depthOfFocusIn(2.5, 200, 1920);
    const shortFrac = (short.farIn - short.nearIn) / 200;
    const longFrac = (long.farIn - long.nearIn) / 200;
    expect(shortFrac).toBeGreaterThan(longFrac);
  });

  it('stays finite and respects the far-side ceiling past the hyperfocal distance', () => {
    const { farIn } = depthOfFocusIn(0.37, 400, 1920);
    expect(Number.isFinite(farIn)).toBe(true);
    expect(farIn).toBeLessThanOrEqual(400 * 10);
  });

  it('never returns a negative near limit for extreme short-throw configs', () => {
    const { nearIn } = depthOfFocusIn(0.1, 5, 1920);
    expect(nearIn).toBeGreaterThanOrEqual(0);
  });

  it('returns a zero band for zero or negative throw distance', () => {
    expect(depthOfFocusIn(1.5, 0, 1920)).toEqual({ nearIn: 0, farIn: 0 });
    expect(depthOfFocusIn(1.5, -50, 1920)).toEqual({ nearIn: 0, farIn: 0 });
  });

  it('a custom F-number changes the resulting band', () => {
    const wide = depthOfFocusIn(1.5, 180, 1920, 2.2);
    const narrow = depthOfFocusIn(1.5, 180, 1920, 4.0);
    expect(wide.nearIn).not.toBeCloseTo(narrow.nearIn, 3);
  });
});

describe('fieldCurvatureFrac', () => {
  it('is close to 0.9 at the anchor throw ratio (0.37)', () => {
    expect(fieldCurvatureFrac(0.37)).toBeCloseTo(0.9, 2);
  });

  it('is small and positive for a long throw ratio', () => {
    const frac = fieldCurvatureFrac(2.5);
    expect(frac).toBeLessThan(0.05);
    expect(frac).toBeGreaterThan(0);
  });

  it('decreases monotonically as throw ratio grows', () => {
    const a = fieldCurvatureFrac(0.37);
    const b = fieldCurvatureFrac(0.9);
    const c = fieldCurvatureFrac(1.5);
    const d = fieldCurvatureFrac(2.5);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBeGreaterThan(d);
  });

  it('is clamped at the ceiling below the anchor throw ratio', () => {
    expect(fieldCurvatureFrac(0.2)).toBeLessThanOrEqual(FIELD_CURVATURE_MAX_FRAC);
  });

  it('returns the ceiling exactly for zero or negative throw ratio', () => {
    expect(fieldCurvatureFrac(0)).toBe(FIELD_CURVATURE_MAX_FRAC);
    expect(fieldCurvatureFrac(-1)).toBe(FIELD_CURVATURE_MAX_FRAC);
  });
});

describe('focusBandAtFieldRadius', () => {
  const band: FocusBand = { nearIn: 100, farIn: 200 };

  it('returns the input band unchanged at the image center (radius 0)', () => {
    const out = focusBandAtFieldRadius(band, 0.9, 0);
    expect(out.nearIn).toBeCloseTo(band.nearIn, 6);
    expect(out.farIn).toBeCloseTo(band.farIn, 6);
  });

  it('shrinks to ~10% of the input width at the corner (radius = maxRadius)', () => {
    const inputWidth = band.farIn - band.nearIn;
    const out = focusBandAtFieldRadius(band, 0.9, Math.SQRT2);
    const outputWidth = out.farIn - out.nearIn;
    expect(outputWidth).toBeCloseTo(inputWidth * 0.1, 1);
  });

  it('preserves the band midpoint at every field radius', () => {
    const inputMid = (band.nearIn + band.farIn) / 2;
    for (const radius of [0, 0.5, 1, Math.SQRT2]) {
      const out = focusBandAtFieldRadius(band, 0.9, radius);
      expect((out.nearIn + out.farIn) / 2).toBeCloseTo(inputMid, 6);
    }
  });

  it('never inverts or collapses the band, even at max curvature and radius', () => {
    for (let radius = 0; radius <= Math.SQRT2; radius += 0.2) {
      const out = focusBandAtFieldRadius(band, 0.9, radius);
      expect(out.nearIn).toBeLessThan(out.farIn);
    }
  });

  it('composes with depthOfFocusIn/fieldCurvatureFrac to narrow the corner band', () => {
    const throwRatio = 0.37;
    const onAxis = depthOfFocusIn(throwRatio, 60, 1920);
    const corner = focusBandAtFieldRadius(onAxis, fieldCurvatureFrac(throwRatio), Math.SQRT2);
    const onAxisWidth = onAxis.farIn - onAxis.nearIn;
    const cornerWidth = corner.farIn - corner.nearIn;
    expect(cornerWidth).toBeLessThan(onAxisWidth);
  });
});
