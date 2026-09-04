import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_TABLE_HEIGHT, type PersonaId, type Strictness } from '../ergonomics/constants';
import { sizeFromDiagonal, verdict, type Verdict } from '../ergonomics/engine';
import { legibilityReport, type LegibilityReport, type TypeSample } from '../typography/legibility';
import { mToIn, type SensingMode, type SensorMount, type SensorTarget } from '../sensor/sensorMath';
import { MOUNT_DEFAULTS as SPK_MOUNT_DEFAULTS, type SpeakerUnit, type UseCase } from '../speaker/speakerMath';
import {
  type ProjectorInstance,
  type TransformGizmoMode,
  type TransformGizmoSpace,
  INITIAL_PROJECTORS,
  createDefaultProjector,
  arrangeInArray,
} from '../projection/projectorConfig';
import { dataFields, validateAndApply, withoutContent } from './snapshot';

/** Bumped only when a field's meaning changes incompatibly. Stamped into every
 *  saved snapshot (localStorage, JSON file, share link). Restore is best-effort
 *  and additive, so this is informational, never a hard gate. */
export const SCHEMA_VERSION = 1;

export type Units = 'us' | 'metric';
export type Mode = 'touch' | 'view';
export type ResMode = 'pixels' | 'pitch';
export type CameraView = 'orbit' | 'first-person';
export type StageView = '3d' | '2d';
export type AppTab = 'placement' | 'dvled' | 'projection' | 'table' | 'sensor' | 'speaker';
export type SpeakerWeighting = 'dba' | 'flat';
export type CoverageView = 'spl' | 'uniformity';
export type LedShape = 'square' | 'circle';
export type MountType = 'wall' | 'stand';
export type PinMode = 'distance' | 'width';
export type SurfaceView = 'heatmap' | 'content';
export type LensOrigin = 'center' | 'top';
export type LedSizeMode = 'dimensions' | 'cabinets';
export type LedView = 'content' | 'cabinets';

export interface ConfigState {
  // --- screen ---
  diagonal: number; // in
  aspectW: number;
  aspectH: number;
  mountBottom: number; // in AFF (bottom edge)
  mountType: MountType; // 'wall' flush, or 'stand'/podium
  tiltDeg: number; // back-tilt of the screen; 0 = vertical

  // --- table (horizontal touchscreen) ---
  // The table owns its screen outright — a tabletop panel has nothing to do with
  // the wall-mounted one, and inheriting its size was the confusing part.
  tableDiagonal: number; // in
  tableAspectW: number;
  tableAspectH: number;
  tableHorizontalPixels: number; // native pixels across the table screen
  tableHeight: number; // in AFF, surface height for the table tab
  tableBezel: number; // in, border/frame width around the screen (0–12)
  tableShowReach: boolean; // overlay the reach heatmap on the surface
  tableSeats: number; // figures standing around the table (1–6)

  // --- context ---
  mode: Mode;
  viewingDistance: number; // in (used in 'view' mode)
  personaId: PersonaId;

  // --- resolution ---
  resMode: ResMode;
  horizontalPixels: number;
  pitchMm: number;

  // --- ui ---
  units: Units;
  appTab: AppTab;
  stageView: StageView;
  cameraView: CameraView;
  fpFov: number; // deg, vertical FOV for the first-person camera
  showReach: boolean;
  showAdaOnScreen: boolean; // shade the screen by which parts fall in the ADA reach band
  strictness: Strictness;
  contentUrl: string | null;

  // --- type & legibility ---
  typeArtboardPx: number; // artboard width in px that maps across the screen
  typeSamples: TypeSample[]; // named type sizes (artboard px) to evaluate
  typeSampleText: string; // the string rendered in the on-screen specimen
  typeShowSpecimen: boolean; // drive the type specimen onto the screen face
  screenPpi: number | null; // calibrated PPI of the DESIGNER's own display (true-scale)

