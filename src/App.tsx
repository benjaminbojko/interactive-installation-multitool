import { useEffect, useState } from 'react';
import { PERSONAS } from './ergonomics/constants';
import { useConfigStore, type AppTab } from './store/useConfigStore';
import { consumeShareHash } from './share/shareUrl';
import { AboutModal } from './ui/AboutModal';
import { ResetModal } from './ui/ResetModal';
import { ControlPanel } from './ui/ControlPanel';
import { HelpPanel } from './ui/HelpPanel';
import { SaveMenu } from './ui/SaveMenu';
import { UnitToggle } from './ui/UnitToggle';
import { VerdictPanel } from './ui/VerdictPanel';
import { LegibilityControls } from './typography/LegibilityControls';
import { Scene } from './scene/Scene';
import { SideElevation } from './twod/SideElevation';
import { DvLedControls } from './dvled/DvLedControls';
import { DvLedPreview } from './dvled/DvLedPreview';
import { ProjectionControls } from './projection/ProjectionControls';
import { ProjectionScene } from './projection/ProjectionScene';
import { TableControls } from './table/TableControls';
import { TableElevation } from './table/TableElevation';
import { TableScene } from './table/TableScene';
import { TableVerdictPanel } from './table/TableVerdictPanel';
import { SensorControls } from './sensor/SensorControls';
import { SensorScene } from './sensor/SensorScene';
import { SpeakerControls } from './speaker/SpeakerControls';
import { SpeakerScene } from './speaker/SpeakerScene';
import './App.css';

// Short chips for the bar; the full name lives in the tooltip and the spec
// sheet. Six verbose labels wrapped inside their own buttons and pushed the
// unit toggle off the edge.
const TABS: { id: AppTab; label: string; title: string }[] = [
  { id: 'placement', label: 'Placement', title: 'Monitor Placement — wall-mounted screen' },
  { id: 'table', label: 'Table', title: 'Table Monitor — horizontal touchscreen' },
  { id: 'dvled', label: 'LED Wall', title: 'LED Display preview — pitch, cabinets & viewing distance' },
  { id: 'projection', label: 'Projection', title: 'Projection — throw distance & brightness' },
  { id: 'sensor', label: 'Sensors', title: 'Sensor Coverage — FOV, range & blind zones' },
  { id: 'speaker', label: 'Speakers', title: 'Speaker SPL coverage' },
];

export default function App() {
  const cameraView = useConfigStore((s) => s.cameraView);
  const stageView = useConfigStore((s) => s.stageView);
  const appTab = useConfigStore((s) => s.appTab);
  const personaId = useConfigStore((s) => s.personaId);
  const fpFov = useConfigStore((s) => s.fpFov);
  const set = useConfigStore((s) => s.set);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // A share link overrides the autosaved state for this visit, then clears the hash.
  useEffect(() => {
    consumeShareHash();
  }, []);
  const fp = cameraView === 'first-person';
  const is2d = stageView === '2d';
  const isDvled = appTab === 'dvled';
  const isProjection = appTab === 'projection';
  const isTable = appTab === 'table';
  const isSensor = appTab === 'sensor';
  const isSpeaker = appTab === 'speaker';
  const isPlacement = appTab === 'placement';

  const tag = isDvled
    ? 'LED Display viewing-distance preview'
    : isProjection
      ? 'single-projector throw & photometric simulator'
      : isTable
        ? 'horizontal table — reach depth · ADA · seated access'
        : isSensor
          ? 'camera / depth-sensor coverage — FOV · range · blind zones'
          : isSpeaker
            ? 'speaker SPL coverage — directivity · dropoff · overlap · dBA verdict'
            : 'touch reach · viewing distance · pixel pitch';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>Interactive Installation Multitool</strong>
          <span className="tag">{tag}</span>
        </div>
        <nav className="topbar-tabs">
          <span className="seg tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={appTab === t.id ? 'on' : ''}
                title={t.title}
                onClick={() => set('appTab', t.id)}
              >
                {t.label}
              </button>
            ))}
          </span>
        </nav>
        <div className="topbar-controls">
          {(isPlacement || isTable) && (
            <span className="seg">
              <button className={!is2d ? 'on' : ''} onClick={() => set('stageView', '3d')}>
                3D
              </button>
              <button className={is2d ? 'on' : ''} onClick={() => set('stageView', '2d')}>
                2D plan
              </button>
            </span>
          )}
          {isPlacement && !is2d && (
            <button
              className={`view-toggle ${fp ? 'on' : ''}`}
              title={
                fp
                  ? 'Back to the orbiting room view'
                  : `Look from ${PERSONAS[personaId].label}'s eye height`
              }
              onClick={() => set('cameraView', fp ? 'orbit' : 'first-person')}
            >
              {fp ? '← Room view' : `👁 ${PERSONAS[personaId].label.split(' ')[0]}'s eyes`}
            </button>
          )}
          <UnitToggle />
          <SaveMenu />
          <button
            className="reset-btn"
            title="Reset all settings to defaults"
            onClick={() => setResetOpen(true)}
          >
            Reset
          </button>
          <button className="about-btn" onClick={() => setAboutOpen(true)}>
            About
          </button>
        </div>
      </header>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {resetOpen && <ResetModal onClose={() => setResetOpen(false)} />}

      <main className="layout">
        <aside className="sidebar">
          {isDvled ? (
            <DvLedControls />
          ) : isProjection ? (
            <ProjectionControls />
          ) : isTable ? (
            <TableControls />
          ) : isSensor ? (
            <SensorControls />
          ) : isSpeaker ? (
            <SpeakerControls />
          ) : (
            <>
              <HelpPanel />
              <ControlPanel />
              <LegibilityControls />
            </>
          )}
        </aside>
        <section className="stage">
          {isDvled ? (
            <DvLedPreview />
          ) : isProjection ? (
            <ProjectionScene />
          ) : isSensor ? (
            <SensorScene />
          ) : isSpeaker ? (
            <SpeakerScene />
          ) : isTable ? (
            <div className="proj-stage">
              <div className="proj-frame">{is2d ? <TableElevation /> : <TableScene />}</div>
              <TableVerdictPanel />
            </div>
          ) : (
            <div className="proj-stage">
              <div className="proj-frame">
                {is2d ? (
                  <SideElevation />
                ) : (
                  <>
                    <Scene />
                    {fp && (
                      <div className="fp-hint">
                        First-person view at ~{Math.round(fpFov)}° FOV · drag to look around.
                        If the screen spills past the edges, it's too big for this distance.
                      </div>
                    )}
                  </>
                )}
              </div>
              <VerdictPanel />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
