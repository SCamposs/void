import { describe, expect, it } from "vitest";
import {
  buildTypingTimeline,
  classifyCharacter,
  compareWord,
  computeAdvancedMetrics,
  computeAccuracy,
  computeLiveWpm,
  createWordTrace,
  getWordPageEnd,
  getWordCharacterFeedback,
  type TypingInputEvent,
} from "../app/modules/typing/engine";

describe("typing engine", () => {
  it("scores positional characters", () => {
    expect(compareWord("casa", "casas")).toEqual({ expectedWord: "casa", typedWord: "casas", isCorrectWord: false, correctCharacters: 4, incorrectCharacters: 1 });
    expect(compareWord("casa", "cas")).toEqual({ expectedWord: "casa", typedWord: "cas", isCorrectWord: false, correctCharacters: 3, incorrectCharacters: 1 });
    expect(compareWord("casa", "caza")).toEqual({ expectedWord: "casa", typedWord: "caza", isCorrectWord: false, correctCharacters: 3, incorrectCharacters: 1 });
  });

  it("calculates wpm and accuracy", () => {
    expect(computeLiveWpm(25, 60)).toBe(5);
    expect(computeAccuracy(8, 2)).toBe(80);
    expect(computeAccuracy(0, 0)).toBe(100);
  });

  it("marks typed characters and highlights the next expected character", () => {
    expect(getWordCharacterFeedback("casa", "cas")).toEqual([
      { character: "c", state: "correct" },
      { character: "a", state: "correct" },
      { character: "s", state: "correct" },
      { character: "a", state: "next" },
    ]);
  });

  it("shows the actual incorrect character while the word remains editable", () => {
    expect(getWordCharacterFeedback("brasil", "B")).toEqual([
      { character: "B", state: "incorrect" },
      { character: "r", state: "next" },
      { character: "a", state: "pending" },
      { character: "s", state: "pending" },
      { character: "i", state: "pending" },
      { character: "l", state: "pending" },
    ]);
  });

  it("marks every missing character as incorrect after submission", () => {
    expect(getWordCharacterFeedback("tudo", "tu", true)).toEqual([
      { character: "t", state: "correct" },
      { character: "u", state: "correct" },
      { character: "d", state: "incorrect" },
      { character: "o", state: "incorrect" },
    ]);
  });

  it("marks extra submitted characters as incorrect", () => {
    expect(getWordCharacterFeedback("casa", "casas", true)[4]).toEqual({
      character: "s",
      state: "incorrect",
    });
  });

  it("classifies correct, wrong, and extra keystrokes", () => {
    expect(classifyCharacter("casa", "c", 0)).toBe("correct");
    expect(classifyCharacter("casa", "z", 2)).toBe("wrong");
    expect(classifyCharacter("casa", "s", 4)).toBe("extra");
  });

  it("creates timed word traces with pace and correction data", () => {
    const events: TypingInputEvent[] = [
      { timestampMs: 100, type: "character", classification: "correct" },
      { timestampMs: 400, type: "character", classification: "wrong" },
      { timestampMs: 500, type: "correction", removedClassification: "wrong" },
      { timestampMs: 900, type: "character", classification: "correct" },
      { timestampMs: 1_300, type: "character", classification: "correct" },
      { timestampMs: 1_700, type: "character", classification: "correct" },
    ];
    const trace = createWordTrace({
      index: 0,
      expectedWord: "casa",
      typedWord: "casa",
      startedAtMs: 0,
      submittedAtMs: 2_000,
      events,
    });

    expect(trace.isCorrectWord).toBe(true);
    expect(trace.corrections).toBe(1);
    expect(trace.wordWpm).toBe(30);
    expect(trace.millisecondsPerCharacter).toBe(400);
  });

  it("packs exactly the words that fit in two measured lines", () => {
    const words = ["aaaa", "bbbb", "cc", "dddd", "eeee"];
    expect(getWordPageEnd(words, 0, 100, (word) => word.length * 10, 10, 2)).toBe(4);
    expect(getWordPageEnd(words, 4, 100, (word) => word.length * 10, 10, 2)).toBe(5);
  });

  it("builds per-second WPM, error, modification, and ms/c samples", () => {
    const events: TypingInputEvent[] = [
      { timestampMs: 100, type: "character", classification: "correct" },
      { timestampMs: 300, type: "character", classification: "correct" },
      { timestampMs: 700, type: "character", classification: "wrong" },
      { timestampMs: 900, type: "correction", removedClassification: "wrong" },
    ];
    const [sample] = buildTypingTimeline(events, 1);

    expect(sample).toEqual({
      second: 1,
      wpm: 24,
      errors: 1,
      modifications: 1,
      millisecondsPerCharacter: 300,
    });
  });

  it("derives advanced metrics from traces and raw keystrokes", () => {
    const events: TypingInputEvent[] = [
      { timestampMs: 100, type: "character", classification: "correct" },
      { timestampMs: 200, type: "character", classification: "wrong" },
      { timestampMs: 300, type: "correction", removedClassification: "wrong" },
      { timestampMs: 400, type: "character", classification: "correct" },
      { timestampMs: 500, type: "space", errorCount: 0 },
    ];
    const trace = createWordTrace({
      index: 0,
      expectedWord: "oi",
      typedWord: "oi",
      startedAtMs: 0,
      submittedAtMs: 500,
      events,
    });
    const metrics = computeAdvancedMetrics([trace], events, 60);

    expect(metrics.correctWords).toBe(1);
    expect(metrics.correctedCharacters).toBe(1);
    expect(metrics.correctedKeystrokes).toBe(1);
    expect(metrics.spaces).toBe(1);
    expect(metrics.totalKeys).toBe(5);
    expect(metrics.rawCpm).toBe(3);
  });
});