  // --- LED Display preview ---
  // Also its own screen: an LED wall is sized in cabinets, not in the diagonal
  // you'd quote for a flat panel, so it never tracks the placement tab.
  ledDiagonal: number; // in — the TARGET size ('dimensions' mode)
  ledAspectW: number;
  ledAspectH: number;
  ledPitchMm: number; // NOMINAL pitch; the built pitch comes from the cabinet
  ledSizeMode: LedSizeMode; // drive the wall by dimensions, or by cabinet count
  ledCabinetW: number; // mm
  ledCabinetH: number; // mm
  ledCabCols: number; // cabinets across ('cabinets' mode)
  ledCabRows: number; // cabinets down ('cabinets' mode)
  ledView: LedView; // show content, or the bare cabinet layout
  dvledDistance: number; // in (eye-to-wall for the preview tab)
  dvledFov: number; // deg, horizontal field of view shown
  fillFactor: number; // 0–1, LED emitter coverage of its cell (manual override)
  dvledLockFill: boolean; // derive fill from pitch instead of the manual value
  ledShape: LedShape;
  dvledShowScale: boolean; // overlay a to-scale figure + scale bar
  dvledScalePersona: PersonaId; // which body the scale figure represents

  // --- projection ---
  projThrowRatio: number; // throw distance / image width
  projDistance: number; // in, lens-to-wall (perpendicular)
  projWidth: number; // in, projected image width (linked to distance via throw)
  projPin: PinMode; // which of distance/width the user drives
  projLumens: number; // single-projector rated lumens
  projectorCount: number; // stacking multiplier
  projStackEff: number; // 0–1, brightness kept per added stacked unit
  projArrayCount: number; // horizontal edge-blended array: projectors side by side
  projArrayOverlapPct: number; // % of one image width that neighbours overlap
  projAspectW: number;
  projAspectH: number;
  projResW: number; // native projector pixels
  projResH: number;
  projResLock: boolean; // keep aspect ratio and resolution in sync
  projAmbientFc: number; // ambient light on the surface, foot-candles
  projScreenGain: number; // screen gain — fL = fc × gain
  projLensAff: number; // in, lens height above floor
  projLensShiftPct: number; // vertical lens shift, % of half image height; +up/−down
  projLensOrigin: LensOrigin; // where 0% shift sits: lens centre, or top-aligned (periscope)
  projTiltDeg: number; // projector tilt; 0 = perpendicular, nonzero = keystone
  projShowFigure: boolean; // show a to-scale person for size reference
  projSurfaceView: SurfaceView; // heatmap or projected content
  projCanvasType: 'wall' | 'curved' | 'cylinder' | 'model'; // projection canvas surface
  projCanvasHeight: number; // in, physical screen height for curved canvas
  projCurvedRadius: number; // in, radius for curved screen
  projCurvedArcDeg: number; // deg, arc span for curved screen
  projModelUrl: string | null; // blob or asset URL for 3D model canvas
  projModelScale: number; // scale multiplier for 3D model
  projModelOffset: [number, number, number]; // [x, y, z] in inches
  projModelRotY: number; // deg, yaw rotation for 3D model
  projectors: ProjectorInstance[];
  selectedProjectorId: string | null;
  transformGizmoMode: TransformGizmoMode;
  transformGizmoSpace: TransformGizmoSpace;

  // --- sensor coverage (camera / depth sensor) ---
  sensorMount: SensorMount; // ceiling / wall / floor
  sensorMountAff: number; // in, sensor height above floor (ceiling/wall height)
  sensorPitchDeg: number; // elevation aim: 0 level, −90 down, +90 up
  sensorYawDeg: number; // pan aim about vertical
  sensorHFov: number; // horizontal field of view, deg
  sensorVFov: number; // vertical field of view, deg
  sensorHwMax: number; // in, the sensor hardware max depth (reseeds mode windows)
  sensorMode: SensingMode; // sensing task — sets the confidence window
  sensorMinRange: number; // in, hard near cutoff (blind below)
  sensorConfNear: number; // in, near edge of the high-confidence sweet spot
  sensorConfFar: number; // in, far edge of the high-confidence sweet spot
  sensorMaxRange: number; // in, hard far cutoff (confidence reaches 0)
  sensorTarget: SensorTarget; // optional context wall to draw: floor or facing wall
  sensorWallDist: number; // in, distance to the facing wall (target='wall')
  sensorPersona: PersonaId; // which body the placed person represents
  sensorPersonX: number; // in, person's side offset from the sensor axis
  sensorPersonZ: number; // in, person's forward distance into the room
  sensorShowZone: boolean; // overlay the trackable floor zone
  sensorShowMeasurements: boolean; // overlay dimension lines + range labels

