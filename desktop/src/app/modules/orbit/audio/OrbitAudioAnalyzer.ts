import { averageNormalizedBins, frequencyBinRange, gateAndNormalize, type OrbitAudioFeatures } from "./AudioFeatures";
import { SmoothedSignal } from "./SmoothedSignal";

export type OrbitAudioStatus = "idle" | "requesting" | "listening" | "denied" | "unavailable";

export class OrbitAudioAnalyzer {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private frequencyData = new Uint8Array(0);
  private previousOverall = 0;
  private readonly smoothers = {
    overall: new SmoothedSignal(),
    bass: new SmoothedSignal(),
    mid: new SmoothedSignal(),
    high: new SmoothedSignal(),
    transient: new SmoothedSignal(),
  };

  status: OrbitAudioStatus = "idle";

  async start(): Promise<OrbitAudioStatus> {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      this.status = "unavailable";
      return this.status;
    }
    this.status = "requesting";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.22;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      this.stream = stream;
      this.context = context;
      this.analyser = analyser;
      this.source = source;
      this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
      this.status = "listening";
    } catch (error) {
      this.status = error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "unavailable";
    }
    return this.status;
  }

  sample(deltaSeconds: number, sensitivity: number): OrbitAudioFeatures {
    const analyser = this.analyser;
    const context = this.context;
    if (!analyser || !context || this.status !== "listening") return this.settle(deltaSeconds);

    analyser.getByteFrequencyData(this.frequencyData);
    const bins = this.frequencyData.length;
    const band = (min: number, max: number) => {
      const [start, end] = frequencyBinRange(min, max, context.sampleRate, analyser.fftSize, bins);
      return averageNormalizedBins(this.frequencyData, start, end);
    };
    const floor = 0.012;
    const overall = gateAndNormalize(band(40, 9_000), floor, sensitivity * 1.15);
    const bass = gateAndNormalize(band(40, 220), floor, sensitivity * 1.35);
    const mid = gateAndNormalize(band(220, 2_400), floor, sensitivity * 1.45);
    const high = gateAndNormalize(band(2_400, 9_000), floor * 0.8, sensitivity * 1.8);
    const onset = Math.max(0, overall - this.previousOverall * 1.08);
    this.previousOverall = overall;

    return {
      overall: this.smoothers.overall.update(overall, deltaSeconds, 13, 3.2),
      bass: this.smoothers.bass.update(bass, deltaSeconds, 16, 3.8),
      mid: this.smoothers.mid.update(mid, deltaSeconds, 8, 2.6),
      high: this.smoothers.high.update(high, deltaSeconds, 18, 5),
      transient: this.smoothers.transient.update(onset * 3.2, deltaSeconds, 28, 4.6),
    };
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.source?.disconnect();
    this.analyser?.disconnect();
    void this.context?.close();
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.context = null;
    this.frequencyData = new Uint8Array(0);
    this.previousOverall = 0;
    Object.values(this.smoothers).forEach((signal) => signal.reset());
    if (this.status === "listening" || this.status === "requesting") this.status = "idle";
  }

  private settle(deltaSeconds: number): OrbitAudioFeatures {
    return {
      overall: this.smoothers.overall.update(0, deltaSeconds, 1, 2.4),
      bass: this.smoothers.bass.update(0, deltaSeconds, 1, 2.8),
      mid: this.smoothers.mid.update(0, deltaSeconds, 1, 2.2),
      high: this.smoothers.high.update(0, deltaSeconds, 1, 3.4),
      transient: this.smoothers.transient.update(0, deltaSeconds, 1, 4.8),
    };
  }
}
