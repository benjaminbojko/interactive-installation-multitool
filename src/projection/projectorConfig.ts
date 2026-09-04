import type { LensOrigin } from './projectionMath';

export type TransformGizmoMode = 'translate' | 'rotate';
export type TransformGizmoSpace = 'world' | 'local';

export interface ProjectorInstance {
  id: string;
  name: string;
  enabled: boolean;
  // Position in INCHES [x, y, z]: x lateral, y height AFF, z throw distance
  posIn: [number, number, number];
  // Rotation in DEGREES [pitch, yaw, roll] (Euler XYZ)
  rotDeg: [number, number, number];
  throwRatio: number;
  lumens: number;
  aspectW: number;
  aspectH: number;
  resW: number;
  resH: number;
  lensShiftPct: number;
  lensOrigin: LensOrigin;
  // Near/far limits (INCHES, absolute distances from the lens) the image
  // stays acceptably sharp within. Peak sharpness is their midpoint — no
  // separate "focus distance" to keep in sync.
  focusNearIn: number;
  focusFarIn: number;
}

// Optical/output settings that describe the projector unit itself, not where
// it sits in the room. "Apply to all" copies these across instances; posIn,
// rotDeg, id, name, and enabled stay per-projector.
export const PROJECTOR_SHARED_KEYS = [
  'throwRatio',
  'lumens',
  'aspectW',
  'aspectH',
  'resW',
  'resH',
  'lensShiftPct',
  'lensOrigin',
  'focusNearIn',
  'focusFarIn',
] as const satisfies readonly (keyof ProjectorInstance)[];

export function createDefaultProjector(
  id: string,
  name: string,
  posIn: [number, number, number] = [0, 90, 180],
): ProjectorInstance {
  return {
    id,
    name,
    enabled: true,
    posIn,
    rotDeg: [0, 0, 0],
    throwRatio: 1.5,
    lumens: 4000,
    aspectW: 16,
    aspectH: 9,
    resW: 1920,
    resH: 1080,
    lensShiftPct: 0,
    lensOrigin: 'center',
    focusNearIn: posIn[2] * 0.85, // focused near the wall by default
    focusFarIn: posIn[2] * 1.25,
  };
}

export const INITIAL_PROJECTORS: ProjectorInstance[] = [
  createDefaultProjector('proj-1', 'Projector 1', [0, 90, 180]),
];

export function arrangeInArray(
  current: ProjectorInstance[],
  count: number,
  overlapPct: number,
  imageWidthIn: number,
  distanceIn: number,
  lensAffIn: number,
): ProjectorInstance[] {
  const overlapIn = (overlapPct / 100) * imageWidthIn;
  const stepX = imageWidthIn - overlapIn;
  const totalW = count * imageWidthIn - (count - 1) * overlapIn;
  const startX = -totalW / 2 + imageWidthIn / 2;

  const result: ProjectorInstance[] = [];
  for (let i = 0; i < count; i++) {
    const existing = current[i];
    const x = startX + i * stepX;
    if (existing) {
      result.push({
        ...existing,
        posIn: [x, lensAffIn, distanceIn],
        rotDeg: [0, 0, 0],
      });
    } else {
      const template = current[0] ?? createDefaultProjector(`proj-${i + 1}`, `Projector ${i + 1}`);
      result.push({
        ...template,
        id: `proj-${Date.now()}-${i}`,
        name: `Projector ${i + 1}`,
        posIn: [x, lensAffIn, distanceIn],
        rotDeg: [0, 0, 0],
      });
    }
  }
  return result;
}
