import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { EMPTY_AUDIO_FEATURES, type OrbitAudioFeatures } from "../audio/AudioFeatures";
import { PointerField } from "../interaction/PointerField";
import type { OrbitMotion } from "../settings";
import { inspectRendererCapabilities, type OrbitRendererBackend } from "./capabilities";
import { ParticleSimulation } from "./ParticleSimulation";
import { ProceduralFallback } from "./ProceduralFallback";
import {
  ORBIT_QUALITY_PROFILES,
  cappedPixelRatio,
  chooseAutoQuality,
  chooseInitialQuality,
  type OrbitQualityMode,
  type OrbitResolvedQuality,
} from "./quality";

type OrbitVisual = ParticleSimulation | ProceduralFallback;

export type OrbitRuntimeState = {
  backend: OrbitRendererBackend;
  resolvedQuality: OrbitResolvedQuality;
  fallbackReason?: string;
};

type OrbitRendererOptions = {
  canvas: HTMLCanvasElement;
  quality: OrbitQualityMode;
  motion: OrbitMotion;
  readAudio: (deltaSeconds: number) => OrbitAudioFeatures;
  onState: (state: OrbitRuntimeState) => void;
  onFailure: (message: string) => void;
};

const MOTION_SCALE: Record<OrbitMotion, number> = {
  calm: 0.68,
  balanced: 1,
  alive: 1.26,
};

