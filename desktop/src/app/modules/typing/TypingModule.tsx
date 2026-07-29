import { useEffect, useMemo, useState } from "react";
import { computeAccuracy, compareWord, computeLiveWpm } from "./engine";
import { generateWordSequence, type TypingLanguage } from "./words";
import { typingRepo } from "../../lib/persistence";

type TypingDuration = 15 | 30 | 60 | 120;

export function TypingModule() {
  const [duration, setDuration] = useState<TypingDuration>(60);
  const [language, setLanguage] = useState<TypingLanguage>("pt-BR");
  const [words, setWords] = useState<string[]>(() => generateWordSequence(450, "pt-BR"));
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
      const next = Math.min(duration, Math.floor((Date.now() - startedAt) / 1000));
      setElapsed(next);
      if (next >= duration) setLocked(true);
    }, 50);
    return () => clearInterval(id);
  }, [duration, startedAt, locked]);

  useEffect(() => {
    if (!locked || saved) return;
    const session = {
      timestamp: new Date().toISOString(),
      wpm: computeLiveWpm(correctChars, duration),
      accuracy: computeAccuracy(correctChars, incorrectChars),
      correctWords,
      incorrectWords,
      correctChars,
      incorrectChars,
      durationSeconds: duration,
      language,
      mode: `word-flow-${duration}s`,
    };
    typingRepo.save(session);
    setRecent(typingRepo.all().slice(0, 5));
    setSaved(true);
  }, [duration, language, locked, saved, correctChars, incorrectChars, correctWords, incorrectWords]);

  const liveWpm = useMemo(() => computeLiveWpm(correctChars, Math.max(1, elapsed)), [correctChars, elapsed]);
  const liveAcc = useMemo(() => computeAccuracy(correctChars, incorrectChars), [correctChars, incorrectChars]);
  const allSessions = typingRepo.all();
  const selectedSessions = allSessions.filter((session) => session.durationSeconds === duration && session.language === language);
  const selectedBest = selectedSessions.length > 0 ? Math.max(...selectedSessions.map((session) => session.wpm)) : 0;

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
    setWords(generateWordSequence(450, language));
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

  const configure = (nextDuration: TypingDuration, nextLanguage: TypingLanguage) => {
    setDuration(nextDuration);
    setLanguage(nextLanguage);
    setWords(generateWordSequence(450, nextLanguage));
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

  return <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[1fr_300px]">
    <div className="panel min-h-0 overflow-auto p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-2">Duration
          <select className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1" value={duration} disabled={startedAt !== null && !locked} onChange={(event) => configure(Number(event.target.value) as TypingDuration, language)}>
            <option value={15}>15s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
            <option value={120}>120s</option>
          </select>
        </label>
        <label className="flex items-center gap-2">Language
          <select className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1" value={language} disabled={startedAt !== null && !locked} onChange={(event) => configure(duration, event.target.value as TypingLanguage)}>
            <option value="pt-BR">PT-BR</option>
            <option value="en">EN</option>
          </select>
        </label>
        <span className="ml-auto text-[var(--muted)]">Timer starts on first input</span>
      </div>
      <div className="flex items-end justify-between">
        <div className="text-5xl leading-none">{duration - elapsed}s</div>
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
      {locked && <div className="mt-4 border border-[var(--border)] p-3 text-sm">
        <div className="font-medium">Final {duration}s result</div>
        <div className="mt-1 text-[var(--muted)]">{computeLiveWpm(correctChars, duration).toFixed(2)} WPM | {liveAcc.toFixed(2)}% accuracy | {correctWords} correct words</div>
      </div>}
    </div>

    <div className="panel min-h-0 overflow-auto p-3 text-sm">
      <div className="mb-2 text-[var(--muted)]">Selected mode</div>
      <div>Best WPM: {selectedBest.toFixed(2)}</div>
      <div>Runs: {selectedSessions.length}</div>
      <div className="mt-3 text-[var(--muted)]">Recent sessions</div>
      <div className="mt-1 space-y-1">
        {recent.length === 0 && <div className="text-[var(--subtle)]">No sessions yet.</div>}
        {recent.map((session) => <div key={session.timestamp} className="border border-[var(--border)] p-2">
          <div>{session.wpm} WPM | {session.accuracy}%</div>
          <div className="mt-0.5 text-[10px] text-[var(--subtle)]">{session.language} | {session.durationSeconds}s | {new Date(session.timestamp).toLocaleString()}</div>
        </div>)}
      </div>
      <button className="mt-3 border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface2)]" onClick={() => {
        if (!window.confirm("Reset typing history?")) return;
        typingRepo.reset();
        setRecent([]);
      }}>Reset typing history</button>
    </div>
  </div>;
}
