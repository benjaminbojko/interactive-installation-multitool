// Custom projective shader material for multi-projector 3D projection canvases.
import * as THREE from 'three';
import { fcToRgb } from './projectionMath';
import { MAX_PROJECTORS } from './ProjectorShadowPass';
import type { ProjectorSpec } from './projectiveOptics';

const VERTEX_SHADER = `
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const FRAGMENT_SHADER = `
#define MAX_PROJ 4

uniform int uProjectorCount;
uniform mat4 uProjMatrix[MAX_PROJ];
uniform vec3 uLensPos[MAX_PROJ];
uniform float uNominalFc[MAX_PROJ];
uniform float uNominalDist;
uniform vec2 uContentSlice[MAX_PROJ];
uniform float uOverlapFrac;

uniform sampler2D uShadowMap[MAX_PROJ];
uniform bool uEnableShadows;

uniform sampler2D uContentTex;
uniform sampler2D uHeatRamp;
uniform int uViewMode; // 0 = Heatmap, 1 = Content
uniform float uScreenGain;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

float computeBlend(vec2 uv, vec2 slice, float overlap) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  float w = 1.0;
  if (slice.x > 0.001 && overlap > 0.0) {
    float t = clamp(uv.x / overlap, 0.0, 1.0);
    w *= t * t * (3.0 - 2.0 * t);
  }
  if (slice.y < 0.999 && overlap > 0.0) {
    float t = clamp((1.0 - uv.x) / overlap, 0.0, 1.0);
    w *= t * t * (3.0 - 2.0 * t);
  }
  float edge = smoothstep(0.0, 0.015, uv.x) * smoothstep(1.0, 0.985, uv.x)
             * smoothstep(0.0, 0.015, uv.y) * smoothstep(1.0, 0.985, uv.y);
  return w * edge;
}

float sampleShadow(int idx, vec2 uv) {
  if (idx == 0) return texture2D(uShadowMap[0], uv).r;
  if (idx == 1) return texture2D(uShadowMap[1], uv).r;
  if (idx == 2) return texture2D(uShadowMap[2], uv).r;
  if (idx == 3) return texture2D(uShadowMap[3], uv).r;
  return 1.0;
}

