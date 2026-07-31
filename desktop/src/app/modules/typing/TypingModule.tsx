import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  classifyCharacter,
  computeLiveWpm,
  computeTypingAccuracy,
  createWordTrace,
  getWordCharacterFeedback,
  getWordPageEnd,
  type TypingInputEvent,
  type TypingWordTrace,
  type WordCharacterState,
} from "./engine";
import { TypingResults } from "./TypingResults";
import { generateWordSequence, type TypingLanguage } from "./words";
import { typingRepo } from "../../lib/persistence";

type TypingDuration = 15 | 30 | 60 | 120;

const characterClasses: Record<WordCharacterState, string> = {
  correct: "text-[var(--muted)]",
  incorrect: "bg-[#a9343d] text-[#fff7f5]",
  next: "bg-[var(--accent)] text-[var(--bg)]",
  pending: "text-[var(--text)]",
};

function WordFeedback({
  expected,
  typed,
  submitted = false,
  active = false,
}: {
  expected: string;
  typed: string;
  submitted?: boolean;
  active?: boolean;
}) {
  const characters = getWordCharacterFeedback(expected, typed, submitted);
  return (
    <span
      className={`mr-[0.72ch] inline-flex whitespace-nowrap align-baseline ${
        active ? "border-b border-[var(--accent)] pb-0.5" : ""
      }`}
      aria-label={active ? `Current word: ${expected}` : expected}
    >
      {characters.map((character, characterIndex) => (
        <span
          key={`${characterIndex}-${character.character}`}
          className={`inline-block min-w-[0.58ch] text-center ${characterClasses[character.state]}`}
        >
          {character.character}
        </span>
      ))}
    </span>
  );
}

function useTwoLinePageEnd(
  words: string[],
  pageStart: number,
  flowRef: RefObject<HTMLDivElement>,
) {
  const [pageEnd, setPageEnd] = useState(() => Math.min(words.length, pageStart + 18));

  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;

    const measure = () => {
      const style = window.getComputedStyle(flow);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      context.font = style.font || `${style.fontSize} ${style.fontFamily}`;
      const gapWidth = context.measureText(" ").width * 0.72;
      const nextEnd = getWordPageEnd(
        words,
        pageStart,
        flow.clientWidth,
        (word) => context.measureText(word).width,
        gapWidth,
        2,
      );
      setPageEnd(Math.max(pageStart + 1, nextEnd));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(flow);
    return () => observer.disconnect();
  }, [flowRef, pageStart, words]);

  return Math.min(words.length, pageEnd);
}

function scoreActiveWord(expected: string, typed: string) {
  let correct = 0;
  for (let index = 0; index < typed.length; index += 1) {
    if (index < expected.length && expected[index] === typed[index]) correct += 1;
  }
  return correct;
}

