import { describe, expect, it } from 'vitest';
import { INITIAL, useConfigStore } from './useConfigStore';

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
