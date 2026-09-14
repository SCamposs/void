import * as THREE from "three";

export function pointerFalloff(distance: number, radius: number): number {
  if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0 || distance >= radius) return 0;
  const normalized = 1 - Math.max(0, distance) / radius;
  return normalized * normalized * (3 - 2 * normalized);
}

export class PointerField {
  readonly target = new THREE.Vector3(0, 0, 1.2);
  readonly current = new THREE.Vector3(0, 0, 1.2);
  strength = 0;
  private targetStrength = 0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly sphere = new THREE.Sphere(new THREE.Vector3(), 1.36);

  updateFromClient(clientX: number, clientY: number, rect: DOMRect, camera: THREE.Camera) {
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1),
    );
    this.raycaster.setFromCamera(ndc, camera);
    const hit = this.raycaster.ray.intersectSphere(this.sphere, this.target);
    if (hit) {
      this.targetStrength = 1;
      return;
    }
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    if (this.raycaster.ray.intersectPlane(plane, this.target)) {
      this.target.clampLength(0, 1.6);
      this.targetStrength = 0.32;
    }
  }

  leave() {
    this.targetStrength = 0;
  }

  step(deltaSeconds: number, reducedMotion: boolean) {
    const pointBlend = 1 - Math.exp(-10 * Math.min(0.1, deltaSeconds));
    const strengthBlend = 1 - Math.exp(-(this.targetStrength > this.strength ? 12 : 3.5) * Math.min(0.1, deltaSeconds));
    this.current.lerp(this.target, pointBlend);
    const target = this.targetStrength * (reducedMotion ? 0.22 : 1);
    this.strength += (target - this.strength) * strengthBlend;
  }
}
