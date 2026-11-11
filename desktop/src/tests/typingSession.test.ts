import { describe, expect, it } from "vitest";
import { buildTypingTimeline, computeAdvancedMetrics, computeTypingAccuracy } from "../app/modules/typing/engine";
import { confirmTypingWord, creditedCharacters, finishTypingRun, newTypingRun, updateTypingInput } from "../app/modules/typing/session";

describe("timed typing sessions", () => {
  it("starts only on committed text, ignores empty spaces, and accepts a zero time origin", () => {
    const ready = newTypingRun(["ação", "casa"]);
    expect(confirmTypingWord(ready, 100, 60)).toBe(ready);
    expect(updateTypingInput(ready, "", 100, 60)).toBe(ready);
    const run = updateTypingInput(ready, "a", 0, 60);
    expect(run.startedAt).toBe(0);
    expect(buildTypingTimeline(run.events, 60)[0].wpm).toBe(12);
    expect(finishTypingRun(run, 60).finished).toBe(true);
  });

  it("credits whole correct words plus confirmed spaces, never matching letters in a wrong word", () => {
    let run = updateTypingInput(newTypingRun(["casa", "ação", "fim"]), "caza", 100, 60);
    run = confirmTypingWord(run, 500, 60);
    expect(creditedCharacters(run.traces)).toBe(0);
    run = updateTypingInput(run, "ação", 700, 60);
    run = confirmTypingWord(run, 1000, 60);
    expect(creditedCharacters(run.traces)).toBe(5);
    expect(confirmTypingWord(run, 1001, 60)).toBe(run);
    expect(run.index).toBe(2);
  });

  it("normalizes decomposed accents without double recording the composition-end input", () => {
    const run = updateTypingInput(newTypingRun(["ação"]), "ac\u0327a\u0303o", 100, 60);
    expect(run.input).toBe("ação");
    expect(run.events).toHaveLength(4);
    expect(updateTypingInput(run, "ação", 101, 60)).toBe(run);
    expect(creditedCharacters(finishTypingRun(run, 60).traces)).toBe(4);
  });

  it("keeps corrected mistakes in accuracy and handles replacement in the middle", () => {
    let run = updateTypingInput(newTypingRun(["casa"]), "caza", 100, 60);
    run = updateTypingInput(run, "casa", 200, 60);
    run = confirmTypingWord(run, 300, 60);
    expect(run.traces[0].isCorrectWord).toBe(true);
    expect(run.traces[0].corrections).toBe(1);
    expect(computeTypingAccuracy(run.events, run.traces)).toBeLessThan(100);
  });

  it("uses a hard deadline even if the timer callback has not run", () => {
    let run = updateTypingInput(newTypingRun(["casa"]), "cas", 100, 15);
    run = updateTypingInput(run, "casa", 15100, 15);
    expect(run.finished).toBe(true);
    expect(run.input).toBe("cas");
    expect(creditedCharacters(run.traces)).toBe(0);
    expect(run.traces[0].missedCharacters).toBe(0);
    expect(run.traces[0].incorrectCharacters).toBe(0);
    expect(finishTypingRun(run, 15)).toBe(run);
    expect(confirmTypingWord(run, 16000, 15)).toBe(run);
  });

  it("charges omissions on space but does not charge an untouched suffix at the deadline", () => {
    const run = updateTypingInput(newTypingRun(["casa"]), "ca", 100, 60);
    expect(confirmTypingWord(run, 200, 60).traces[0].missedCharacters).toBe(2);
    const finished = finishTypingRun(run, 60);
    expect(finished.traces[0].confirmed).toBe(false);
    expect(computeTypingAccuracy(finished.events, finished.traces)).toBe(100);
    expect(computeAdvancedMetrics(finished.traces, finished.events, 60).incorrectWords).toBe(0);
  });

  it("does not restart on inactivity and does not duplicate final traces", () => {
    let run = updateTypingInput(newTypingRun(["casa"]), "c", 100, 60);
    run = updateTypingInput(run, "ca", 15000, 60);
    expect(run.startedAt).toBe(100);
    const finished = finishTypingRun(run, 60);
    expect(finishTypingRun(finished, 60).traces).toHaveLength(1);
  });
});
