export type SubmittedWordResult = {
  expectedWord: string;
  typedWord: string;
  isCorrectWord: boolean;
  correctCharacters: number;
  incorrectCharacters: number;
};

export type CharacterClassification = "correct" | "wrong" | "extra";

export type TypingInputEvent = {
  timestampMs: number;
  type: "character" | "correction" | "space";
  classification?: CharacterClassification;
  removedClassification?: CharacterClassification;
  errorCount?: number;
};

export type TypingWordTrace = SubmittedWordResult & {
  index: number;
  startedAtMs: number;
  submittedAtMs: number;
  durationMs: number;
  corrections: number;
  insertedCharacters: number;
  wrongCharacters: number;
  extraCharacters: number;
  missedCharacters: number;
  wordWpm: number;
  millisecondsPerCharacter: number;
};

export type TypingTimelineSample = {
  second: number;
  wpm: number;
  errors: number;
  modifications: number;
  millisecondsPerCharacter: number;
};

export type TypingAdvancedMetrics = {
  correctWords: number;
  incorrectWords: number;
  correctCharacters: number;
  wrongCharacters: number;
  missedCharacters: number;
  extraCharacters: number;
  correctedCharacters: number;
  correctKeystrokes: number;
  wrongKeystrokes: number;
  extraKeystrokes: number;
  correctedKeystrokes: number;
  spaces: number;
  totalKeys: number;
  rawWpm: number;
  paceWpm: number;
  cpm: number;
  rawCpm: number;
  kpm: number;
  rawKpm: number;
  consistency: number;
};

export type WordCharacterState = "correct" | "incorrect" | "next" | "pending";

export type WordCharacterFeedback = {
  character: string;
  state: WordCharacterState;
};

export function getWordCharacterFeedback(
  expected: string,
  typed: string,
  submitted = false,
): WordCharacterFeedback[] {
  const length = Math.max(expected.length, typed.length);
  return Array.from({ length }, (_, index) => {
    const expectedCharacter = expected[index];
    const typedCharacter = typed[index];

    if (typedCharacter !== undefined) {
      return {
        character: typedCharacter,
        state: typedCharacter === expectedCharacter ? "correct" : "incorrect",
      };
    }

    return {
      character: expectedCharacter,
      state: submitted ? "incorrect" : index === typed.length ? "next" : "pending",
    };
  });
}

export function compareWord(expected: string, typed: string): SubmittedWordResult {
  const compared = Math.min(expected.length, typed.length);
  let correct = 0;
  for (let i = 0; i < compared; i += 1) if (expected[i] === typed[i]) correct += 1;
  const mismatched = compared - correct;
  const extra = Math.max(0, typed.length - compared);
  const missing = Math.max(0, expected.length - compared);
  return {
    expectedWord: expected,
    typedWord: typed,
    isCorrectWord: expected === typed,
    correctCharacters: correct,
    incorrectCharacters: mismatched + extra + missing,
  };
}

export function classifyCharacter(expected: string, character: string, index: number): CharacterClassification {
  if (index >= expected.length) return "extra";
  return expected[index] === character ? "correct" : "wrong";
}

export function createWordTrace({
  index,
  expectedWord,
  typedWord,
  startedAtMs,
  submittedAtMs,
  events,
}: {
  index: number;
  expectedWord: string;
  typedWord: string;
  startedAtMs: number;
  submittedAtMs: number;
  events: TypingInputEvent[];
}): TypingWordTrace {
  const result = compareWord(expectedWord, typedWord);
  const compared = Math.min(expectedWord.length, typedWord.length);
  let wrongCharacters = 0;
  for (let characterIndex = 0; characterIndex < compared; characterIndex += 1) {
    if (expectedWord[characterIndex] !== typedWord[characterIndex]) wrongCharacters += 1;
  }
  const extraCharacters = Math.max(0, typedWord.length - expectedWord.length);
  const missedCharacters = Math.max(0, expectedWord.length - typedWord.length);
  const durationMs = Math.max(1, submittedAtMs - startedAtMs);
  const insertedCharacters = events.filter((event) => event.type === "character").length;
  const corrections = events.filter((event) => event.type === "correction").length;
  const wordUnits = (expectedWord.length + 1) / 5;

  return {
    ...result,
    index,
    startedAtMs,
    submittedAtMs,
    durationMs,
    corrections,
    insertedCharacters,
    wrongCharacters,
    extraCharacters,
    missedCharacters,
    wordWpm: Number((wordUnits / (durationMs / 60_000)).toFixed(2)),
    millisecondsPerCharacter: Number((durationMs / Math.max(1, insertedCharacters)).toFixed(2)),
  };
}

export function getWordPageEnd(
  words: string[],
  startIndex: number,
  maxWidth: number,
  measureWord: (word: string) => number,
  gapWidth: number,
  lineCount = 2,
): number {
  if (startIndex >= words.length || maxWidth <= 0 || lineCount <= 0) return startIndex;

  let line = 1;
  let lineWidth = 0;
  for (let index = startIndex; index < words.length; index += 1) {
    const wordWidth = measureWord(words[index]);
    const nextWidth = lineWidth === 0 ? wordWidth : lineWidth + gapWidth + wordWidth;

    if (lineWidth > 0 && nextWidth > maxWidth) {
      line += 1;
      if (line > lineCount) return index;
      lineWidth = wordWidth;
    } else {
      lineWidth = nextWidth;
    }
  }
  return words.length;
}

