import { describe, expect, it } from "vitest";
import {
  compareWord,
  computeAccuracy,
  computeLiveWpm,
  getWordCharacterFeedback,
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
});
