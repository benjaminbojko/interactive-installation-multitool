import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { ProjectionFrustum } from './ProjectionFrustum';
import { useGizmoShortcuts } from './useGizmoShortcuts';
import type { ProjectorInstance, TransformGizmoMode, TransformGizmoSpace } from './projectorConfig';

interface ProjectorNodeProps {
  projector: ProjectorInstance;
  isSelected: boolean;
  bandColor: string;
  gizmoMode: TransformGizmoMode;
  gizmoSpace: TransformGizmoSpace;
  isMetric: boolean;
  onSelect: () => void;
  onTransformEnd: (posIn: [number, number, number], rotDeg: [number, number, number]) => void;
  orbitRef: React.RefObject<any>;
}

export function ProjectorNode({
  projector,
  isSelected,
  bandColor,
  gizmoMode,
  gizmoSpace,
  isMetric,
  onSelect,
  onTransformEnd,
  orbitRef,
}: ProjectorNodeProps) {
  const [target, setTarget] = useState<THREE.Group | null>(null);
  const { activeMode, translationSnap, rotationSnap } = useGizmoShortcuts(isMetric, gizmoMode);
  const draggingRef = useRef(false);

  const posFt: [number, number, number] = [
    projector.posIn[0] / 12,
    projector.posIn[1] / 12,
    projector.posIn[2] / 12,
  ];
  const rotRad: [number, number, number] = [
    (projector.rotDeg[0] * Math.PI) / 180,
    (projector.rotDeg[1] * Math.PI) / 180,
    (projector.rotDeg[2] * Math.PI) / 180,
  ];

  useEffect(() => {
    // Skip while a gizmo drag is live — the object's transform is being driven
    // by the drag itself, and re-snapping it from the store here would fight
    // TransformControls' own pointer tracking.
    if (!target || draggingRef.current) return;
    target.position.set(...posFt);
    target.rotation.set(...rotRad);
  }, [target, posFt[0], posFt[1], posFt[2], rotRad[0], rotRad[1], rotRad[2]]);

  function readTransform(t: THREE.Group): {
    posIn: [number, number, number];
    rotDeg: [number, number, number];
  } {
    const toDeg = 180 / Math.PI;
    return {
      posIn: [
        Math.round(t.position.x * 12 * 10) / 10,
        Math.round(t.position.y * 12 * 10) / 10,
        Math.round(t.position.z * 12 * 10) / 10,
      ],
      rotDeg: [
        Math.round(t.rotation.x * toDeg * 10) / 10,
        Math.round(t.rotation.y * toDeg * 10) / 10,
        Math.round(t.rotation.z * toDeg * 10) / 10,
      ],
    };
  }

  function handleMouseDown() {
    draggingRef.current = true;
    if (orbitRef.current) orbitRef.current.enabled = false;
  }

  function handleObjectChange() {
    if (!target || !draggingRef.current) return;
    const { posIn, rotDeg } = readTransform(target);
    onTransformEnd(posIn, rotDeg);
  }

  function handleMouseUp() {
    draggingRef.current = false;
    if (orbitRef.current) orbitRef.current.enabled = true;
    if (!target) return;
    const { posIn, rotDeg } = readTransform(target);
    onTransformEnd(posIn, rotDeg);
  }

  return (
    <>
      <group ref={setTarget} position={posFt} rotation={rotRad}>
        <ProjectionFrustum
          localParams={{
            throwRatio: projector.throwRatio,
            aspectW: projector.aspectW,
            aspectH: projector.aspectH,
            lensShiftPct: projector.lensShiftPct,
            lensOrigin: projector.lensOrigin,
            distanceFt: projector.posIn[2] / 12,
          }}
          color={bandColor}
          isSelected={isSelected}
          onSelect={onSelect}
        />
      </group>
      {isSelected && target && (
        <TransformControls
          object={target}
          mode={activeMode}
          space={gizmoSpace}
          size={0.75}
          translationSnap={translationSnap}
          rotationSnap={rotationSnap}
          onMouseDown={handleMouseDown}
          onObjectChange={handleObjectChange}
          onMouseUp={handleMouseUp}
        />
      )}
    </>
  );
}
