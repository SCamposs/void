import { Button } from "../../components/ui/Controls";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildTypingTimeline,
  computeAdvancedMetrics,
  getWordCharacterFeedback,
  hasWordError,
  type TypingInputEvent,
  type TypingWordTrace,
} from "./engine";
import type { TypingLanguage } from "./words";

type ResultView = "overview" | "history" | "pace" | "wpm" | "advanced";

const chartColors = {
  wpm: "var(--accent)",
  error: "#d6535d",
  modification: "#d69a4b",
  pace: "var(--muted)",
};

function ResultToolbar({ view, setView }: { view: ResultView; setView: (view: ResultView) => void }) {
  const views: { value: ResultView; label: string; name: string }[] = [
    { value: "overview", label: "Evolução", name: "Evolução" },
    { value: "history", label: "Digitação", name: "Histórico de digitação" },
    { value: "pace", label: "Ritmo", name: "Mapa de ritmo" },
    { value: "wpm", label: "Velocidade", name: "Velocidade por palavra" },
    { value: "advanced", label: "Detalhes", name: "Estatísticas detalhadas" },
  ];
  return <div className="typing-result-views" aria-label="Análises do resultado">
    {views.map(item => <Button key={item.value} aria-label={item.name} aria-pressed={view === item.value} onClick={() => setView(item.value)}>{item.label}</Button>)}
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
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
      <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-[var(--accent)]" />Ritmo de toques ({speedLabel})</span>
      <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-[#d6535d]" />Erros</span>
      <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-[#d69a4b]" />Correções</span>
      <span className="inline-flex items-center gap-1.5" title="Milissegundos por caractere"><i className="h-2 w-2 bg-[var(--muted)]" />ms/c</span>
    </div>
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Ritmo de toques, erros, correções e milissegundos por caractere durante ${duration} segundos`}
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
      <path d={areaPath} fill="rgba(235,244,255,0.04)" />
      <polyline points={wpmPoints} fill="none" stroke={chartColors.wpm} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <polyline points={pacePoints} fill="none" stroke={chartColors.pace} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {samples.filter((sample) => sample.errors > 0).map((sample) => (
        <circle key={`error-${sample.second}`} cx={x(sample.second)} cy={yWpm(sample.wpm)} r={3.5} fill={chartColors.error}>
          <title>{sample.errors} erro(s) em {sample.second}s</title>
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
          <title>{sample.modifications} correção(ões) em {sample.second}s</title>
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
        title={trace.corrections > 0 ? `${trace.corrections} correção(ões)` : undefined}
      >
        {getWordCharacterFeedback(trace.confirmed === false ? trace.expectedWord.slice(0, trace.typedWord.length) : trace.expectedWord, trace.typedWord, true).map((character, index) => (
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
    <div className="mb-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
      {tones.map((tone) => <span key={tone.label} className={tone.className}>
        {tone.label} {mode === "pace" ? "ms/c" : "PPM"}
      </span>)}
    </div>
    <div className="max-h-[290px] overflow-auto pr-2 text-lg leading-[1.8] sm:text-xl">
      {traces.map((trace) => {
        const value = mode === "pace" ? trace.millisecondsPerCharacter : trace.wordWpm;
        const tone = mode === "pace" ? getPaceTone(value) : getWpmTone(value);
        return <span
          key={trace.index}
          className={`mr-[0.75ch] inline-block whitespace-nowrap ${tone.className} ${
            hasWordError(trace) ? "underline decoration-[#e36a73] underline-offset-4" : ""
          }`}
          title={`${value.toFixed(0)} ${mode === "pace" ? "ms/c" : "PPM"}`}
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
      ["Palavras corretas", metrics.correctWords],
      ["Caracteres coincidentes", metrics.correctCharacters],
      ["Toques corretos", metrics.correctKeystrokes],
      ["Palavras com erro", metrics.incorrectWords],
      ["Caracteres errados", metrics.wrongCharacters],
      ["Toques errados", metrics.wrongKeystrokes],
      ["Espaços", metrics.spaces],
    ],
    [
      ["Caracteres corrigidos", metrics.correctedCharacters],
      ["Correções", metrics.correctedKeystrokes],
      ["Letras omitidas", metrics.missedCharacters],
      ["Caracteres extras", metrics.extraCharacters],
      ["Toques extras", metrics.extraKeystrokes],
      ["Total de ações", metrics.totalKeys],
    ],
    [
      ["PPM bruto de caracteres", metrics.rawWpm],
      ["Duração", `${duration}s`],
      ["Ritmo médio por palavra", `${metrics.paceWpm} PPM`],
      ["Caracteres coincidentes/min", metrics.cpm],
      ["Caracteres digitados/min", metrics.rawCpm],
      ["Toques corretos/min", metrics.kpm],
      ["Ações/min", metrics.rawKpm],
      ["Consistência", `${metrics.consistency}%`],
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
  const restartRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { restartRef.current?.focus({ preventScroll: true }); }, []);
  const speedLabel = language === "pt-BR" ? "PPM" : "WPM";

  const metrics = useMemo(() => computeAdvancedMetrics(traces, events, duration), [traces, events, duration]);

  return <section className="typing-results" aria-label="Resultado do teste">
    <h2 className="mb-4 text-xl">Teste concluído</h2>
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
      <ResultToolbar view={view} setView={setView} />
      <Button
        ref={restartRef}
        type="button"
        onClick={onRestart}
        className="border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface2)]"
      >
        Reiniciar teste
      </Button>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--border)] py-5">
      <div className="flex gap-8">
        <div>
          <div className="text-xs text-[var(--muted)]">{language === "pt-BR" ? "Palavras por minuto" : "Words per minute"}</div>
          <div className="mt-1 text-4xl leading-none text-[var(--accent)]">{wpm.toFixed(0)} <span className="text-lg">{speedLabel.toLowerCase()}</span></div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted)]">Precisão</div>
          <div className="mt-1 text-4xl leading-none text-[var(--accent)]">{accuracy.toFixed(0)}%</div>
        </div>
      </div>
      <div className="text-right text-xs text-[var(--subtle)]">
        {duration}s · {language.toUpperCase()} · {traces.length} palavras
      </div>
    </div>
    <dl className="typing-result-summary"><div><dt>Palavras corretas</dt><dd>{metrics.correctWords}</dd></div><div><dt>Palavras com erro</dt><dd>{metrics.incorrectWords}</dd></div><div><dt>Correções</dt><dd>{metrics.correctedKeystrokes}</dd></div><div><dt>Consistência</dt><dd>{metrics.consistency.toFixed(0)}%</dd></div></dl>
    <div className="pt-5">
      {view === "overview" && <><TimelineChart events={events} duration={duration} speedLabel={speedLabel} /><p className="typing-explanation">Ritmo de caracteres corretos em janelas de cinco segundos. Inclui toques depois corrigidos; a nota final considera apenas palavras inteiramente corretas.</p></>}
      {view === "history" && <InputHistory traces={traces} />}
      {view === "pace" && <Heatmap traces={traces} mode="pace" />}
      {view === "wpm" && <Heatmap traces={traces} mode="wpm" />}
      {view === "advanced" && <AdvancedResults traces={traces} events={events} duration={duration} />}
    </div>
  </section>;
}
