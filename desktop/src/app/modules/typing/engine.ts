export type SubmittedWordResult = {
  expectedWord: string;
  typedWord: string;
  isCorrectWord: boolean;
  correctCharacters: number;
  incorrectCharacters: number;
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

export function computeLiveWpm(correctChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return Number((((correctChars / 5) / (elapsedSeconds / 60))).toFixed(2));
}

export function computeAccuracy(correctChars: number, incorrectChars: number): number {
  const total = correctChars + incorrectChars;
  if (total <= 0) return 100;
  return Number(((correctChars / total) * 100).toFixed(2));
}
