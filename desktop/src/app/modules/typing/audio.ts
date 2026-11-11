/** Original, quiet synthesized feedback. No downloaded samples or network requests. */
export class TypingAudio {
  private context: AudioContext | null = null;
  private voices = 0;

  play(kind: "key" | "space" | "error" | "finish", volume: number) {
    if (volume <= 0 || this.voices >= 6) return;
    try {
      const context = this.context ??= new AudioContext();
      if (context.state === "suspended") {
        void context.resume().then(() => { if (this.context === context) this.play(kind, volume); }).catch(() => {});
        return;
      }
      if (context.state !== "running") return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const time = context.currentTime;
      const length = kind === "finish" ? .22 : .035;
      oscillator.type = kind === "error" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(kind === "finish" ? 660 : kind === "error" ? 170 : kind === "space" ? 320 : 520, time);
      oscillator.frequency.exponentialRampToValueAtTime(kind === "finish" ? 880 : 110, time + length);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(volume / 100 * .075, time + .003);
      gain.gain.exponentialRampToValueAtTime(.0001, time + length);
      oscillator.connect(gain); gain.connect(context.destination);
      this.voices++;
      oscillator.onended = () => { this.voices--; oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(time); oscillator.stop(time + length);
    } catch { /* Sound is optional; unavailable audio must never interrupt input. */ }
  }

  close() { const context = this.context; this.context = null; if (context) void context.close().catch(() => {}); }
}
