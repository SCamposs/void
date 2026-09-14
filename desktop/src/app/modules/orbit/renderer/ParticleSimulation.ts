import * as THREE from "three";
import { GPUComputationRenderer, type Variable } from "three/addons/misc/GPUComputationRenderer.js";
import type { OrbitAudioFeatures } from "../audio/AudioFeatures";
import type { PointerField } from "../interaction/PointerField";
import { particlesFragmentShader, particlesVertexShader } from "../shaders/particles";
import { simulationPositionShader } from "../shaders/simulationPosition";
import { simulationVelocityShader } from "../shaders/simulationVelocity";
import type { OrbitQualityProfile } from "./quality";

type SimulationFrame = {
  delta: number; elapsed: number; motion: number; reducedMotion: boolean;
  pointer: PointerField; audio: OrbitAudioFeatures; transientAge: number; pixelRatio: number;
};

function mulberry32(seed: number) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export class ParticleSimulation {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly compute: GPUComputationRenderer;
  private readonly positionVariable: Variable;
  private readonly velocityVariable: Variable;
  private readonly homeTexture: THREE.DataTexture;

  constructor(renderer: THREE.WebGLRenderer, profile: OrbitQualityProfile) {
    this.compute = new GPUComputationRenderer(profile.textureWidth, profile.textureHeight, renderer);
    const positionTexture = this.compute.createTexture();
    const velocityTexture = this.compute.createTexture();
    this.homeTexture = this.compute.createTexture();
    const positionData = positionTexture.image.data as Float32Array;
    const velocityData = velocityTexture.image.data as Float32Array;
    const homeData = this.homeTexture.image.data as Float32Array;
    const random = mulberry32(0x0b17cafe);

    for (let index = 0; index < profile.particleCount; index += 1) {
      const offset = index * 4;
      const selector = random();
      const population = selector < 0.755 ? 0 : selector < 0.958 ? 1 : 2;
      const z = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const planar = Math.sqrt(Math.max(0, 1 - z * z));
      const x = Math.cos(angle) * planar;
      const y = Math.sin(angle) * planar;
      const warp = 1 + Math.sin(x * 3.1 + y * 1.7) * 0.012 + (random() - 0.5) * 0.018;
      const targetRadius = population === 0
        ? THREE.MathUtils.lerp(1.08, 1.2, random())
        : population === 1 ? THREE.MathUtils.lerp(1.17, 1.38, random()) : THREE.MathUtils.lerp(1.22, 1.58, Math.pow(random(), 0.62));
      positionData[offset] = x * targetRadius * warp;
      positionData[offset + 1] = y * targetRadius * warp;
      positionData[offset + 2] = z * targetRadius * warp;
      positionData[offset + 3] = targetRadius;
      velocityData[offset] = (random() - 0.5) * 0.008;
      velocityData[offset + 1] = (random() - 0.5) * 0.008;
      velocityData[offset + 2] = (random() - 0.5) * 0.008;
      velocityData[offset + 3] = population;
      homeData[offset] = x;
      homeData[offset + 1] = y;
      homeData[offset + 2] = z;
      homeData[offset + 3] = random();
    }

    this.positionVariable = this.compute.addVariable("texturePosition", simulationPositionShader, positionTexture);
    this.velocityVariable = this.compute.addVariable("textureVelocity", simulationVelocityShader, velocityTexture);
    this.compute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
    this.compute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);
    Object.assign(this.positionVariable.material.uniforms, { uDelta: { value: 0 }, uTime: { value: 0 } });
    Object.assign(this.velocityVariable.material.uniforms, {
      textureHome: { value: this.homeTexture }, uDelta: { value: 0 }, uTime: { value: 0 }, uMotion: { value: 1 },
      uReducedMotion: { value: 0 }, uPointer: { value: new THREE.Vector3() }, uPointerStrength: { value: 0 },
      uOverall: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 },
      uTransient: { value: 0 }, uTransientAge: { value: 10 },
    });

    const references = new Float32Array(profile.particleCount * 2);
    const seeds = new Float32Array(profile.particleCount);
    for (let index = 0; index < profile.particleCount; index += 1) {
      references[index * 2] = (index % profile.textureWidth + 0.5) / profile.textureWidth;
      references[index * 2 + 1] = (Math.floor(index / profile.textureWidth) + 0.5) / profile.textureHeight;
      seeds[index] = random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(profile.particleCount * 3), 3));
    geometry.setAttribute("aReference", new THREE.BufferAttribute(references, 2));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: particlesVertexShader, fragmentShader: particlesFragmentShader,
      uniforms: { texturePosition: { value: positionTexture }, textureVelocity: { value: velocityTexture }, uPixelRatio: { value: 1 }, uPointScale: { value: 0.021 }, uOverall: { value: 0 }, uHigh: { value: 0 } },
      transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    const error = this.compute.init();
    if (error) { this.dispose(); throw new Error(error); }
  }

  update(frame: SimulationFrame) {
    const position = this.positionVariable.material.uniforms;
    const velocity = this.velocityVariable.material.uniforms;
    position.uDelta.value = frame.delta; position.uTime.value = frame.elapsed;
    velocity.uDelta.value = frame.delta; velocity.uTime.value = frame.elapsed; velocity.uMotion.value = frame.motion;
    velocity.uReducedMotion.value = frame.reducedMotion ? 1 : 0; velocity.uPointer.value.copy(frame.pointer.current);
    velocity.uPointerStrength.value = frame.pointer.strength; velocity.uOverall.value = frame.audio.overall;
    velocity.uBass.value = frame.audio.bass; velocity.uMid.value = frame.audio.mid; velocity.uHigh.value = frame.audio.high;
    velocity.uTransient.value = frame.audio.transient; velocity.uTransientAge.value = frame.transientAge;
    this.compute.compute();
    this.points.material.uniforms.texturePosition.value = this.compute.getCurrentRenderTarget(this.positionVariable).texture;
    this.points.material.uniforms.textureVelocity.value = this.compute.getCurrentRenderTarget(this.velocityVariable).texture;
    this.points.material.uniforms.uPixelRatio.value = frame.pixelRatio;
    this.points.material.uniforms.uOverall.value = frame.audio.overall;
    this.points.material.uniforms.uHigh.value = frame.audio.high;
  }

  dispose() {
    this.points?.geometry.dispose();
    this.points?.material.dispose();
    this.homeTexture?.dispose();
    this.compute.dispose();
  }
}
