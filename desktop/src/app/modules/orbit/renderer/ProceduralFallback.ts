import * as THREE from "three";
import type { OrbitAudioFeatures } from "../audio/AudioFeatures";
import { fallbackVertexShader, particlesFragmentShader } from "../shaders/particles";
import type { OrbitQualityProfile } from "./quality";

type FallbackFrame = {
  elapsed: number;
  motion: number;
  reducedMotion: boolean;
  audio: OrbitAudioFeatures;
  pixelRatio: number;
};

export class ProceduralFallback {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(profile: OrbitQualityProfile) {
    const count = Math.min(profile.particleCount, 24_576);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const populations = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const seed = ((index * 16807) % 2147483647) / 2147483647;
      const secondary = ((index * 48271 + 17) % 2147483647) / 2147483647;
      const z = seed * 2 - 1;
      const angle = secondary * Math.PI * 2;
      const planar = Math.sqrt(Math.max(0, 1 - z * z));
      const population = index % 29 === 0 ? 2 : index % 5 === 0 ? 1 : 0;
      const radius = population === 0 ? 1.14 : population === 1 ? 1.27 : 1.43;
      positions[index * 3] = Math.cos(angle) * planar * radius;
      positions[index * 3 + 1] = Math.sin(angle) * planar * radius;
      positions[index * 3 + 2] = z * radius;
      seeds[index] = secondary;
      populations[index] = population;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute("aPopulation", new THREE.BufferAttribute(populations, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: fallbackVertexShader,
      fragmentShader: particlesFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uReducedMotion: { value: 0 },
        uOverall: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uPixelRatio: { value: 1 },
        uPointScale: { value: 0.02 },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
  }

  update(frame: FallbackFrame) {
    const uniforms = this.points.material.uniforms;
    uniforms.uTime.value = frame.elapsed;
    uniforms.uMotion.value = frame.motion;
    uniforms.uReducedMotion.value = frame.reducedMotion ? 1 : 0;
    uniforms.uOverall.value = frame.audio.overall;
    uniforms.uBass.value = frame.audio.bass;
    uniforms.uMid.value = frame.audio.mid;
    uniforms.uHigh.value = frame.audio.high;
    uniforms.uPixelRatio.value = frame.pixelRatio;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