export function buildTypingTimeline(
  events: TypingInputEvent[],
  durationSeconds: number,
): TypingTimelineSample[] {
  const safeDuration = Math.max(1, Math.floor(durationSeconds));
  const characterEvents = events.filter((event) => event.type === "character");

  return Array.from({ length: safeDuration }, (_, sampleIndex) => {
    const second = sampleIndex + 1;
    const sampleEnd = second * 1_000;
    const windowStart = Math.max(0, sampleEnd - 5_000);
    const windowSeconds = Math.max(1, (sampleEnd - windowStart) / 1_000);
    const windowCharacters = characterEvents.filter(
      (event) => event.timestampMs > windowStart && event.timestampMs <= sampleEnd,
    );
    const correctCharacters = windowCharacters.filter(
      (event) => event.classification === "correct",
    ).length;
    const bucketEvents = events.filter(
      (event) => event.timestampMs > sampleEnd - 1_000 && event.timestampMs <= sampleEnd,
    );
    const errorCount = bucketEvents.reduce((total, event) => {
      if (event.type === "character" && event.classification !== "correct") return total + 1;
      return total + (event.errorCount ?? 0);
    }, 0);
    const modifications = bucketEvents.filter((event) => event.type === "correction").length;
    const intervals = windowCharacters.slice(1).map(
      (event, index) => event.timestampMs - windowCharacters[index].timestampMs,
    );
    const millisecondsPerCharacter = intervals.length === 0
      ? 0
      : intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

    return {
      second,
      wpm: Number((((correctCharacters / 5) / (windowSeconds / 60))).toFixed(2)),
      errors: errorCount,
      modifications,
      millisecondsPerCharacter: Number(millisecondsPerCharacter.toFixed(2)),
    };
  });
}

export function computeAdvancedMetrics(
  traces: TypingWordTrace[],
  events: TypingInputEvent[],
  durationSeconds: number,
): TypingAdvancedMetrics {
  const minutes = Math.max(1 / 60, durationSeconds / 60);
  const characterEvents = events.filter((event) => event.type === "character");
  const correctionEvents = events.filter((event) => event.type === "correction");
  const correctKeystrokes = characterEvents.filter((event) => event.classification === "correct").length;
  const wrongKeystrokes = characterEvents.filter((event) => event.classification === "wrong").length;
  const extraKeystrokes = characterEvents.filter((event) => event.classification === "extra").length;
  const correctedCharacters = correctionEvents.filter(
    (event) => event.removedClassification !== "correct",
  ).length;
  const correctCharacters = traces.reduce((sum, trace) => sum + trace.correctCharacters, 0);
  const wordPaces = traces.map((trace) => trace.wordWpm).filter(Number.isFinite);
  const averagePace = wordPaces.length === 0
    ? 0
    : wordPaces.reduce((sum, pace) => sum + pace, 0) / wordPaces.length;
  const variance = wordPaces.length === 0
    ? 0
    : wordPaces.reduce((sum, pace) => sum + ((pace - averagePace) ** 2), 0) / wordPaces.length;
  const consistency = averagePace <= 0
    ? 100
    : Math.max(0, Math.min(100, 100 - ((Math.sqrt(variance) / averagePace) * 100)));

  return {
    correctWords: traces.filter((trace) => trace.isCorrectWord).length,
    incorrectWords: traces.filter((trace) => !trace.isCorrectWord).length,
    correctCharacters,
    wrongCharacters: traces.reduce((sum, trace) => sum + trace.wrongCharacters, 0),
    missedCharacters: traces.reduce((sum, trace) => sum + trace.missedCharacters, 0),
    extraCharacters: traces.reduce((sum, trace) => sum + trace.extraCharacters, 0),
    correctedCharacters,
    correctKeystrokes,
    wrongKeystrokes,
    extraKeystrokes,
    correctedKeystrokes: correctionEvents.length,
    spaces: events.filter((event) => event.type === "space").length,
    totalKeys: events.length,
    rawWpm: Number((((characterEvents.length / 5) / minutes)).toFixed(2)),
    paceWpm: Number(averagePace.toFixed(2)),
    cpm: Number((correctCharacters / minutes).toFixed(2)),
    rawCpm: Number((characterEvents.length / minutes).toFixed(2)),
    kpm: Number((correctKeystrokes / minutes).toFixed(2)),
    rawKpm: Number((events.length / minutes).toFixed(2)),
    consistency: Number(consistency.toFixed(2)),
  };
}

export function computeLiveWpm(correctChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return Number((((correctChars / 5) / (elapsedSeconds / 60))).toFixed(2));
}

export function computeAccuracy(correctChars: number, incorrectChars: number): number {
  const total = correctChars + incorrectChars;
  if (total <= 0) return 100;
  return Number(((correctChars / total) * 100).toFixed(2));
}
