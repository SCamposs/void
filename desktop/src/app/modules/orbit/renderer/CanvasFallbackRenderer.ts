import type { OrbitAudioFeatures } from "../audio/AudioFeatures";
import type { OrbitMotion } from "../settings";

type CanvasFallbackOptions = {
  canvas: HTMLCanvasElement;
  motion: OrbitMotion;
  readAudio: (deltaSeconds: number) => OrbitAudioFeatures;
};

type FallbackParticle = { x: number; y: number; z: number; seed: number; population: number };

const MOTION_SCALE: Record<OrbitMotion, number> = { calm: 0.55, balanced: 1, alive: 1.35 };

function mulberry32(seed: number) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export class CanvasFallbackRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly buffer = document.createElement("canvas");
  private readonly bufferContext: CanvasRenderingContext2D;
  private readonly readAudio: CanvasFallbackOptions["readAudio"];
  private readonly particles: FallbackParticle[] = [];
  private readonly observer: ResizeObserver;
  private readonly mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  private motion: OrbitMotion;
  private reducedMotion = this.mediaQuery.matches;
  private frameHandle = 0;
  private lastTime = 0;
  private elapsed = 0;
  private pointerX = 0;
  private pointerY = 0;
  private pointerStrength = 0;
  private pointerTarget = 0;
  private disposed = false;

  constructor(options: CanvasFallbackOptions) {
    this.canvas = options.canvas;
    const context = this.canvas.getContext("2d", { alpha: false });
    const bufferContext = this.buffer.getContext("2d", { alpha: false });
    if (!context || !bufferContext) throw new Error("Canvas rendering is unavailable.");
    this.context = context;
    this.bufferContext = bufferContext;
    this.motion = options.motion;
    this.readAudio = options.readAudio;
    const random = mulberry32(0x0b17fa11);
    for (let index = 0; index < 3_600; index += 1) {
      const z = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const planar = Math.sqrt(Math.max(0, 1 - z * z));
      const selector = random();
      const population = selector < 0.76 ? 0 : selector < 0.96 ? 1 : 2;
      this.particles.push({ x: Math.cos(angle) * planar, y: Math.sin(angle) * planar, z, seed: random(), population });
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.canvas.parentElement ?? this.canvas);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.mediaQuery.addEventListener("change", this.handleReducedMotion);
    this.resize();
    this.start();
  }

  setQuality() {}
  setMotion(motion: OrbitMotion) { this.motion = motion; }

  pointerMove(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = (clientX - rect.left) / Math.max(1, rect.width) * 2 - 1;
    this.pointerY = -((clientY - rect.top) / Math.max(1, rect.height) * 2 - 1);
    this.pointerTarget = 1;
  }

  pointerLeave() { this.pointerTarget = 0; }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    this.observer.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.mediaQuery.removeEventListener("change", this.handleReducedMotion);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(1.25, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    this.canvas.width = width;
    this.canvas.height = height;
    this.buffer.width = width;
    this.buffer.height = height;
  }

  private start() {
    if (this.disposed || this.frameHandle || document.hidden) return;
    this.lastTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  private frame = (time: number) => {
    this.frameHandle = 0;
    if (this.disposed || document.hidden) return;
    const delta = Math.min(0.034, Math.max(1 / 240, (time - this.lastTime) / 1_000));
    this.lastTime = time;
    this.elapsed += delta;
    const audio = this.readAudio(delta);
    const blend = 1 - Math.exp(-(this.pointerTarget > this.pointerStrength ? 10 : 3) * delta);
    const pointerTarget = this.pointerTarget * (this.reducedMotion ? 0.2 : 1);
    this.pointerStrength += (pointerTarget - this.pointerStrength) * blend;
    this.draw(audio);
    this.frameHandle = requestAnimationFrame(this.frame);
  };

  private draw(audio: OrbitAudioFeatures) {
    const context = this.bufferContext;
    const width = this.buffer.width;
    const height = this.buffer.height;
    const radius = Math.min(width, height) * 0.275;
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const motion = MOTION_SCALE[this.motion] * (this.reducedMotion ? 0.28 : 1);
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "lighter";
    context.fillStyle = "rgb(214, 235, 249)";

    for (const particle of this.particles) {
      const populationRadius = particle.population === 0 ? 1 : particle.population === 1 ? 1.1 : 1.29;
      const phase = particle.seed * 37.1;
      const broad = Math.sin(this.elapsed * 0.29 + phase + particle.y * 2.4);
      const detail = Math.cos(this.elapsed * 0.19 - phase * 0.37 + particle.x * 4.1);
      const breath = 1 + Math.sin(this.elapsed * 0.31 + phase) * 0.013 * motion + audio.bass * 0.065;
      const tangentX = -particle.y * broad * 0.035 + particle.z * detail * 0.022;
      const tangentY = particle.x * broad * 0.035 - particle.z * Math.sin(phase + this.elapsed * 0.23) * 0.02;
      let x = particle.x * populationRadius * breath + tangentX * motion * (1 + audio.mid * 1.2);
      let y = particle.y * populationRadius * breath + tangentY * motion * (1 + audio.mid * 1.2);
      const pointerDx = x - this.pointerX * 1.28;
      const pointerDy = y - this.pointerY * 1.28;
      const pointerDistance = Math.sqrt(pointerDx * pointerDx + pointerDy * pointerDy);
      const pointerFalloff = Math.max(0, 1 - pointerDistance / 0.42);
      if (pointerDistance > 0.001) {
        x += pointerDx / pointerDistance * pointerFalloff * pointerFalloff * this.pointerStrength * 0.12;
        y += pointerDy / pointerDistance * pointerFalloff * pointerFalloff * this.pointerStrength * 0.12;
      }
      const perspective = 0.88 + particle.z * 0.1;
      const size = (particle.population === 0 ? 0.72 : particle.population === 1 ? 0.56 : 0.46) + audio.high * 0.28;
      context.globalAlpha = (particle.population === 0 ? 0.5 : particle.population === 1 ? 0.28 : 0.2)
        * (0.68 + (particle.z + 1) * 0.16) * (0.82 + audio.overall * 0.85);
      context.fillRect(centerX + x * radius * perspective, centerY + y * radius * perspective, size, size);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    this.context.drawImage(this.buffer, 0, 0);
  }

  private handleVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    } else this.start();
  };

  private handleReducedMotion = (event: MediaQueryListEvent) => {
    this.reducedMotion = event.matches;
  };
}
