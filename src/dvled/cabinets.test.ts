import { describe, expect, it } from 'vitest';
import { MM_PER_IN } from '../ergonomics/constants';
import {
  buildFromGrid,
  buildFromSize,
  cabinetLabel,
  CABINET_PRESETS,
  panelPixels,
  type CabinetSpec,
} from './cabinets';

const SQ500: CabinetSpec = { label: '500', wMm: 500, hMm: 500 };

describe('panelPixels', () => {
  it('snaps a 500 mm cabinet to the real product pixel counts', () => {
    // The pitches the industry quotes vs. what the cabinet actually carries.
    const cases: [number, number][] = [
      [1.25, 400],
      [1.5, 333], // 500/1.5 = 333.3 → 333
      [1.9, 263],
      [2.5, 200],
      [2.6, 192],
      [3.9, 128],
      [5.2, 96],
    ];
    for (const [nominal, px] of cases) {
      expect(panelPixels(SQ500, nominal).pxPerCabX).toBe(px);
    }
  });

  it('reports the true pitch the whole-pixel count implies', () => {
    const p = panelPixels(SQ500, 2.6);
    expect(p.pxPerCabX).toBe(192);
    expect(p.pitchMm).toBeCloseTo(2.604, 3);
    expect(p.anisotropic).toBe(false);
  });

  it('keeps a square pitch on a non-square cabinet', () => {
    const p = panelPixels({ label: 'tall', wMm: 500, hMm: 1000 }, 2.5);
    expect(p.pxPerCabX).toBe(200);
    expect(p.pxPerCabY).toBe(400);
    expect(p.anisotropic).toBe(false);
  });

  it('flags a cabinet whose height is not a whole multiple of the pitch', () => {
    // 337.5 mm at P2.5 → 135 exactly; at P4 → 500/4 = 125 px → pitch 4,
    // 337.5/4 = 84.4 → 84 px → 4.018 mm, off by 0.45% (still under 1%).
    // A deliberately awkward one:
    const p = panelPixels({ label: 'odd', wMm: 500, hMm: 111 }, 20);
    expect(p.anisotropic).toBe(true);
  });

  it('never returns a zero or fractional pixel count', () => {
    for (const pitch of [0, -1, NaN, 1e6]) {
      const p = panelPixels(SQ500, pitch);
      expect(Number.isInteger(p.pxPerCabX)).toBe(true);
      expect(p.pxPerCabX).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(p.pitchMm)).toBe(true);
    }
  });
});

describe('buildFromSize', () => {
  it('rounds the cabinet count UP so the build is never short', () => {
    for (const cab of CABINET_PRESETS) {
      for (const wIn of [12, 37.4, 100, 143.8, 201.9, 400]) {
        for (const hIn of [9, 22.1, 80.9, 150.5]) {
          const b = buildFromSize(wIn, hIn, cab, 2.5);
          expect(b.builtWidthIn).toBeGreaterThanOrEqual(wIn - 1e-9);
          expect(b.builtHeightIn).toBeGreaterThanOrEqual(hIn - 1e-9);
          expect(b.overshootWidthIn).toBeGreaterThanOrEqual(0);
          expect(b.overshootHeightIn).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('fits the 12 ft lobby wall onto an 8 × 5 grid of 500 mm cabinets', () => {
    // 165" 16:9 → 143.8 × 80.9 in → 3653 × 2055 mm.
    const wIn = (165 * 16) / Math.hypot(16, 9);
    const hIn = (165 * 9) / Math.hypot(16, 9);
    const b = buildFromSize(wIn, hIn, SQ500, 2.5);
    expect(b.cols).toBe(8);
    expect(b.rows).toBe(5);
    expect(b.totalCabinets).toBe(40);
    expect(b.builtWidthIn).toBeCloseTo(4000 / MM_PER_IN, 6);
    expect(b.totalPxX).toBe(1600);
    expect(b.totalPxY).toBe(1000);
  });

  it('keeps the resolution an exact multiple of the per-cabinet count', () => {
    for (const cab of CABINET_PRESETS) {
      for (const pitch of [1.2, 1.5, 2.5, 2.6, 3.9, 6]) {
        const b = buildFromSize(120, 68, cab, pitch);
        expect(b.totalPxX).toBe(b.cols * b.pxPerCabX);
        expect(b.totalPxY).toBe(b.rows * b.pxPerCabY);
        expect(Number.isInteger(b.totalPxX)).toBe(true);
        expect(Number.isInteger(b.totalPxY)).toBe(true);
      }
    }
  });

  it('survives degenerate input without hanging or going non-finite', () => {
    const cases: [number, number, CabinetSpec, number][] = [
      [0, 0, SQ500, 2.5],
      [-5, -5, SQ500, 2.5],
      [NaN, NaN, SQ500, 2.5],
      [100, 60, { label: 'zero', wMm: 0, hMm: 0 }, 2.5],
      [1e9, 1e9, SQ500, 0],
      [100, 60, { label: 'tiny', wMm: 0.001, hMm: 0.001 }, 2.5],
    ];
    for (const [w, h, cab, pitch] of cases) {
      const b = buildFromSize(w, h, cab, pitch);
      expect(Number.isFinite(b.builtWidthIn)).toBe(true);
      expect(Number.isFinite(b.builtHeightIn)).toBe(true);
      expect(b.cols).toBeGreaterThanOrEqual(1);
      expect(b.rows).toBeGreaterThanOrEqual(1);
      expect(b.cols).toBeLessThanOrEqual(200);
      expect(b.rows).toBeLessThanOrEqual(200);
    }
  });
});

describe('buildFromGrid', () => {
  it('produces an exact size with no overshoot', () => {
    const b = buildFromGrid(10, 6, SQ500, 2.5);
    expect(b.builtWidthIn).toBeCloseTo(5000 / MM_PER_IN, 6);
    expect(b.builtHeightIn).toBeCloseTo(3000 / MM_PER_IN, 6);
    expect(b.overshootWidthIn).toBe(0);
    expect(b.overshootHeightIn).toBe(0);
    expect(b.totalPxX).toBe(2000);
    expect(b.totalPxY).toBe(1200);
  });

  it('round-trips through buildFromSize', () => {
    for (const cab of CABINET_PRESETS) {
      for (const [c, r] of [[1, 1], [3, 2], [8, 5], [17, 11]]) {
        const g = buildFromGrid(c, r, cab, 2.5);
        const s = buildFromSize(g.builtWidthIn, g.builtHeightIn, cab, 2.5);
        expect(s.cols).toBe(c);
        expect(s.rows).toBe(r);
      }
    }
  });

  it('clamps a nonsense count instead of trusting it', () => {
    expect(buildFromGrid(0, 0, SQ500, 2.5).cols).toBe(1);
    expect(buildFromGrid(1e6, 1e6, SQ500, 2.5).cols).toBe(200);
    expect(buildFromGrid(NaN, NaN, SQ500, 2.5).rows).toBe(1);
  });
});

describe('cabinetLabel', () => {
  it('reads like a spreadsheet', () => {
    expect(cabinetLabel(0, 0)).toBe('A1');
    expect(cabinetLabel(3, 2)).toBe('D3');
    expect(cabinetLabel(25, 0)).toBe('Z1');
    expect(cabinetLabel(26, 0)).toBe('AA1');
  });
});
