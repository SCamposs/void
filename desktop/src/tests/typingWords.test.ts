import { describe, expect, it } from "vitest";
import { EN_WORDS, PT_BR_WORDS, generateWordSequence } from "../app/modules/typing/words";

describe("typing word pools", () => {
  it("provides an extensive, unique PT-BR vocabulary with diacritics", () => {
    expect(PT_BR_WORDS.length).toBeGreaterThanOrEqual(200);
    expect(new Set(PT_BR_WORDS).size).toBe(PT_BR_WORDS.length);
    expect(PT_BR_WORDS).toEqual(
      expect.arrayContaining(["ação", "código", "família", "música", "você"]),
    );
  });

  it("keeps generated sequences inside the selected language pool", () => {
    const portuguese = generateWordSequence(100, "pt-BR");
    const english = generateWordSequence(100, "en");

    expect(portuguese).toHaveLength(100);
    expect(english).toHaveLength(100);
    expect(portuguese.every((word) => PT_BR_WORDS.includes(word))).toBe(true);
    expect(english.every((word) => EN_WORDS.includes(word))).toBe(true);
  });
});
