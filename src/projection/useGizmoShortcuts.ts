import { useEffect, useState } from 'react';
import type { TransformGizmoMode } from './projectorConfig';

export function getSnapValues(isMetric: boolean, shiftHeld: boolean): {
  translationSnap: number | null;
  rotationSnap: number | null;
} {
  return {
    translationSnap: shiftHeld ? (isMetric ? 5 / 30.48 : 2 / 12) : null,
    rotationSnap: shiftHeld ? (5 * Math.PI) / 180 : null,
  };
}

export function getActiveGizmoMode(
  baseMode: TransformGizmoMode,
  ctrlHeld: boolean,
): TransformGizmoMode {
  return ctrlHeld ? (baseMode === 'translate' ? 'rotate' : 'translate') : baseMode;
}

export function useGizmoShortcuts(isMetric: boolean, baseMode: TransformGizmoMode) {
  const [shiftHeld, setShiftHeld] = useState(false);
  const [ctrlHeld, setCtrlHeld] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === 'Shift') setShiftHeld(true);
      if (e.key === 'Control' && !inInput) setCtrlHeld(true);
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Shift') setShiftHeld(false);
      if (e.key === 'Control') setCtrlHeld(false);
    }

    function onBlur() {
      setShiftHeld(false);
      setCtrlHeld(false);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const activeMode = getActiveGizmoMode(baseMode, ctrlHeld);
  const { translationSnap, rotationSnap } = getSnapValues(isMetric, shiftHeld);

  return { activeMode, translationSnap, rotationSnap, shiftHeld, ctrlHeld };
}
