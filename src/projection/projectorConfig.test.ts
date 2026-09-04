import { describe, expect, it } from 'vitest';
import { createDefaultProjector, withAutoFocus, type ProjectorInstance } from './projectorConfig';

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
});
