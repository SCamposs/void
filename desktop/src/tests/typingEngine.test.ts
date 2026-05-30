import { describe, expect, it } from "vitest";
import { compareWord, computeAccuracy, computeLiveWpm } from "../app/modules/typing/engine";

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
});
