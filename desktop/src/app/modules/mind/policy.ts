export function applyInputPolicy(content: string, enabled: boolean): string {
  const normalized = [...content].filter((character) => character.charCodeAt(0) !== 0).join("").trim();
  if (!normalized) throw new Error("Write a message before sending.");
  if (enabled && normalized.length > 50_000) {
    throw new Error("This message exceeds the local 50,000 character input limit.");
  }
  return normalized;
}

export function applyOutputPolicy(content: string, enabled: boolean): string {
  if (!enabled) return content;
  return [...content]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join("");
}
