import { describe, expect, it } from 'vitest';
import { createDefaultProjector, withAutoFocus, type ProjectorInstance } from './projectorConfig';
import { depthOfFocusIn } from './focusOptics';

describe('withAutoFocus', () => {
  it('recomputes a non-zero band for a projector placed behind the origin and yawed to face back', () => {
    // A freeform projector at negative Z, rotated 180° around Y to aim back
    // into the scene — posIn[2]'s sign reflects placement, not throw distance.
    const p: ProjectorInstance = {
      ...createDefaultProjector('proj-yawed', 'Yawed', [0, 90, -180]),
      rotDeg: [0, 180, 0],
    };
    const out = withAutoFocus(p, true);
    expect(out.focusNearIn).toBeGreaterThan(0);
    expect(out.focusFarIn).toBeGreaterThan(out.focusNearIn);
  });

  it('gives the same band for +Z and -Z placements of the same magnitude', () => {
    const forward = withAutoFocus(createDefaultProjector('a', 'A', [0, 90, 180]), true);
    const backward = withAutoFocus(createDefaultProjector('b', 'B', [0, 90, -180]), true);
    expect(backward.focusNearIn).toBeCloseTo(forward.focusNearIn, 6);
    expect(backward.focusFarIn).toBeCloseTo(forward.focusFarIn, 6);
  });

  it('leaves the projector unchanged when auto is off', () => {
    const p: ProjectorInstance = {
      ...createDefaultProjector('proj-manual', 'Manual', [0, 90, 180]),
      focusNearIn: 42,
      focusFarIn: 99,
    };
    const out = withAutoFocus(p, false);
    expect(out.focusNearIn).toBe(42);
    expect(out.focusFarIn).toBe(99);
  });

  it('uses a raycast-derived throwDistanceInOverride instead of posIn[2] when given', () => {
    // A projector rotated to aim at a surface much closer than its raw Z
    // position — e.g. tilted down at a nearby floor instead of the far wall
    // implied by posIn[2]. Without the override, the band would be computed
    // for the wrong (much longer) distance.
    const p = createDefaultProjector('proj-rotated', 'Rotated', [0, 90, 360]);
    const viaPosIn = withAutoFocus(p, true);
    const viaOverride = withAutoFocus(p, true, 60);

    const expected = depthOfFocusIn(p.throwRatio, 60, p.resW);
    expect(viaOverride.focusNearIn).toBeCloseTo(expected.nearIn, 6);
    expect(viaOverride.focusFarIn).toBeCloseTo(expected.farIn, 6);
    expect(viaOverride.focusNearIn).not.toBeCloseTo(viaPosIn.focusNearIn, 1);
  });

  it('ignores the override when auto is off', () => {
    const p: ProjectorInstance = {
      ...createDefaultProjector('proj-manual-2', 'Manual 2', [0, 90, 180]),
      focusNearIn: 42,
      focusFarIn: 99,
    };
    const out = withAutoFocus(p, false, 12);
    expect(out.focusNearIn).toBe(42);
    expect(out.focusFarIn).toBe(99);
  });
});