void main() {
  vec3 normal = normalize(vWorldNormal);
  float totalFc = 0.0;
  vec4 accumulatedContent = vec4(0.0);
  float totalWeight = 0.0;

  for (int i = 0; i < MAX_PROJ; i++) {
    if (i >= uProjectorCount) break;

    vec4 projCoords = uProjMatrix[i] * vec4(vWorldPosition, 1.0);
    if (projCoords.w <= 0.0) continue;

    vec2 uv = projCoords.xy / projCoords.w;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;

    vec3 toLens = uLensPos[i] - vWorldPosition;
    float dist = length(toLens);
    if (dist <= 0.0) continue;
    vec3 dir = toLens / dist;

    float cosIncidence = max(0.0, dot(normal, dir));
    if (cosIncidence <= 0.0) continue;

    if (uEnableShadows) {
      float shadowDepth = sampleShadow(i, uv);
      float currentDepth = projCoords.z / projCoords.w;
      if (currentDepth > shadowDepth + 0.0015) {
        continue;
      }
    }

    float blend = computeBlend(uv, uContentSlice[i], uOverlapFrac);
    float fc = uNominalFc[i] * ((uNominalDist * uNominalDist) / (dist * dist)) * cosIncidence;
    totalFc += fc * blend;

    float globalU = mix(uContentSlice[i].x, uContentSlice[i].y, uv.x);
    vec4 texColor = texture2D(uContentTex, vec2(globalU, uv.y));
    accumulatedContent += texColor * blend;
    totalWeight += blend;
  }

  // Room ambient diffuse shading so 3D geometry shape is clearly visible
  float diffuse = 0.7 + 0.3 * max(0.0, dot(normal, normalize(vec3(0.2, 0.8, 0.6))));
  vec4 baseColor = vec4(0.72, 0.76, 0.8, 1.0) * diffuse;

  if (uViewMode == 1) {
    if (totalWeight > 0.0) {
      vec4 content = accumulatedContent / max(totalWeight, 1.0);
      gl_FragColor = mix(baseColor, content, clamp(totalWeight, 0.0, 1.0));
    } else {
      gl_FragColor = baseColor;
    }
  } else {
    if (totalFc <= 0.0) {
      gl_FragColor = baseColor;
    } else {
      float rampU = clamp((totalFc * uScreenGain) / 800.0, 0.0, 1.0);
      vec4 heatColor = texture2D(uHeatRamp, vec2(rampU, 0.5));
      gl_FragColor = mix(baseColor, heatColor, clamp(totalWeight, 0.0, 1.0));
    }
  }
}
`;

export function makeHeatmapRampTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(256, 1);
  for (let i = 0; i < 256; i++) {
    const fc = (i / 255) * 800;
    const [r, g, b] = fcToRgb(fc);
    img.data[i * 4 + 0] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createProjectiveMaterial(): THREE.ShaderMaterial {
  const emptyTex = new THREE.Texture();
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    uniforms: {
      uProjectorCount: { value: 1 },
      uProjMatrix: { value: Array.from({ length: MAX_PROJECTORS }, () => new THREE.Matrix4()) },
      uLensPos: { value: Array.from({ length: MAX_PROJECTORS }, () => new THREE.Vector3()) },
      uNominalFc: { value: new Float32Array(MAX_PROJECTORS) },
      uNominalDist: { value: 15 },
      uContentSlice: { value: Array.from({ length: MAX_PROJECTORS }, () => new THREE.Vector2(0, 1)) },
      uOverlapFrac: { value: 0.2 },
      uShadowMap: { value: Array.from({ length: MAX_PROJECTORS }, () => emptyTex) },
      uEnableShadows: { value: false },
      uContentTex: { value: emptyTex },
      uHeatRamp: { value: emptyTex },
      uViewMode: { value: 0 },
      uScreenGain: { value: 1.0 },
    },
  });
}

export function updateProjectiveMaterialUniforms(
  mat: THREE.ShaderMaterial,
  specs: ProjectorSpec[],
  nominalFc: number,
  distFt: number,
  overlapFrac: number,
  contentTex: THREE.Texture,
  heatRampTex: THREE.Texture,
  viewMode: 'heatmap' | 'content',
  screenGain: number,
  shadowTextures: (THREE.Texture | null)[],
): void {
  const u = mat.uniforms;
  const count = Math.min(specs.length, MAX_PROJECTORS);
  u.uProjectorCount.value = count;
  u.uNominalDist.value = distFt;
  u.uOverlapFrac.value = overlapFrac;
  u.uContentTex.value = contentTex;
  u.uHeatRamp.value = heatRampTex;
  u.uViewMode.value = viewMode === 'content' ? 1 : 0;
  u.uScreenGain.value = screenGain;

  for (let i = 0; i < count; i++) {
    const s = specs[i];
    (u.uProjMatrix.value[i] as THREE.Matrix4).fromArray(s.textureMatrix);
    (u.uLensPos.value[i] as THREE.Vector3).set(s.lens[0], s.lens[1], s.lens[2]);
    u.uNominalFc.value[i] = s.lumens && s.lumens > 0 ? (nominalFc * (s.lumens / 4000)) : nominalFc;
    (u.uContentSlice.value[i] as THREE.Vector2).set(s.contentSlice[0], s.contentSlice[1]);
    const shadowTex = shadowTextures[i];
    if (shadowTex) {
      u.uShadowMap.value[i] = shadowTex;
      u.uEnableShadows.value = true;
    }
  }
  mat.uniformsNeedUpdate = true;
}