  // --- speaker SPL coverage ---
  speakers: SpeakerUnit[]; // placed units (1–6), each with its own mount + aim + model
  speakerSel: number; // index of the unit the controls edit
  speakerAmpW: number; // available amplifier / 70V-line power for the tap budget
  speakerUseCase: UseCase; // listening scenario — sets the comfortable band
  speakerWeighting: SpeakerWeighting; // display flat dB SPL or A-weighted dBA
  speakerEarHeight: number; // in, ear height of the listening plane
  speakerNoiseFloor: number; // dBA, ambient room noise floor (for SNR)
  speakerListenerX: number; // in, listening position side offset
  speakerListenerZ: number; // in, listening position forward distance
  speakerCoverageView: CoverageView; // heatmap shows absolute dB SPL or ±dB uniformity
  speakerShowField: boolean; // overlay the ear-height coverage plane
  speakerShowMeasurements: boolean; // overlay dimension lines + labels

  // --- actions ---
  set: <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void;
  setContent: (url: string | null) => void;
  applyRecommendedMount: () => void;
  getVerdict: () => Verdict;
  getLegibility: () => LegibilityReport;
  addProjector: (preset?: Partial<ProjectorInstance>) => string;
  removeProjector: (id: string) => void;
  updateProjector: (id: string, partial: Partial<ProjectorInstance>) => void;
  selectProjector: (id: string | null) => void;
  arrangeProjectorsInArray: (count: number, overlapPct: number) => void;
}

/** The serializable fields only — the store minus its action functions. This is
 *  what gets saved/restored across localStorage, JSON files, and share links. */
export type ConfigData = Omit<
  ConfigState,
  | 'set'
  | 'setContent'
  | 'applyRecommendedMount'
  | 'getVerdict'
  | 'getLegibility'
  | 'addProjector'
  | 'removeProjector'
  | 'updateProjector'
  | 'selectProjector'
  | 'arrangeProjectorsInArray'
>;

