import { useMemo, useState, type ReactNode } from "react";
import {
  buildTypingTimeline,
  computeAdvancedMetrics,
  getWordCharacterFeedback,
  type TypingInputEvent,
  type TypingWordTrace,
} from "./engine";
import type { TypingLanguage } from "./words";

type ResultView = "overview" | "history" | "pace" | "wpm" | "advanced";

const chartColors = {
  wpm: "#f2efe5",
  error: "#d6535d",
  modification: "#d69a4b",
  pace: "#83a36b",
};

function HistoryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.6">
    <path d="M4.2 8.4A8 8 0 1 1 4 15.2" />
    <path d="M4.2 4.8v3.8H8" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>;
}

function GaugeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.6">
    <path d="M4 17a8 8 0 1 1 16 0" />
    <path d="M12 17l4.2-5.2" />
    <path d="M6.5 14.5l-1.8-.7M17.5 14.5l1.8-.7M8 10l-1.2-1.4M16 10l1.2-1.4M12 9V7" />
  </svg>;
}

function FireIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.6">
    <path d="M13.5 3.5c.5 3-1.8 4-1.8 6.3 0 1.3.8 2.1 1.8 2.1 1.5 0 2.2-1.5 1.9-3.1 2.3 1.7 3.6 4 3.3 6.5-.4 3.2-3 5.2-6.5 5.2-3.9 0-6.9-2.5-6.9-6.2 0-3.2 2.1-5.2 4.7-7.8-.2 2.5.7 3.6 1.7 3.8" />
  </svg>;
}

function TelescopeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.6">
    <path d="m5 8 11-4 2 5L7 13Z" />
    <path d="m15 10 3 3M11 12l1.5 3M12.5 15 9 21M12.5 15l4 6M8 21h9" />
  </svg>;
}

function ResultIconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return <span className="group relative">
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center border text-[var(--muted)] transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]"
          : "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[10px] text-[var(--text)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {label}
    </span>
  </span>;
}

function ResultToolbar({
  view,
  setView,
}: {
  view: ResultView;
  setView: (view: ResultView) => void;
}) {
  const toggle = (next: Exclude<ResultView, "overview">) => {
    setView(view === next ? "overview" : next);
  };
  return <div className="flex items-center gap-1" aria-label="Result analysis views">
    <ResultIconButton label="Show input history" active={view === "history"} onClick={() => toggle("history")}>
      <HistoryIcon />
    </ResultIconButton>
    <ResultIconButton label="Show pace heatmap" active={view === "pace"} onClick={() => toggle("pace")}>
      <GaugeIcon />
    </ResultIconButton>
    <ResultIconButton label="Show WPM heatmap" active={view === "wpm"} onClick={() => toggle("wpm")}>
      <FireIcon />
    </ResultIconButton>
    <ResultIconButton label="Show advanced results" active={view === "advanced"} onClick={() => toggle("advanced")}>
      <TelescopeIcon />
    </ResultIconButton>
  </div>;
}

