import { describe, expect, it } from 'vitest';
import { getFrameloopState } from './useFrameloop';

describe('useFrameloop', () => {
  it('returns demand mode when visible', () => {
    expect(getFrameloopState(false)).toBe('demand');
  });

  it('returns never mode when hidden', () => {
    expect(getFrameloopState(true)).toBe('never');
  });
});
