import { describe, expect, it } from "vitest";
import { EN_WORDS, PT_BR_WORDS, PT_BR_COMMON, EN_COMMON, generateWordSequence } from "../app/modules/typing/words";

describe("typing word pools", () => {
  it("provides everyday Portuguese and separate broad vocabulary without broken diacritics", () => {
    expect(new Set(PT_BR_COMMON).size).toBe(PT_BR_COMMON.length);
    expect(PT_BR_COMMON).toEqual(expect.arrayContaining(["não", "você", "água", "ação"]));
    expect(PT_BR_COMMON.join(" ")).not.toMatch(/Ã|Â/);
    expect(PT_BR_WORDS.join(" ")).not.toMatch(/Ã|Â/);
    const common = generateWordSequence(400, "pt-BR", "common");
    expect(common.every(word => PT_BR_COMMON.includes(word))).toBe(true);
    expect(common.every((word, i) => i === 0 || word !== common[i - 1])).toBe(true);
    expect(generateWordSequence(100, "en", "common").every(word => EN_COMMON.includes(word))).toBe(true);
  });

  it("restricts review to the selected difficult words, including a one-word review", () => {
    expect(generateWordSequence(12, "pt-BR", "practice", ["ação"])).toEqual(Array(12).fill("ação"));
    expect(generateWordSequence(100, "pt-BR", "practice", ["ação", "você"]).every(word => ["ação", "você"].includes(word))).toBe(true);
  });
  it("provides an extensive, unique PT-BR vocabulary with diacritics", () => {
    expect(PT_BR_WORDS.length).toBeGreaterThanOrEqual(375);
    expect(new Set(PT_BR_WORDS).size).toBe(PT_BR_WORDS.length);
    expect(PT_BR_WORDS).toEqual(
      expect.arrayContaining(["ação", "código", "família", "música", "não", "você"]),
    );
  });

  it("provides a broad, unique English vocabulary", () => {
    expect(EN_WORDS.length).toBeGreaterThanOrEqual(240);
    expect(new Set(EN_WORDS).size).toBe(EN_WORDS.length);
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