function TimelineChart({
  events,
  duration,
  speedLabel,
}: {
  events: TypingInputEvent[];
  duration: number;
  speedLabel: string;
}) {
  const samples = useMemo(() => buildTypingTimeline(events, duration), [duration, events]);
  const width = 920;
  const height = 280;
  const left = 48;
  const right = 48;
  const top = 24;
  const bottom = 32;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxWpm = Math.max(40, Math.ceil(Math.max(...samples.map((sample) => sample.wpm), 0) / 20) * 20);
  const maxPace = Math.max(500, Math.ceil(Math.max(...samples.map((sample) => sample.millisecondsPerCharacter), 0) / 250) * 250);
  const x = (second: number) => left + ((second - 1) / Math.max(1, samples.length - 1)) * plotWidth;
  const yWpm = (wpm: number) => top + plotHeight - (Math.min(maxWpm, wpm) / maxWpm) * plotHeight;
  const yPace = (pace: number) => top + plotHeight - (Math.min(maxPace, pace) / maxPace) * plotHeight;
  const wpmPoints = samples.map((sample) => `${x(sample.second)},${yWpm(sample.wpm)}`).join(" ");
  const pacePoints = samples.map((sample) => `${x(sample.second)},${yPace(sample.millisecondsPerCharacter)}`).join(" ");
  const areaPath = samples.length === 0
    ? ""
    : `M ${x(samples[0].second)} ${top + plotHeight} L ${samples.map((sample) => `${x(sample.second)} ${yWpm(sample.wpm)}`).join(" L ")} L ${x(samples[samples.length - 1].second)} ${top + plotHeight} Z`;

  return <div>
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[var(--muted)]">
      <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-[var(--accent)]" />{speedLabel}</span>
      <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-[#d6535d]" />Errors</span>
      <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-[#d69a4b]" />Modifications</span>
      <span className="inline-flex items-center gap-1.5" title="Milliseconds per character"><i className="h-2 w-2 bg-[#83a36b]" />ms/c</span>
    </div>
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${speedLabel}, errors, modifications, and milliseconds per character over ${duration} seconds`}
      className="block h-auto w-full"
    >
      {Array.from({ length: 5 }, (_, gridIndex) => {
        const ratio = gridIndex / 4;
        const y = top + ratio * plotHeight;
        return <g key={gridIndex}>
          <line x1={left} x2={width - right} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
          <text x={left - 8} y={y + 4} textAnchor="end" fill="var(--subtle)" fontSize="10">
            {Math.round(maxWpm * (1 - ratio))}
          </text>
          <text x={width - right + 8} y={y + 4} fill="var(--subtle)" fontSize="10">
            {Math.round(maxPace * (1 - ratio))}
          </text>
        </g>;
      })}
      <path d={areaPath} fill="rgba(242,239,229,0.055)" />
      <polyline points={wpmPoints} fill="none" stroke={chartColors.wpm} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <polyline points={pacePoints} fill="none" stroke={chartColors.pace} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {samples.filter((sample) => sample.errors > 0).map((sample) => (
        <circle key={`error-${sample.second}`} cx={x(sample.second)} cy={yWpm(sample.wpm)} r={3.5} fill={chartColors.error}>
          <title>{sample.errors} error{sample.errors === 1 ? "" : "s"} at {sample.second}s</title>
        </circle>
      ))}
      {samples.filter((sample) => sample.modifications > 0).map((sample) => (
        <rect
          key={`modification-${sample.second}`}
          x={x(sample.second) - 3}
          y={Math.min(top + plotHeight - 7, yWpm(sample.wpm) + 7)}
          width={6}
          height={6}
          fill={chartColors.modification}
        >
          <title>{sample.modifications} modification{sample.modifications === 1 ? "" : "s"} at {sample.second}s</title>
        </rect>
      ))}
      {[1, Math.ceil(duration / 4), Math.ceil(duration / 2), Math.ceil((duration * 3) / 4), duration].map((second) => (
        <text key={second} x={x(second)} y={height - 8} textAnchor="middle" fill="var(--subtle)" fontSize="10">{second}s</text>
      ))}
    </svg>
  </div>;
}

function InputHistory({ traces }: { traces: TypingWordTrace[] }) {
  return <div className="max-h-[310px] overflow-auto pr-2 text-lg leading-[1.8] sm:text-xl">
    {traces.map((trace) => (
      <span
        key={trace.index}
        className={`mr-[0.75ch] inline-flex whitespace-nowrap ${
          trace.corrections > 0 ? "border-b border-[#d69a4b]" : ""
        }`}
        title={trace.corrections > 0 ? `${trace.corrections} modification${trace.corrections === 1 ? "" : "s"}` : undefined}
      >
        {getWordCharacterFeedback(trace.expectedWord, trace.typedWord, true).map((character, index) => (
          <span
            key={`${trace.index}-${index}`}
            className={character.state === "incorrect" ? "text-[#e36a73] underline decoration-[#e36a73] underline-offset-4" : "text-[var(--text)]"}
          >
            {character.character}
          </span>
        ))}
      </span>
    ))}
  </div>;
}

const paceTones = [
  { label: "0–50", className: "text-[#f2efe5]" },
  { label: "51–100", className: "text-[#dce4d8]" },
  { label: "101–150", className: "text-[#bad0b1]" },
  { label: "151–200", className: "text-[#d9c47a]" },
  { label: "201–250", className: "text-[#dc935a]" },
  { label: "251+", className: "text-[#e06a74]" },
];

const wpmTones = [
  { label: "0–40", className: "text-[#e06a74]" },
  { label: "41–60", className: "text-[#dc935a]" },
  { label: "61–80", className: "text-[#d9c47a]" },
  { label: "81–100", className: "text-[#bad0b1]" },
  { label: "101–120", className: "text-[#dce4d8]" },
  { label: "121+", className: "text-[#f2efe5]" },
];

function getPaceTone(value: number) {
  if (value <= 50) return paceTones[0];
  if (value <= 100) return paceTones[1];
  if (value <= 150) return paceTones[2];
  if (value <= 200) return paceTones[3];
  if (value <= 250) return paceTones[4];
  return paceTones[5];
}

function getWpmTone(value: number) {
  if (value <= 40) return wpmTones[0];
  if (value <= 60) return wpmTones[1];
  if (value <= 80) return wpmTones[2];
  if (value <= 100) return wpmTones[3];
  if (value <= 120) return wpmTones[4];
  return wpmTones[5];
}

function Heatmap({
  traces,
  mode,
}: {
  traces: TypingWordTrace[];
  mode: "pace" | "wpm";
}) {
  const tones = mode === "pace" ? paceTones : wpmTones;
  return <div>
    <div className="mb-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px]">
      {tones.map((tone) => <span key={tone.label} className={tone.className}>
        {tone.label} {mode === "pace" ? "ms/c" : "WPM"}
      </span>)}
    </div>
    <div className="max-h-[290px] overflow-auto pr-2 text-lg leading-[1.8] sm:text-xl">
      {traces.map((trace) => {
        const value = mode === "pace" ? trace.millisecondsPerCharacter : trace.wordWpm;
        const tone = mode === "pace" ? getPaceTone(value) : getWpmTone(value);
        return <span
          key={trace.index}
          className={`mr-[0.75ch] inline-block whitespace-nowrap ${tone.className} ${
            trace.isCorrectWord ? "" : "underline decoration-[#e36a73] underline-offset-4"
          }`}
          title={`${value.toFixed(0)} ${mode === "pace" ? "ms/c" : "WPM"}`}
        >
          {trace.expectedWord}
        </span>;
      })}
    </div>
  </div>;
}

function AdvancedResults({
  traces,
  events,
  duration,
}: {
  traces: TypingWordTrace[];
  events: TypingInputEvent[];
  duration: number;
}) {
  const metrics = useMemo(() => computeAdvancedMetrics(traces, events, duration), [duration, events, traces]);
  const groups = [
    [
      ["Correct words", metrics.correctWords],
      ["Correct characters", metrics.correctCharacters],
      ["Correct keystrokes", metrics.correctKeystrokes],
      ["Incorrect words", metrics.incorrectWords],
      ["Wrong characters", metrics.wrongCharacters],
      ["Wrong keystrokes", metrics.wrongKeystrokes],
      ["Spaces", metrics.spaces],
    ],
    [
      ["Corrected characters", metrics.correctedCharacters],
      ["Corrected keystrokes", metrics.correctedKeystrokes],
      ["Missed characters", metrics.missedCharacters],
      ["Extra characters", metrics.extraCharacters],
      ["Extra keystrokes", metrics.extraKeystrokes],
      ["Total keys", metrics.totalKeys],
    ],
    [
      ["Raw WPM", metrics.rawWpm],
      ["Duration", `${duration}s`],
      ["Pace", `${metrics.paceWpm} WPM`],
      ["CPM", metrics.cpm],
      ["Raw CPM", metrics.rawCpm],
      ["KPM", metrics.kpm],
      ["Raw KPM", metrics.rawKpm],
      ["Consistency", `${metrics.consistency}%`],
    ],
  ] as const;

  return <div className="grid gap-x-8 gap-y-4 text-xs md:grid-cols-3">
    {groups.map((group, groupIndex) => <dl key={groupIndex} className="divide-y divide-[var(--border)]">
      {group.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 py-2">
        <dt className="text-[var(--muted)]">{label}</dt>
        <dd className="text-right text-[var(--text)]">{value}</dd>
      </div>)}
    </dl>)}
  </div>;
}

export function TypingResults({
  traces,
  events,
  duration,
  wpm,
  accuracy,
  language,
  onRestart,
}: {
  traces: TypingWordTrace[];
  events: TypingInputEvent[];
  duration: number;
  wpm: number;
  accuracy: number;
  language: TypingLanguage;
  onRestart: () => void;
}) {
  const [view, setView] = useState<ResultView>("overview");
  const speedLabel = language === "pt-BR" ? "PPM" : "WPM";

  return <section aria-label="Typing test results">
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
      <ResultToolbar view={view} setView={setView} />
      <button
        type="button"
        onClick={onRestart}
        className="border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface2)]"
      >
        Restart test
      </button>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--border)] py-5">
      <div className="flex gap-8">
        <div>
          <div className="text-[10px] text-[var(--muted)]">{language === "pt-BR" ? "Palavras por minuto" : "Words per minute"}</div>
          <div className="mt-1 text-4xl leading-none text-[var(--accent)]">{wpm.toFixed(0)} <span className="text-lg">{speedLabel.toLowerCase()}</span></div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--muted)]">Accuracy</div>
          <div className="mt-1 text-4xl leading-none text-[var(--accent)]">{accuracy.toFixed(0)}%</div>
        </div>
      </div>
      <div className="text-right text-[10px] text-[var(--subtle)]">
        {duration}s · {language.toUpperCase()} · {traces.length} words
      </div>
    </div>
    <div className="pt-5">
      {view === "overview" && <TimelineChart events={events} duration={duration} speedLabel={speedLabel} />}
      {view === "history" && <InputHistory traces={traces} />}
      {view === "pace" && <Heatmap traces={traces} mode="pace" />}
      {view === "wpm" && <Heatmap traces={traces} mode="wpm" />}
      {view === "advanced" && <AdvancedResults traces={traces} events={events} duration={duration} />}
    </div>
  </section>;
}
