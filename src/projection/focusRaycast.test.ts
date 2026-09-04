import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { raycastThrowDistanceIn } from './focusRaycast';

describe('raycastThrowDistanceIn', () => {
  it('matches posIn[2] for an unrotated projector facing a flat wall at z=0', () => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20));
    wall.position.set(0, 5, 0);
    wall.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    // posIn is inches; distanceIn returned should be feet(15)*12 = 180in.
    const distIn = raycastThrowDistanceIn([0, 60, 180], [0, 0, 0], wall, raycaster);
    expect(distIn).not.toBeNull();
    expect(distIn!).toBeCloseTo(180, 0);
  });

  it('finds a much shorter distance once the projector is pitched down at a near floor', () => {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200));
    floor.rotation.x = -Math.PI / 2; // lies flat, facing +Y
    floor.position.set(0, 0, 0);
    floor.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    // Lens 8ft (96in) up, pitched -90deg so local -Z now points straight down.
    const distIn = raycastThrowDistanceIn([0, 96, 0], [-90, 0, 0], floor, raycaster);
    expect(distIn).not.toBeNull();
    expect(distIn!).toBeCloseTo(96, 0);
  });

  it('returns null when the ray points away from all geometry', () => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20));
    wall.position.set(0, 5, 0);
    wall.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    // Yawed 180deg — now aims away from the wall entirely.
    const distIn = raycastThrowDistanceIn([0, 60, 180], [0, 180, 0], wall, raycaster);
    expect(distIn).toBeNull();
  });
});