export const INITIAL: ConfigData = {
  diagonal: 65,
  aspectW: 16,
  aspectH: 9,
  mountBottom: 24,
  mountType: 'wall',
  tiltDeg: 0,

  tableDiagonal: 43,
  tableAspectW: 16,
  tableAspectH: 9,
  tableHorizontalPixels: 3840,
  tableHeight: DEFAULT_TABLE_HEIGHT,
  tableBezel: 1.5,
  tableShowReach: true,
  tableSeats: 1,

  mode: 'touch',
  viewingDistance: 96,
  personaId: 'adult',

  resMode: 'pixels',
  horizontalPixels: 3840,
  pitchMm: 2.5,

  units: 'us',
  appTab: 'placement',
  stageView: '3d',
  cameraView: 'orbit',
  fpFov: 60,
  showReach: true,
  showAdaOnScreen: false,
  strictness: 'realistic',
  contentUrl: null,

  typeArtboardPx: 1920,
  typeSamples: [
    { label: 'Body', fontPx: 16 },
    { label: 'Subhead', fontPx: 32 },
    { label: 'Headline', fontPx: 72 },
  ],
  typeSampleText: 'The quick brown fox',
  typeShowSpecimen: false,
  screenPpi: null,

  // The 12 ft lobby wall — where the LED tab always starts, regardless of what
  // the other tabs are set to. 165" 16:9 fits an 8 × 5 grid of 500 mm cabinets.
  ledDiagonal: 165,
  ledAspectW: 16,
  ledAspectH: 9,
  ledPitchMm: 2.5,
  ledSizeMode: 'dimensions',
  ledCabinetW: 500,
  ledCabinetH: 500,
  ledCabCols: 8,
  ledCabRows: 5,
  ledView: 'content',
  dvledDistance: 120, // 10 ft
  dvledFov: 40,
  fillFactor: 0.55,
  dvledLockFill: true,
  ledShape: 'circle',
  dvledShowScale: true,
  dvledScalePersona: 'adult',

  projThrowRatio: 1.5,
  projDistance: 180, // 15 ft → 10 ft wide image
  projWidth: 120, // 10 ft, kept in sync with distance via throw ratio
  projPin: 'distance',
  projLumens: 4000,
  projectorCount: 1,
  projStackEff: 0.9, // each added stacked unit contributes ~90% of its lumens
  projArrayCount: 1, // single image until widened into an array
  projArrayOverlapPct: 20, // typical edge-blend overlap
  projAspectW: 16,
  projAspectH: 9,
  projResW: 1920,
  projResH: 1080, // 16:9, consistent with the aspect default
  projResLock: true,
  projAmbientFc: 5,
  projScreenGain: 1.0,
  projLensAff: 90, // 7.5 ft
  projLensShiftPct: 0, // image centred on the lens axis
  projLensOrigin: 'center',
  projTiltDeg: 0, // perpendicular → no keystone
  projShowFigure: true,
  projSurfaceView: 'heatmap',
  projCanvasType: 'wall',
  projCanvasHeight: 120, // 10 ft physical height
  projCurvedRadius: 144, // 12 ft radius
  projCurvedArcDeg: 60, // 60 degree arc
  projModelUrl: null,
  projModelScale: 1.0,
  projModelOffset: [0, 0, 0],
  projModelRotY: 0,
  projectors: INITIAL_PROJECTORS,
  selectedProjectorId: 'proj-1',
  transformGizmoMode: 'translate',
  transformGizmoSpace: 'world',

  // Azure Kinect (NFOV) on a 9 ft ceiling aimed straight down, skeletal tracking.
  sensorMount: 'ceiling',
  sensorMountAff: 108, // 9 ft
  sensorPitchDeg: -90,
  sensorYawDeg: 0,
  sensorHFov: 75,
  sensorVFov: 65,
  sensorHwMax: mToIn(3.86), // Azure NFOV hardware depth max
  sensorMode: 'skeletal',
  sensorMinRange: mToIn(0.5), // skeletal window seeded from the mode
  sensorConfNear: mToIn(1.2),
  sensorConfFar: mToIn(3.5),
  sensorMaxRange: mToIn(3.86),
  sensorTarget: 'floor',
  sensorWallDist: 240, // 20 ft
  sensorPersona: 'adult',
  sensorPersonX: 0,
  sensorPersonZ: 24, // 2 ft forward of the sensor axis
  sensorShowZone: true,
  sensorShowMeasurements: true,

  // Two 8" ceiling speakers (9 ft, firing down) straddling a centred listener, so
  // the overlap-in-the-middle case reads on load. Speech/paging scenario.
  speakers: [
    { mount: 'ceiling', xIn: -42, zIn: 72, mountAffIn: SPK_MOUNT_DEFAULTS.ceiling.mountAffIn,
      yawDeg: 0, pitchDeg: -90, hCovDeg: 90, vCovDeg: 90, sensitivity: 89, powerW: 1, maxSplDb: 110 },
    { mount: 'ceiling', xIn: 42, zIn: 72, mountAffIn: SPK_MOUNT_DEFAULTS.ceiling.mountAffIn,
      yawDeg: 0, pitchDeg: -90, hCovDeg: 90, vCovDeg: 90, sensitivity: 89, powerW: 1, maxSplDb: 110 },
  ],
  speakerSel: 0,
  speakerAmpW: 120, // a typical small 70V amp (matches the AD-P6T recommendation)
  speakerUseCase: 'speech',
  speakerWeighting: 'dba',
  speakerEarHeight: 60, // standing ear height
  speakerNoiseFloor: 50, // typical occupied-room ambient, dBA
  speakerListenerX: 0,
  speakerListenerZ: 72,
  speakerCoverageView: 'spl',
  speakerShowField: true,
  speakerShowMeasurements: true,
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      set: (key, value) => set({ [key]: value } as Partial<ConfigState>),
      setContent: (url) => set({ contentUrl: url }),

      addProjector: (preset) => {
        const s = get();
        if (s.projectors.length >= 4) return s.projectors[s.projectors.length - 1].id;
        const id = `proj-${Date.now()}`;
        const count = s.projectors.length + 1;
        const prev = s.projectors[s.projectors.length - 1];
        const newProj: ProjectorInstance = {
          ...(prev ?? createDefaultProjector(id, `Projector ${count}`)),
          ...preset,
          id,
          name: preset?.name ?? `Projector ${count}`,
          posIn: preset?.posIn ?? [
            prev ? prev.posIn[0] + 48 : 0,
            prev ? prev.posIn[1] : 90,
            prev ? prev.posIn[2] : 180,
          ],
        };
        set({
          projectors: [...s.projectors, newProj],
          selectedProjectorId: id,
        });
        return id;
      },

      removeProjector: (id) => {
        const s = get();
        if (s.projectors.length <= 1) return;
        const next = s.projectors.filter((p) => p.id !== id);
        set({
          projectors: next,
          selectedProjectorId: s.selectedProjectorId === id ? next[0].id : s.selectedProjectorId,
        });
      },

      updateProjector: (id, partial) => {
        const s = get();
        set({
          projectors: s.projectors.map((p) => (p.id === id ? { ...p, ...partial } : p)),
        });
      },

      selectProjector: (id) => set({ selectedProjectorId: id }),

      arrangeProjectorsInArray: (count, overlapPct) => {
        const s = get();
        const next = arrangeInArray(
          s.projectors,
          count,
          overlapPct,
          s.projWidth,
          s.projDistance,
          s.projLensAff,
        );
        set({ projectors: next, selectedProjectorId: next[0]?.id ?? null });
      },

      applyRecommendedMount: () => {
        const v = get().getVerdict();
        set({ mountBottom: Math.round(v.recommendedMountBottom * 10) / 10 });
      },

      getVerdict: () => {
        const s = get();
        return verdict({
          size: sizeFromDiagonal(s.diagonal, s.aspectW, s.aspectH),
          mountBottom: s.mountBottom,
          tiltDeg: s.tiltDeg,
          mode: s.mode,
          viewingDistance: s.viewingDistance,
          personaId: s.personaId,
          horizontalPixels: s.resMode === 'pixels' ? s.horizontalPixels : undefined,
          pitchMm: s.resMode === 'pitch' ? s.pitchMm : undefined,
          strictness: s.strictness,
        });
      },

      getLegibility: () => {
        const s = get();
        const size = sizeFromDiagonal(s.diagonal, s.aspectW, s.aspectH);
        // Perception is judged at the same effective distance the verdict uses:
        // arm's length in touch mode, the configured standoff when viewing.
        const distanceIn = s.getVerdict().effectiveDistance;
        // Native horizontal pixels: given directly, or derived from LED pitch.
        const screenPx =
          s.resMode === 'pixels'
            ? s.horizontalPixels
            : s.pitchMm > 0
              ? (size.width * 25.4) / s.pitchMm
              : 0;
        return legibilityReport({
          samples: s.typeSamples,
          artboardPx: s.typeArtboardPx,
          screenWidthIn: size.width,
          screenPx,
          distanceIn,
        });
      },
    }),
    {
      name: 'iimt-config',
      version: SCHEMA_VERSION,
      // Persist data fields only, minus the uploaded image (a data URL that can
      // blow the ~5 MB localStorage quota). The image survives JSON export, not
      // reload. Functions are dropped by dataFields().
      partialize: (s) => withoutContent(dataFields(s)),
      // Validate the stored blob before it touches the live store, so a corrupt
      // or stale entry degrades to defaults instead of breaking boot.
      merge: (persisted, current) => ({
        ...current,
        ...validateAndApply(persisted),
      }),
    },
  ),
);
