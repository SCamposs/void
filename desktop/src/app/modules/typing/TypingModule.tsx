import { useEffect, useMemo, useState } from "react";
import { computeAccuracy, compareWord, computeLiveWpm } from "./engine";
import { generateWordSequence } from "./words";
import { typingRepo } from "../../lib/persistence";

const DURATION = 60;

export function TypingModule() {
  const [words, setWords] = useState<string[]>(() => generateWordSequence());
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [locked, setLocked] = useState(false);
  const [correctChars, setCorrectChars] = useState(0);
  const [incorrectChars, setIncorrectChars] = useState(0);
  const [correctWords, setCorrectWords] = useState(0);
  const [incorrectWords, setIncorrectWords] = useState(0);
  const [saved, setSaved] = useState(false);
  const [recent, setRecent] = useState(() => typingRepo.all().slice(0, 5));

  useEffect(() => {
    const id = setInterval(() => {
      if (!startedAt || locked) return;
      const next = Math.min(DURATION, Math.floor((Date.now() - startedAt) / 1000));
      setElapsed(next);
      if (next >= DURATION) setLocked(true);
    }, 50);
    return () => clearInterval(id);
  }, [startedAt, locked]);

  useEffect(() => {
    if (!locked || saved) return;
    const session = {
      timestamp: new Date().toISOString(),
      wpm: Number((correctChars / 5).toFixed(2)),
      accuracy: computeAccuracy(correctChars, incorrectChars),
      correctWords,
      incorrectWords,
      correctChars,
      incorrectChars,
      durationSeconds: DURATION,
      language: "pt-BR" as const,
      mode: "word-flow-60s" as const,
    };
    typingRepo.save(session);
    setRecent(typingRepo.all().slice(0, 5));
    setSaved(true);
  }, [locked, saved, correctChars, incorrectChars, correctWords, incorrectWords]);

  const liveWpm = useMemo(() => computeLiveWpm(correctChars, Math.max(1, elapsed)), [correctChars, elapsed]);
  const liveAcc = useMemo(() => computeAccuracy(correctChars, incorrectChars), [correctChars, incorrectChars]);
  const summary = typingRepo.summary();

  const submitWord = () => {
    if (locked) return;
    const result = compareWord(words[index], input.trim());
    setCorrectChars((v) => v + result.correctCharacters);
    setIncorrectChars((v) => v + result.incorrectCharacters);
    if (result.isCorrectWord) setCorrectWords((v) => v + 1); else setIncorrectWords((v) => v + 1);
    setIndex((v) => v + 1);
    setInput("");
  };

  const reset = () => {
    setWords(generateWordSequence());
    setIndex(0);
    setInput("");
    setStartedAt(null);
    setElapsed(0);
    setLocked(false);
    setCorrectChars(0);
    setIncorrectChars(0);
    setCorrectWords(0);
    setIncorrectWords(0);
    setSaved(false);
  };

  return <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
    <div className="panel p-4">
      <div className="flex items-end justify-between">
        <div className="text-5xl leading-none">{DURATION - elapsed}s</div>
        <div className="text-right text-sm text-[var(--muted)]">WPM {liveWpm.toFixed(2)}<br/>Accuracy {liveAcc.toFixed(2)}%</div>
      </div>
      <div className="mt-4 text-sm leading-7">
        <span className="text-[var(--subtle)]">{words.slice(Math.max(0, index - 6), index).join(" ")} </span>
        <span className="border-b border-[var(--accent)]">{words[index]}</span>
        <span className="text-[var(--subtle)]"> {words.slice(index + 1, index + 16).join(" ")}</span>
      </div>
      <input
        disabled={locked}
        value={input}
        onChange={(e) => {
          if (!startedAt && e.target.value.length > 0) setStartedAt(Date.now());
          setInput(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === " ") {
            e.preventDefault();
            submitWord();
          }
        }}
        className="mt-4 w-full border border-[var(--border)] bg-[var(--surface2)] p-2 outline-none"
      />
      <div className="mt-3 flex gap-2">
        <button onClick={reset} className="border border-[var(--border)] px-3 py-1">Reset</button>
      </div>
      {locked && <div className="mt-4 border border-[var(--border)] p-2 text-sm">Final 60s WPM: {(correctChars / 5).toFixed(2)} | Accuracy: {liveAcc.toFixed(2)}% | Correct words: {correctWords}</div>}
    </div>

    <div className="panel p-3 text-sm">
      <div className="mb-2 text-[var(--muted)]">Typing Stats</div>
      <div>Best WPM: {summary.bestWpm}</div>
      <div>Average WPM: {summary.averageWpm}</div>
      <div>Average Accuracy: {summary.averageAccuracy}%</div>
      <div className="mt-3 text-[var(--muted)]">Recent Sessions</div>
      <div className="mt-1 space-y-1">
        {recent.length === 0 && <div className="text-[var(--subtle)]">No sessions yet.</div>}
        {recent.map((s) => <div key={s.timestamp} className="border border-[var(--border)] p-1">{new Date(s.timestamp).toLocaleString()} | {s.wpm} WPM | {s.accuracy}%</div>)}
      </div>
    </div>
  </div>;
}