export function TypingModule() {
  const inputRef = useRef<HTMLInputElement>(null);
  const wordFlowRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<TypingInputEvent[]>([]);
  const wordEventStartRef = useRef(0);
  const wordStartedAtRef = useRef(0);

  const [duration, setDuration] = useState<TypingDuration>(60);
  const [language, setLanguage] = useState<TypingLanguage>("pt-BR");
  const [words, setWords] = useState<string[]>(() => generateWordSequence(600, "pt-BR"));
  const [index, setIndex] = useState(0);
  const [pageStart, setPageStart] = useState(0);
  const [input, setInput] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [locked, setLocked] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [correctChars, setCorrectChars] = useState(0);
  const [incorrectChars, setIncorrectChars] = useState(0);
  const [correctWords, setCorrectWords] = useState(0);
  const [incorrectWords, setIncorrectWords] = useState(0);
  const [saved, setSaved] = useState(false);
  const [sessions, setSessions] = useState(() => typingRepo.all());
  const [traces, setTraces] = useState<TypingWordTrace[]>([]);
  const [inputFocused, setInputFocused] = useState(false);

  const pageEnd = useTwoLinePageEnd(words, pageStart, wordFlowRef);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!startedAt || locked) return;
      const next = Math.min(duration, Math.floor((Date.now() - startedAt) / 1_000));
      setElapsed(next);
      if (next >= duration) setLocked(true);
    }, 50);
    return () => clearInterval(id);
  }, [duration, startedAt, locked]);

  useEffect(() => {
    if (!locked || finalized) return;
    if (input.length > 0 && startedAt !== null) {
      const submittedAtMs = duration * 1_000;
      const attemptEvents = eventsRef.current.slice(wordEventStartRef.current);
      const trace = createWordTrace({
        index,
        expectedWord: words[index],
        typedWord: input,
        startedAtMs: wordStartedAtRef.current,
        submittedAtMs,
        events: attemptEvents,
      });
      setTraces((current) => [...current, trace]);
      setCorrectChars((value) => value + trace.correctCharacters);
      setIncorrectChars((value) => value + trace.incorrectCharacters);
      if (trace.isCorrectWord) setCorrectWords((value) => value + 1);
      else setIncorrectWords((value) => value + 1);
      setIndex((value) => value + 1);
      setInput("");
    }
    setFinalized(true);
  }, [duration, finalized, index, input, locked, startedAt, words]);

  useEffect(() => {
    if (!locked || !finalized || saved) return;
    const session = {
      timestamp: new Date().toISOString(),
      wpm: computeLiveWpm(correctChars, duration),
      accuracy: computeTypingAccuracy(eventsRef.current, traces),
      correctWords,
      incorrectWords,
      correctChars,
      incorrectChars,
      durationSeconds: duration,
      language,
      mode: `word-flow-${duration}s`,
    };
    typingRepo.save(session);
    setSessions(typingRepo.all());
    setSaved(true);
  }, [
    correctChars,
    correctWords,
    duration,
    finalized,
    incorrectChars,
    incorrectWords,
    language,
    locked,
    saved,
    traces,
  ]);

  useEffect(() => {
    if (index < pageEnd) return;
    setPageStart(index);
  }, [index, pageEnd]);

  const activeScore = useMemo(
    () => scoreActiveWord(words[index] ?? "", input),
    [index, input, words],
  );
  const liveCorrect = correctChars + activeScore;
  const liveWpm = useMemo(
    () => computeLiveWpm(liveCorrect, Math.max(1, elapsed)),
    [elapsed, liveCorrect],
  );
  const liveAcc = computeTypingAccuracy(eventsRef.current, traces);
  const finalWpm = computeLiveWpm(correctChars, duration);
  const finalAccuracy = computeTypingAccuracy(eventsRef.current, traces);
  const selectedSessions = sessions.filter(
    (session) => session.durationSeconds === duration && session.language === language,
  );
  const recent = sessions.slice(0, 5);
  const selectedBest = selectedSessions.length > 0
    ? Math.max(...selectedSessions.map((session) => session.wpm))
    : 0;
  const tracesByIndex = useMemo(
    () => new Map(traces.map((trace) => [trace.index, trace])),
    [traces],
  );

  const recordEvents = (events: TypingInputEvent[]) => {
    if (events.length === 0) return;
    eventsRef.current = [...eventsRef.current, ...events];
  };

  const submitWord = () => {
    if (locked || (input.length === 0 && startedAt === null)) return;
    const now = Date.now();
    const origin = startedAt ?? now;
    if (startedAt === null) {
      setStartedAt(origin);
      wordStartedAtRef.current = 0;
    }
    const submittedAtMs = Math.min(duration * 1_000, now - origin);
    const attemptEvents = eventsRef.current.slice(wordEventStartRef.current);
    const trace = createWordTrace({
      index,
      expectedWord: words[index],
      typedWord: input,
      startedAtMs: wordStartedAtRef.current,
      submittedAtMs,
      events: attemptEvents,
    });
    const spaceEvent: TypingInputEvent = {
      timestampMs: submittedAtMs,
      type: "space",
      errorCount: trace.missedCharacters,
    };

    recordEvents([spaceEvent]);
    wordEventStartRef.current = eventsRef.current.length;
    wordStartedAtRef.current = submittedAtMs;
    setCorrectChars((value) => value + trace.correctCharacters);
    setIncorrectChars((value) => value + trace.incorrectCharacters);
    if (trace.isCorrectWord) setCorrectWords((value) => value + 1);
    else setIncorrectWords((value) => value + 1);
    setTraces((current) => [...current, trace]);

    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (nextIndex >= pageEnd) setPageStart(pageEnd);
    setInput("");
  };

  const reset = () => {
    setWords(generateWordSequence(600, language));
    setIndex(0);
    setPageStart(0);
    setInput("");
    setStartedAt(null);
    setElapsed(0);
    setLocked(false);
    setFinalized(false);
    setCorrectChars(0);
    setIncorrectChars(0);
    setCorrectWords(0);
    setIncorrectWords(0);
    setSaved(false);
    setTraces([]);
    eventsRef.current = [];
    wordEventStartRef.current = 0;
    wordStartedAtRef.current = 0;
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const configure = (nextDuration: TypingDuration, nextLanguage: TypingLanguage) => {
    setDuration(nextDuration);
    setLanguage(nextLanguage);
    setWords(generateWordSequence(600, nextLanguage));
    setIndex(0);
    setPageStart(0);
    setInput("");
    setStartedAt(null);
    setElapsed(0);
    setLocked(false);
    setFinalized(false);
    setCorrectChars(0);
    setIncorrectChars(0);
    setCorrectWords(0);
    setIncorrectWords(0);
    setSaved(false);
    setTraces([]);
    eventsRef.current = [];
    wordEventStartRef.current = 0;
    wordStartedAtRef.current = 0;
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleInput = (rawValue: string) => {
    const nextInput = rawValue.replace(/\s/g, "");
    const now = Date.now();
    const origin = startedAt ?? now;
    if (startedAt === null && nextInput.length > 0) {
      setStartedAt(origin);
      wordStartedAtRef.current = 0;
    }
    if (startedAt === null && nextInput.length === 0) {
      setInput(nextInput);
      return;
    }

    const timestampMs = Math.min(duration * 1_000, now - origin);
    const events: TypingInputEvent[] = [];
    if (nextInput.length > input.length) {
      for (let characterIndex = input.length; characterIndex < nextInput.length; characterIndex += 1) {
        events.push({
          timestampMs,
          type: "character",
          classification: classifyCharacter(words[index], nextInput[characterIndex], characterIndex),
        });
      }
    } else if (nextInput.length < input.length) {
      for (let characterIndex = input.length - 1; characterIndex >= nextInput.length; characterIndex -= 1) {
        events.push({
          timestampMs,
          type: "correction",
          removedClassification: classifyCharacter(words[index], input[characterIndex], characterIndex),
        });
      }
    } else if (nextInput !== input) {
      for (let characterIndex = 0; characterIndex < nextInput.length; characterIndex += 1) {
        if (nextInput[characterIndex] === input[characterIndex]) continue;
        events.push({
          timestampMs,
          type: "correction",
          removedClassification: classifyCharacter(words[index], input[characterIndex], characterIndex),
        });
        events.push({
          timestampMs,
          type: "character",
          classification: classifyCharacter(words[index], nextInput[characterIndex], characterIndex),
        });
      }
    }
    recordEvents(events);
    setInput(nextInput);
  };

  return <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[1fr_300px]">
    <div className="panel min-h-0 overflow-auto p-4">
      {!locked ? <>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-2">Duration
            <select
              className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
              value={duration}
              disabled={startedAt !== null}
              onChange={(event) => configure(Number(event.target.value) as TypingDuration, language)}
            >
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
              <option value={120}>120s</option>
            </select>
          </label>
          <label className="flex items-center gap-2">Language
            <select
              className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
              value={language}
              disabled={startedAt !== null}
              onChange={(event) => configure(duration, event.target.value as TypingLanguage)}
            >
              <option value="pt-BR">PT-BR</option>
              <option value="en">EN</option>
            </select>
          </label>
          <span className="ml-auto text-[var(--muted)]">Timer starts on first input</span>
        </div>
        <div className="flex items-end justify-between">
          <div className="text-5xl leading-none">{duration - elapsed}s</div>
          <div className="text-right text-sm text-[var(--muted)]">
            {language === "pt-BR" ? "PPM" : "WPM"} {liveWpm.toFixed(2)}<br />
            Accuracy {liveAcc.toFixed(2)}%
          </div>
        </div>
        <div
          className={`relative mt-5 cursor-text overflow-hidden border bg-[#0d0d0b] px-4 py-4 ${
            inputFocused ? "border-[var(--accent)]" : "border-[var(--border)]"
          }`}
          onClick={() => inputRef.current?.focus()}
          role="group"
          aria-label="Typing word flow"
        >
          <div
            ref={wordFlowRef}
            key={pageStart}
            className="flex h-[6.65rem] flex-wrap content-start overflow-hidden text-[1.75rem] leading-[1.65] sm:h-[7.35rem] sm:text-[2rem]"
            aria-hidden="true"
          >
            {words.slice(pageStart, pageEnd).map((word, pageOffset) => {
              const wordIndex = pageStart + pageOffset;
              const trace = tracesByIndex.get(wordIndex);
              if (trace) {
                return <WordFeedback
                  key={`${wordIndex}-${word}`}
                  expected={trace.expectedWord}
                  typed={trace.typedWord}
                  submitted
                />;
              }
              if (wordIndex === index) {
                return <WordFeedback key={`${wordIndex}-${word}`} expected={word} typed={input} active />;
              }
              return <span
                key={`${wordIndex}-${word}`}
                className="mr-[0.72ch] inline-block whitespace-nowrap text-[var(--text)]"
              >
                {word}
              </span>;
            })}
          </div>
          {!inputFocused && (
            <button
              type="button"
              className="absolute bottom-2 right-2 border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              onClick={() => inputRef.current?.focus()}
            >
              Continue typing
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          value={input}
          aria-label={`Type the word ${words[index]}`}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          onChange={(event) => handleInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === " ") {
              event.preventDefault();
              submitWord();
            }
          }}
          className="sr-only"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--muted)]">
            Two lines at a time. Space submits the current word.
          </span>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface2)]"
          >
            Reset test
          </button>
        </div>
      </> : <TypingResults
        traces={traces}
        events={eventsRef.current}
        duration={duration}
        wpm={finalWpm}
        accuracy={finalAccuracy}
        language={language}
        onRestart={reset}
      />}
    </div>

    <div className="panel min-h-0 overflow-auto p-3 text-sm">
      <div className="mb-2 text-[var(--muted)]">Selected mode</div>
      <div>Best {language === "pt-BR" ? "PPM" : "WPM"}: {selectedBest.toFixed(2)}</div>
      <div>Runs: {selectedSessions.length}</div>
      <div className="mt-3 text-[var(--muted)]">Recent sessions</div>
      <div className="mt-1 space-y-1">
        {recent.length === 0 && <div className="text-[var(--subtle)]">No sessions yet.</div>}
        {recent.map((session) => <div key={session.timestamp} className="border border-[var(--border)] p-2">
          <div>{session.wpm} {session.language === "pt-BR" ? "PPM" : "WPM"} | {session.accuracy}%</div>
          <div className="mt-0.5 text-[10px] text-[var(--subtle)]">
            {session.language} | {session.durationSeconds}s | {new Date(session.timestamp).toLocaleString()}
          </div>
        </div>)}
      </div>
      <button
        type="button"
        className="mt-3 border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface2)]"
        onClick={() => {
          if (!window.confirm("Reset typing history?")) return;
          typingRepo.reset();
          setSessions([]);
        }}
      >
        Reset typing history
      </button>
    </div>
  </div>;
}
