// UI control for uploading custom 3D models (.glb, .gltf) and adjusting transform.

import { useRef } from 'react';
import { useConfigStore } from '../store/useConfigStore';

function ModelSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (val: number) => void;
}) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="row-label">{label}</span>
        <span className="num-readout">
          {value}
          {unit}
        </span>
      </div>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function ModelUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const modelUrl = useConfigStore((s) => s.projModelUrl);
  const modelScale = useConfigStore((s) => s.projModelScale);
  const modelOffset = useConfigStore((s) => s.projModelOffset);
  const modelRotY = useConfigStore((s) => s.projModelRotY);
  const set = useConfigStore((s) => s.set);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (modelUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(modelUrl);
    }
    const url = URL.createObjectURL(file);
    set('projModelUrl', url);
    set('projCanvasType', 'model');
  }

  function handleClear() {
    if (modelUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(modelUrl);
    }
    set('projModelUrl', null);
    set('projCanvasType', 'wall');
  }

  function handleSampleModel() {
    const base = import.meta.env.BASE_URL || '/';
    const cleanBase = base.endsWith('/') ? base : `${base}/`;
    set('projModelUrl', `${cleanBase}adult.glb`);
    set('projCanvasType', 'model');
  }

  return (
    <div className="model-upload">
      <input
        ref={inputRef}
        type="file"
        accept=".glb,.gltf"
        onChange={handleFile}
        hidden
      />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <button className="ghost" onClick={() => inputRef.current?.click()}>
          {modelUrl ? 'Replace 3D Model' : 'Upload 3D Model (.glb, .gltf)'}
        </button>
        {!modelUrl && (
          <button className="ghost" onClick={handleSampleModel}>
            Sample Model
          </button>
        )}
        {modelUrl && (
          <button className="ghost" onClick={handleClear}>
            Clear
          </button>
        )}
      </div>
      <p className="hint" style={{ margin: '0 0 12px 0' }}>
        Loaded into memory only — nothing uploaded to servers.
      </p>

      {modelUrl && (
        <div className="model-controls">
          <ModelSlider
            label="Scale"
            value={modelScale}
            min={0.2}
            max={3.0}
            step={0.05}
            unit="×"
            onChange={(v) => set('projModelScale', v)}
          />
          <ModelSlider
            label="Rotation (Yaw)"
            value={modelRotY}
            min={-180}
            max={180}
            step={5}
            unit="°"
            onChange={(v) => set('projModelRotY', v)}
          />
          <ModelSlider
            label="Horizontal Offset X"
            value={modelOffset[0]}
            min={-120}
            max={120}
            step={1}
            unit="″"
            onChange={(v) => set('projModelOffset', [v, modelOffset[1], modelOffset[2]])}
          />
          <ModelSlider
            label="Elevation Offset Y"
            value={modelOffset[1]}
            min={-60}
            max={60}
            step={1}
            unit="″"
            onChange={(v) => set('projModelOffset', [modelOffset[0], v, modelOffset[2]])}
          />
          <ModelSlider
            label="Depth Offset Z"
            value={modelOffset[2]}
            min={-120}
            max={120}
            step={1}
            unit="″"
            onChange={(v) => set('projModelOffset', [modelOffset[0], modelOffset[1], v])}
          />
        </div>
      )}
    </div>
  );
}
