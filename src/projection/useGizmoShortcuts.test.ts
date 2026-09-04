import { describe, expect, it } from 'vitest';
import { getActiveGizmoMode, getSnapValues } from './useGizmoShortcuts';

describe('getSnapValues', () => {
  it('returns null snaps when shift is not held', () => {
    const imperial = getSnapValues(false, false);
    expect(imperial.translationSnap).toBeNull();
    expect(imperial.rotationSnap).toBeNull();

    const metric = getSnapValues(true, false);
    expect(metric.translationSnap).toBeNull();
    expect(metric.rotationSnap).toBeNull();
  });

  it('snaps to 2 inches in imperial (2/12 ft) when shift is held', () => {
    const res = getSnapValues(false, true);
    expect(res.translationSnap).toBeCloseTo(2 / 12, 5);
    expect(res.rotationSnap).toBeCloseTo((5 * Math.PI) / 180, 5);
  });

  it('snaps to 5 cm in metric (5/30.48 ft) when shift is held', () => {
    const res = getSnapValues(true, true);
    expect(res.translationSnap).toBeCloseTo(5 / 30.48, 5);
    expect(res.rotationSnap).toBeCloseTo((5 * Math.PI) / 180, 5);
  });
});

describe('getActiveGizmoMode', () => {
  it('returns baseMode when ctrl is not held', () => {
    expect(getActiveGizmoMode('translate', false)).toBe('translate');
    expect(getActiveGizmoMode('rotate', false)).toBe('rotate');
  });

  it('toggles mode when ctrl is held', () => {
    expect(getActiveGizmoMode('translate', true)).toBe('rotate');
    expect(getActiveGizmoMode('rotate', true)).toBe('translate');
  });
});
