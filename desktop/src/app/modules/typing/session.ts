import { classifyCharacter, createWordTrace, type TypingInputEvent, type TypingWordTrace } from "./engine";

export type TypingRun = {
  words: string[];
  index: number;
  input: string;
  startedAt: number | null;
  finished: boolean;
  events: TypingInputEvent[];
  traces: TypingWordTrace[];
  wordEventStart: number;
  wordStartedAt: number;
};

export function newTypingRun(words: string[]): TypingRun {
  return { words, index: 0, input: "", startedAt: null, finished: false, events: [], traces: [], wordEventStart: 0, wordStartedAt: 0 };
}

/** Only complete, correct words earn speed credit. A confirmed separator counts too. */
export function creditedCharacters(traces: TypingWordTrace[]): number {
  return traces.reduce((sum, trace) => sum + (trace.isCorrectWord
    ? trace.expectedWord.length + (trace.confirmed ? 1 : 0) : 0), 0);
}

function traceWord(run: TypingRun, time: number, confirmed: boolean): TypingWordTrace {
  const trace = createWordTrace({ index: run.index, expectedWord: run.words[run.index], typedWord: run.input,
    startedAtMs: run.wordStartedAt, submittedAtMs: time, events: run.events.slice(run.wordEventStart) });
  // At the deadline, an unfinished suffix is not an attempted omission.
  return { ...trace, confirmed, missedCharacters: confirmed ? trace.missedCharacters : 0,
    incorrectCharacters: confirmed ? trace.incorrectCharacters : trace.wrongCharacters + trace.extraCharacters };
}

export function finishTypingRun(run: TypingRun, duration: number): TypingRun {
  if (run.finished || run.startedAt === null) return run;
  return { ...run, finished: true, traces: run.input
    ? [...run.traces, traceWord(run, duration * 1000, false)] : run.traces };
}

export function updateTypingInput(run: TypingRun, value: string, now: number, duration: number): TypingRun {
  if (run.finished) return run;
  if (run.startedAt !== null && now - run.startedAt >= duration * 1000) return finishTypingRun(run, duration);
  const input = value.normalize("NFC").replace(/\s/g, "").slice(0, 64);
  if (input === run.input) return run;
  const startedAt = run.startedAt ?? now;
  const timestampMs = now - startedAt;
  let common = 0;
  while (common < input.length && common < run.input.length && input[common] === run.input[common]) common++;
  let suffix = 0;
  while (suffix < input.length - common && suffix < run.input.length - common &&
    input[input.length - 1 - suffix] === run.input[run.input.length - 1 - suffix]) suffix++;
  const changes: TypingInputEvent[] = [];
  for (let i = run.input.length - 1 - suffix; i >= common; i--) changes.push({ timestampMs, type: "correction",
    removedClassification: classifyCharacter(run.words[run.index], run.input[i], i) });
  for (let i = common; i < input.length - suffix; i++) changes.push({ timestampMs, type: "character",
    classification: classifyCharacter(run.words[run.index], input[i], i) });
  return { ...run, input, startedAt, events: [...run.events, ...changes] };
}

export function confirmTypingWord(run: TypingRun, now: number, duration: number): TypingRun {
  if (run.finished || run.startedAt === null) return run;
  if (now - run.startedAt >= duration * 1000) return finishTypingRun(run, duration);
  if (!run.input) return run; // Repeated spaces must never skip words.
  const time = now - run.startedAt;
  const trace = traceWord(run, time, true);
  const events = [...run.events, { timestampMs: time, type: "space" as const, errorCount: trace.missedCharacters }];
  return { ...run, input: "", index: run.index + 1, traces: [...run.traces, trace], events,
    wordStartedAt: time, wordEventStart: events.length };
}
