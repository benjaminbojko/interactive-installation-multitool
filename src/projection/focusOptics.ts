// Projector depth-of-focus + field-curvature optics. No React, no Three.js —
// pure math, same convention as projectionMath.ts / projectiveOptics.ts.
//
// Projector spec sheets don't publish aperture, circle-of-confusion, or a
// Petzval sum, so none of this can be pulled from a datasheet directly. What
// follows instead grounds each constant in either real catalog data (F-number)
// or published derivations (the reversed-camera DOF formula, Petzval field
// curvature), then approximates the rest. It replaces an earlier hardcoded,
// backwards percentage table with something a reader can trace back to a source.

/**
 * Representative projector lens F-number. Real G-lens catalogs (e.g. Barco's
 * 0.65–0.75:1 and 0.75–0.95:1 throw lenses) sit at roughly F/2.0–2.5 across
 * their whole throw-ratio range — lenses don't vary aperture enough to
 * meaningfully offset the focal-length-squared term in the DOF formula below,
 * so a single constant stands in for "look up this lens's actual F-number."
 */
export const DEFAULT_F_NUMBER = 2.2;

/** DMD chip dimensions used to derive focal length and circle of confusion. */
export interface ChipSpec {
  /** Active imaging area width, mm. */
  chipWidthMm: number;
  /** Pixel (micromirror) pitch, mm/pixel. */
  pixelPitchMm: number;
}

/**
 * Picks a representative DMD chip size from the panel's horizontal resolution.
 *
 * DMD chips come in a handful of discrete standard sizes — they don't scale
 * continuously with resolution — so this buckets by resolution class rather
 * than modeling the user's actual (unspecified) chip hardware:
 *  - 4K UHD class (resW >= 3000): TI's 0.47" 4K UHD DMD, ~15.36mm active
 *    width, ~2.7µm mirror pitch (TI DLP470TE-family datasheet).
 *  - 1080p/lower class: TI's 0.65" DMD, ~14.0mm active width, ~7.6µm pitch
 *    at 1920 wide.
 */
export function chipSpecForResW(resW: number): ChipSpec {
  if (resW >= 3000) {
    return { chipWidthMm: 15.36, pixelPitchMm: 15.36 / resW };
  }
  return { chipWidthMm: 14.0, pixelPitchMm: 14.0 / resW };
}

/** Near/far limits of the acceptably-sharp band, inches from the lens. */
export interface FocusBand {
  nearIn: number;
  farIn: number;
}

/**
 * Projector depth of focus, near/far distance the image stays acceptably
 * sharp, in inches.
 *
 * Derived from the reversed-camera depth-of-focus formula documented in
 * optics/patent literature (e.g. USPTO 9606369-style projector DOF
 * derivations): the DMD/LCoS panel plays the role of the camera "sensor" and
 * its pixel pitch stands in for the permissible circle of confusion, while
 * the screen plays the role of the "subject" at the throw distance.
 */
export function depthOfFocusIn(
  throwRatio: number,
  throwDistanceIn: number,
  resW: number,
  fNumber: number = DEFAULT_F_NUMBER,
): FocusBand {
  if (throwDistanceIn <= 0) return { nearIn: 0, farIn: 0 };

  const chip = chipSpecForResW(resW);
  const f = throwRatio * chip.chipWidthMm; // focal length, mm
  const s = throwDistanceIn * 25.4; // throw distance, mm
  const k = chip.pixelPitchMm * fNumber; // circle-of-confusion x F-number term

  const Lf = (k * s * s) / (f * f + k * s); // near-side allowance, mm
  // Floor the far-side denominator instead of letting it hit/cross zero —
  // beyond the hyperfocal distance the formula's far limit runs to infinity.
  const farDenom = Math.max(f * f - k * s, f * f * 1e-6);
  const Lr = (k * s * s) / farDenom; // far-side allowance, mm

  const nearIn = Math.max(0, (s - Lf) / 25.4);
  const farInRaw = (s + Lr) / 25.4;
  // Hard ceiling so the value stays finite/sane for both a numeric UI input
  // and a GLSL float uniform even when the projector sits at or past its
  // hyperfocal distance (common for ultra-short-throw lenses).
  const farIn = Math.min(farInRaw, throwDistanceIn * 10);

  return { nearIn, farIn };
}

/** Floor and ceiling on the field-curvature edge-tolerance shrink fraction. */
export const FIELD_CURVATURE_MAX_FRAC = 0.9;

// Anchor: at throwRatio = 0.37 (a typical ultra-short-throw lens), curvature
// shrinks the edge-of-frame focus tolerance by ~90% relative to on-axis.
export const FIELD_CURVATURE_K = FIELD_CURVATURE_MAX_FRAC * 0.37 * 0.37;

/**
 * Fraction by which field curvature shrinks the focus band at the extreme
 * corner of the frame, for a given throw ratio.
 *
 * Models Petzval field curvature: a real lens aberration that worsens for
 * wide-angle (short throw ratio) designs, growing with the square of field
 * angle/image height per standard optics literature, and reported
 * specifically for ultra-short-throw projectors as collapsing focus depth to
 * "only a few centimeters in the periphery" even though the on-axis depth of
 * focus is generous. No vendor publishes a per-lens Petzval sum, so this is a
 * literature-grounded approximation calibrated at one anchor point (see
 * FIELD_CURVATURE_K) rather than a lookup of a real lens design.
 *
 * FIELD_CURVATURE_MAX_FRAC doubles as a floor: a corner band never shrinks
 * below 10% of its on-axis width, however short the throw ratio.
 */
export function fieldCurvatureFrac(throwRatio: number): number {
  if (throwRatio <= 0) return FIELD_CURVATURE_MAX_FRAC;
  const frac = FIELD_CURVATURE_K / (throwRatio * throwRatio);
  return Math.min(FIELD_CURVATURE_MAX_FRAC, Math.max(0, frac));
}

/**
 * Narrows an on-axis focus band toward its midpoint at a given normalized
 * field radius, modeling Petzval field curvature growing with image-height
 * squared. `radius` is 0 at image center; `maxRadius` (default Math.SQRT2)
 * is the frame corner, matching UV-space corners at
 * `length((uv - 0.5) * 2)`.
 *
 * Symmetric around the on-axis midpoint by construction, and — because
 * `curvFrac` is clamped to at most FIELD_CURVATURE_MAX_FRAC (0.9) and `t*t`
 * is at most 1 — the shrink factor never reaches 1, so `nearIn` can never
 * cross `farIn` or collapse the band to zero width.
 *
 * This is a CPU-testable mirror of an equivalent GLSL helper of the same
 * name/shape to be added to projectiveMaterial.ts; keep the two in sync by
 * eye if either changes, matching the existing focusColor()/focusGradientCss()
 * convention between projectiveMaterial.ts and projectionMath.ts.
 */
export function focusBandAtFieldRadius(
  band: FocusBand,
  curvFrac: number,
  radius: number,
  maxRadius: number = Math.SQRT2,
): FocusBand {
  const t = Math.min(1, Math.max(0, radius / maxRadius));
  const localFrac = curvFrac * t * t;
  const mid = (band.nearIn + band.farIn) / 2;
  const halfWidth = ((band.farIn - band.nearIn) / 2) * (1 - localFrac);
  return { nearIn: mid - halfWidth, farIn: mid + halfWidth };
}
