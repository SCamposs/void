export class SmoothedSignal {
  private value: number;

  constructor(initial = 0) {
    this.value = initial;
  }

  update(target: number, deltaSeconds: number, attack: number, release: number): number {
    const safeTarget = Number.isFinite(target) ? target : 0;
    const safeDelta = Math.max(0, Math.min(0.1, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
    const rate = safeTarget > this.value ? attack : release;
    const blend = 1 - Math.exp(-Math.max(0, rate) * safeDelta);
    this.value += (safeTarget - this.value) * blend;
    return this.value;
  }

  reset(value = 0) {
    this.value = value;
  }

  current() {
    return this.value;
  }
}
