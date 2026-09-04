import { useConfigStore } from '../store/useConfigStore';
import { useGizmoShortcuts } from './useGizmoShortcuts';
import { Card } from '../ui/Card';
import type { ProjectorInstance } from './projectorConfig';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function ProjectorListCard() {
  const s = useConfigStore();
  const metric = s.units === 'metric';
  const unit = metric ? 'm' : 'ft';
  const { activeMode } = useGizmoShortcuts(metric, s.transformGizmoMode);

  const toDisplay = (inVal: number) =>
    round1(metric ? (inVal * 2.54) / 100 : inVal / 12);
  const fromDisplay = (val: number) =>
    round1(metric ? (val * 100) / 2.54 : val * 12);

  const sel = s.projectors.find((p) => p.id === s.selectedProjectorId) ?? s.projectors[0];
  const freeform = s.projGeometryMode === 'freeform';

  function updateSel(partial: Partial<ProjectorInstance>) {
    if (sel) s.updateProjector(sel.id, partial);
  }

  function handlePosChange(axis: 0 | 1 | 2, val: number) {
    if (!sel) return;
    const next: [number, number, number] = [...sel.posIn];
    next[axis] = fromDisplay(val);
    updateSel({ posIn: next });
  }

  function handleRotChange(axis: 0 | 1 | 2, val: number) {
    if (!sel) return;
    const next: [number, number, number] = [...sel.rotDeg];
    next[axis] = val;
    updateSel({ rotDeg: next });
  }

  return (
    <Card
      title={`Projectors (${s.projectors.length}/4)`}
      headerAction={
        <button
          className="sm"
          disabled={s.projectors.length >= 4}
          onClick={() => s.addProjector()}
          title="Add a projector (maximum 4 units)"
        >
          + Add
        </button>
      }
    >

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {!freeform && (
          <button
            className="sm"
            onClick={() => s.arrangeProjectorsInArray(s.projectors.length, s.projArrayOverlapPct)}
            title="Arrange active projectors in a uniform horizontal array"
          >
            Array
          </button>
        )}
        <button
          className="sm"
          disabled={!sel || s.projectors.length < 2}
          onClick={() => sel && s.applyProjectorToAll(sel.id)}
          title="Copy the selected projector's throw ratio, lumens, resolution, lens shift/origin, and focus limits to every other projector (position and rotation stay per-projector)"
        >
          Apply to all
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {s.projectors.map((p, idx) => {
          const isSelected = p.id === sel?.id;
          return (
            <div
              key={p.id}
              onClick={() => s.selectProjector(p.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: 6,
                background: isSelected ? 'var(--panel-2)' : 'transparent',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--line)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    s.updateProjector(p.id, { enabled: e.target.checked });
                  }}
                  title="Enable or disable projector"
                />
                <span style={{ fontWeight: isSelected ? 600 : 400, fontSize: 13 }}>
                  {p.name || `Projector ${idx + 1}`}
                </span>
              </div>
              <button
                className="legi-x"
                disabled={s.projectors.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  s.removeProjector(p.id);
                }}
                title="Remove projector"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {sel && (
        <>
          {freeform && (
            <>
              <label
                className="row"
                title="Transform gizmo mode in 3D viewport (hold Ctrl to switch mode, hold Shift to snap 5cm/2in or 5°)"
              >
                <span className="row-label">Gizmo mode</span>
                <span className="seg sm">
                  <button
                    className={activeMode === 'translate' ? 'on' : ''}
                    onClick={() => s.set('transformGizmoMode', 'translate')}
                  >
                    Translate
                  </button>
                  <button
                    className={activeMode === 'rotate' ? 'on' : ''}
                    onClick={() => s.set('transformGizmoMode', 'rotate')}
                  >
                    Rotate
                  </button>
                </span>
              </label>

              <label className="row" title="Transform coordinate space">
                <span className="row-label">Gizmo space</span>
                <span className="seg sm">
                  <button
                    className={s.transformGizmoSpace === 'world' ? 'on' : ''}
                    onClick={() => s.set('transformGizmoSpace', 'world')}
                  >
                    World
                  </button>
                  <button
                    className={s.transformGizmoSpace === 'local' ? 'on' : ''}
                    onClick={() => s.set('transformGizmoSpace', 'local')}
                  >
                    Local
                  </button>
                </span>
              </label>
            </>
          )}

          <div
            className="field"
            title={
              freeform
                ? 'Projector position in 3D space [X lateral, Y height AFF, Z throw distance]'
                : 'Computed from throw distance, lens height, and array layout — switch to Freeform to edit directly'
            }
          >
            <div className="field-head">
              <span className="row-label">Position ({unit})</span>
            </div>
            <div className="coord-grid">
              <label>
                X (Side)
                <input
                  type="number"
                  step={0.1}
                  disabled={!freeform}
                  value={toDisplay(sel.posIn[0])}
                  onChange={(e) => handlePosChange(0, Number(e.target.value))}
                />
              </label>
              <label>
                Y (Height)
                <input
                  type="number"
                  step={0.1}
                  disabled={!freeform}
                  value={toDisplay(sel.posIn[1])}
                  onChange={(e) => handlePosChange(1, Number(e.target.value))}
                />
              </label>
              <label>
                Z (Throw)
                <input
                  type="number"
                  step={0.1}
                  disabled={!freeform}
                  value={toDisplay(sel.posIn[2])}
                  onChange={(e) => handlePosChange(2, Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          <div
            className="field"
            title={
              freeform
                ? 'Projector orientation Euler angles [Pitch, Yaw, Roll] in degrees'
                : 'Pitch is computed from Tilt — switch to Freeform to edit directly'
            }
          >
            <div className="field-head">
              <span className="row-label">Rotation (deg)</span>
            </div>
            <div className="coord-grid">
              <label>
                Pitch
                <input
                  type="number"
                  step={1}
                  disabled={!freeform}
                  value={round1(sel.rotDeg[0])}
                  onChange={(e) => handleRotChange(0, Number(e.target.value))}
                />
              </label>
              <label>
                Yaw
                <input
                  type="number"
                  step={1}
                  value={round1(sel.rotDeg[1])}
                  onChange={(e) => handleRotChange(1, Number(e.target.value))}
                />
              </label>
              <label>
                Roll
                <input
                  type="number"
                  step={1}
                  value={round1(sel.rotDeg[2])}
                  onChange={(e) => handleRotChange(2, Number(e.target.value))}
                />
              </label>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
