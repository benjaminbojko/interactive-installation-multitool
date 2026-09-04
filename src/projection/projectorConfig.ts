import type { LensOrigin } from './projectionMath';
import { depthOfFocusIn } from './focusOptics';

export type TransformGizmoMode = 'translate' | 'rotate';
export type TransformGizmoSpace = 'world' | 'local';
// 'parametric': position/rotation come from throw distance, lens height, tilt,
// and array layout math. 'freeform': the 3D gizmo and manual fields own the
// transform directly — the parametric fields stop writing to it.
export type ProjGeometryMode = 'parametric' | 'freeform';

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
  lensShiftXPct: number; // horizontal shift, % of half image width; +right/−left (Freeform only)
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
  'lensShiftXPct',
  'lensOrigin',
  'focusNearIn',
  'focusFarIn',
] as const satisfies readonly (keyof ProjectorInstance)[];

// If auto is on, recomputes focusNearIn/focusFarIn from the projector's own
// throwRatio/resW and a throw distance; otherwise returns it unchanged.
// `auto` is a single global setting (all projectors assumed to share the
// same lens/focal-range behavior — see projFocusAuto in useConfigStore.ts),
// not per-instance. Single source of truth for auto-focus, applied
// everywhere a projector's throw ratio, distance, or resolution can change
// (updateProjector, array layout, new-projector creation) so the toggle
// stays correct regardless of entry point.
//
// `throwDistanceInOverride`, when given, is the real geometric distance from
// the lens to whatever the projector is actually aimed at — computed by
// raycasting against the live canvas mesh (see useProjectorFocusRaycast.ts),
// which is the only thing that stays correct once the projector is rotated
// or aimed at a non-planar surface. Falls back to posIn[2] (correct only for
// an unrotated projector facing a flat surface at z=0) when no raycast hit is
// available yet — e.g. before the canvas mesh has mounted/loaded.
export function withAutoFocus(
  p: ProjectorInstance,
  auto: boolean,
  throwDistanceInOverride?: number,
): ProjectorInstance {
  if (!auto) return p;
  // posIn[2]'s sign reflects which side of the origin the projector sits on
  // (e.g. a freeform unit placed behind the scene and yawed 180° to face back
  // in), not whether the throw distance is valid — take the magnitude.
  const throwDistanceIn = throwDistanceInOverride ?? Math.abs(p.posIn[2]);
  const focus = depthOfFocusIn(p.throwRatio, throwDistanceIn, p.resW);
  return { ...p, focusNearIn: focus.nearIn, focusFarIn: focus.farIn };
}

export function createDefaultProjector(
  id: string,
  name: string,
  posIn: [number, number, number] = [0, 90, 180],
): ProjectorInstance {
  // A fresh projector always starts with a correctly computed band, regardless
  // of the global auto-focus setting — that toggle governs recalculation on
  // later changes, not this initial value.
  return withAutoFocus(
    {
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
      lensShiftXPct: 0,
      lensOrigin: 'center',
      focusNearIn: 0,
      focusFarIn: 0,
    },
    true,
  );
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
  focusAuto: boolean,
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
      result.push(
        withAutoFocus(
          {
            ...existing,
            posIn: [x, lensAffIn, distanceIn],
            rotDeg: [0, 0, 0],
          },
          focusAuto,
        ),
      );
    } else {
      const template = current[0] ?? createDefaultProjector(`proj-${i + 1}`, `Projector ${i + 1}`);
      result.push(
        withAutoFocus(
          {
            ...template,
            id: `proj-${Date.now()}-${i}`,
            name: `Projector ${i + 1}`,
            posIn: [x, lensAffIn, distanceIn],
            rotDeg: [0, 0, 0],
          },
          focusAuto,
        ),
      );
    }
  }
  return result;
}
