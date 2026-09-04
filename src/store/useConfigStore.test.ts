import { describe, expect, it } from 'vitest';
import { INITIAL, useConfigStore } from './useConfigStore';
import { depthOfFocusIn } from '../projection/focusOptics';

describe('useConfigStore.resetToDefaults', () => {
  it('resets modified scalar and complex properties back to defaults', () => {
    const store = useConfigStore.getState();
    store.set('diagonal', 98);
    store.set('projModelScale', 2.5);
    store.set('projModelUrl', 'blob:custom-model');
    store.set('appTab', 'projection');

    expect(useConfigStore.getState().diagonal).toBe(98);
    expect(useConfigStore.getState().projModelScale).toBe(2.5);
    expect(useConfigStore.getState().projModelUrl).toBe('blob:custom-model');
    expect(useConfigStore.getState().appTab).toBe('projection');

    useConfigStore.getState().resetToDefaults();

    const current = useConfigStore.getState();
    expect(current.diagonal).toBe(INITIAL.diagonal);
    expect(current.projModelScale).toBe(INITIAL.projModelScale);
    expect(current.projModelUrl).toBe(INITIAL.projModelUrl);
    expect(current.appTab).toBe(INITIAL.appTab);
    expect(current.projectors.length).toBe(INITIAL.projectors.length);
    expect(current.speakers.length).toBe(INITIAL.speakers.length);
  });
});

describe('useConfigStore.updateProjector', () => {
  it('does not recompute the focus band from posIn[2] when auto is on and no raycast override is given', () => {
    // Regression: ProjectorNode's drag handler and the manual position/
    // rotation fields both call updateProjector(id, {posIn, rotDeg}) with no
    // override. If that eagerly recomputed via withAutoFocus's Math.abs(
    // posIn[2]) fallback, it would flash that rotation-blind estimate for
    // one frame before useProjectorFocusRaycast's next tick corrects it —
    // this is what should NOT happen.
    useConfigStore.getState().resetToDefaults();
    const s = useConfigStore.getState();
    s.set('projFocusAuto', true);
    const id = s.projectors[0].id;
    const before = useConfigStore.getState().projectors.find((p) => p.id === id)!;

    s.updateProjector(id, { posIn: [0, 90, 60], rotDeg: [0, 90, 0] });

    const after = useConfigStore.getState().projectors.find((p) => p.id === id)!;
    expect(after.posIn).toEqual([0, 90, 60]);
    expect(after.rotDeg).toEqual([0, 90, 0]);
    expect(after.focusNearIn).toBe(before.focusNearIn);
    expect(after.focusFarIn).toBe(before.focusFarIn);
  });

  it('recomputes the focus band when a raycast throwDistanceInOverride is given', () => {
    useConfigStore.getState().resetToDefaults();
    const s = useConfigStore.getState();
    s.set('projFocusAuto', true);
    const id = s.projectors[0].id;

    s.updateProjector(id, {}, 60);

    const after = useConfigStore.getState().projectors.find((p) => p.id === id)!;
    const expected = depthOfFocusIn(after.throwRatio, 60, after.resW);
    expect(after.focusNearIn).toBeCloseTo(expected.nearIn, 6);
    expect(after.focusFarIn).toBeCloseTo(expected.farIn, 6);
  });

  it('leaves the focus band untouched when auto is off, override or not', () => {
    useConfigStore.getState().resetToDefaults();
    const s = useConfigStore.getState();
    s.set('projFocusAuto', false);
    const id = s.projectors[0].id;
    const before = useConfigStore.getState().projectors.find((p) => p.id === id)!;

    s.updateProjector(id, { posIn: [0, 90, 60] }, 60);

    const after = useConfigStore.getState().projectors.find((p) => p.id === id)!;
    expect(after.focusNearIn).toBe(before.focusNearIn);
    expect(after.focusFarIn).toBe(before.focusFarIn);
  });
});
