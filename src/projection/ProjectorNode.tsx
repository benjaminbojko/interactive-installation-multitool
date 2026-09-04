import { useState, useEffect } from 'react';
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
    if (!target) return;
    target.position.set(...posFt);
    target.rotation.set(...rotRad);
  }, [target, posFt[0], posFt[1], posFt[2], rotRad[0], rotRad[1], rotRad[2]]);

  function handleMouseDown() {
    if (orbitRef.current) orbitRef.current.enabled = false;
  }

  function handleMouseUp() {
    if (orbitRef.current) orbitRef.current.enabled = true;
    if (!target) return;
    const toDeg = 180 / Math.PI;
    onTransformEnd(
      [
        Math.round(target.position.x * 12 * 10) / 10,
        Math.round(target.position.y * 12 * 10) / 10,
        Math.round(target.position.z * 12 * 10) / 10,
      ],
      [
        Math.round(target.rotation.x * toDeg * 10) / 10,
        Math.round(target.rotation.y * toDeg * 10) / 10,
        Math.round(target.rotation.z * toDeg * 10) / 10,
      ],
    );
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
          onMouseUp={handleMouseUp}
        />
      )}
    </>
  );
}