export class OrbitRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
  private readonly pointer = new PointerField();
  private readonly resizeObserver: ResizeObserver;
  private readonly mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  private readonly readAudio: OrbitRendererOptions["readAudio"];
  private readonly onState: OrbitRendererOptions["onState"];
  private readonly onFailure: OrbitRendererOptions["onFailure"];
  private visual: OrbitVisual | null = null;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private outputPass: OutputPass | null = null;
  private backend: OrbitRendererBackend = "procedural";
  private fallbackReason: string | undefined;
  private qualityMode: OrbitQualityMode;
  private resolvedQuality: OrbitResolvedQuality;
  private motion: OrbitMotion;
  private reducedMotion = this.mediaQuery.matches;
  private frameHandle = 0;
  private lastTime = 0;
  private elapsed = 0;
  private warmup = 0;
  private averageFrameMs = 16.7;
  private slowFrames = 0;
  private fastFrames = 0;
  private transientAge = 10;
  private previousTransient = 0;
  private disposed = false;

  constructor(options: OrbitRendererOptions) {
    this.canvas = options.canvas;
    this.qualityMode = options.quality;
    this.resolvedQuality = chooseInitialQuality(options.quality);
    this.motion = options.motion;
    this.readAudio = options.readAudio;
    this.onState = options.onState;
    this.onFailure = options.onFailure;
    this.scene.background = new THREE.Color(0x000000);
    this.camera.position.set(0, 0, 4.35);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setClearColor(0x000000, 1);

    this.replaceVisual();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.mediaQuery.addEventListener("change", this.handleReducedMotion);
    this.resize();
    this.start();
  }

  setQuality(mode: OrbitQualityMode) {
    if (mode === this.qualityMode) return;
    this.qualityMode = mode;
    const next = chooseInitialQuality(mode);
    if (next !== this.resolvedQuality) {
      this.resolvedQuality = next;
      this.replaceVisual();
      this.resize();
    }
  }

  setMotion(motion: OrbitMotion) {
    this.motion = motion;
  }

  pointerMove(clientX: number, clientY: number) {
    this.pointer.updateFromClient(clientX, clientY, this.canvas.getBoundingClientRect(), this.camera);
  }

  pointerLeave() {
    this.pointer.leave();
  }

  retry() {
    this.replaceVisual();
    this.start();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.mediaQuery.removeEventListener("change", this.handleReducedMotion);
    this.disposeVisual();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private replaceVisual() {
    this.disposeVisual();
    const profile = ORBIT_QUALITY_PROFILES[this.resolvedQuality];
    const capabilities = inspectRendererCapabilities(this.renderer);
    this.backend = capabilities.backend;
    this.fallbackReason = capabilities.reason;

    if (capabilities.backend === "gpgpu") {
      try {
        this.visual = new ParticleSimulation(this.renderer, profile);
      } catch (error) {
        this.backend = "procedural";
        this.fallbackReason = error instanceof Error ? error.message : "GPU simulation initialization failed.";
        this.visual = new ProceduralFallback(profile);
      }
    } else {
      this.visual = new ProceduralFallback(profile);
    }
    this.scene.add(this.visual.points);
    this.configurePostProcessing();
    this.warmup = 0;
    this.slowFrames = 0;
    this.fastFrames = 0;
    this.onState({
      backend: this.backend,
      resolvedQuality: this.resolvedQuality,
      fallbackReason: this.fallbackReason,
    });
  }

  private disposeVisual() {
    if (this.visual) {
      this.scene.remove(this.visual.points);
      this.visual.dispose();
      this.visual = null;
    }
    this.composer?.dispose();
    this.renderPass?.dispose();
    this.bloomPass?.dispose();
    this.outputPass?.dispose();
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.outputPass = null;
  }

  private configurePostProcessing() {
    const profile = ORBIT_QUALITY_PROFILES[this.resolvedQuality];
    if (!profile.bloom) return;
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), profile.bloomStrength, 0.22, 0.86);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
  }

  private resize() {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const profile = ORBIT_QUALITY_PROFILES[this.resolvedQuality];
    const pixelRatio = cappedPixelRatio(profile, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.composer?.setPixelRatio(pixelRatio);
    this.composer?.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private start() {
    if (this.disposed || this.frameHandle || document.hidden) return;
    this.lastTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  private frame = (time: number) => {
    this.frameHandle = 0;
    if (this.disposed || document.hidden) return;
    const rawDelta = Math.max(0, (time - this.lastTime) / 1_000);
    const delta = Math.min(rawDelta || 1 / 60, 0.034);
    this.lastTime = time;
    this.elapsed += delta;
    this.warmup += delta;
    this.pointer.step(delta, this.reducedMotion);
    const audio = this.readAudio(delta) ?? EMPTY_AUDIO_FEATURES;
    if (audio.transient > 0.11 && audio.transient > this.previousTransient + 0.018) this.transientAge = 0;
    else this.transientAge += delta;
    this.previousTransient = audio.transient;

    const pixelRatio = this.renderer.getPixelRatio();
    const motion = MOTION_SCALE[this.motion];
    try {
      if (this.visual instanceof ParticleSimulation) {
        this.visual.update({
          delta,
          elapsed: this.elapsed,
          motion,
          reducedMotion: this.reducedMotion,
          pointer: this.pointer,
          audio,
          transientAge: this.transientAge,
          pixelRatio,
        });
      } else {
        this.visual?.update({ elapsed: this.elapsed, motion, reducedMotion: this.reducedMotion, audio, pixelRatio });
      }
      if (this.composer) this.composer.render(delta);
      else this.renderer.render(this.scene, this.camera);
      this.observePerformance(rawDelta * 1_000);
    } catch (error) {
      this.onFailure(error instanceof Error ? error.message : "The visual field stopped unexpectedly.");
      return;
    }
    this.frameHandle = requestAnimationFrame(this.frame);
  };

  private observePerformance(frameMs: number) {
    if (this.qualityMode !== "auto" || this.warmup < 4 || !Number.isFinite(frameMs)) return;
    this.averageFrameMs += (frameMs - this.averageFrameMs) * 0.025;
    this.slowFrames = this.averageFrameMs > 22 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
    this.fastFrames = this.averageFrameMs < 12.8 ? this.fastFrames + 1 : Math.max(0, this.fastFrames - 2);
    const next = chooseAutoQuality(this.resolvedQuality, this.averageFrameMs, this.slowFrames, this.fastFrames);
    if (next === this.resolvedQuality) return;
    this.resolvedQuality = next;
    this.replaceVisual();
    this.resize();
  }

  private handleVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
      return;
    }
    this.start();
  };

  private handleReducedMotion = (event: MediaQueryListEvent) => {
    this.reducedMotion = event.matches;
  };

  private handleContextLost = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    this.onFailure("The graphics context was interrupted.");
  };

  private handleContextRestored = () => {
    if (this.disposed) return;
    try {
      this.replaceVisual();
      this.resize();
      this.start();
    } catch {
      this.onFailure("Orbit could not restore the visual field.");
    }
  };
}
