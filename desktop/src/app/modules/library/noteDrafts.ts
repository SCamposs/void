import { validSources } from "./context";
import type { LibraryNote } from "./types";
const KEY = "void.library.note-drafts.v1";
export const noteDraftKey = (id: number) => id ? `note-${id}` : "new";
export function readNoteDrafts(): Record<string,LibraryNote> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key,note]) => /^(new|note-\d+)$/.test(key) && note && typeof note === "object"
      && Number.isSafeInteger(note.id) && typeof note.title === "string" && note.title.length <= 120 && typeof note.content === "string" && note.content.length <= 100000)
      .map(([key,note]) => [key,{...note,sources:validSources(note.sources)}]));
  } catch { return {}; }
}
export function writeNoteDraft(note: LibraryNote): void {
  const drafts = readNoteDrafts();
  if (!drafts[noteDraftKey(note.id)] && Object.keys(drafts).length >= 20) throw new Error("Save or discard an existing draft before starting another. Library keeps up to 20 unfinished notes.");
  localStorage.setItem(KEY,JSON.stringify({...drafts,[noteDraftKey(note.id)]:note}));
}
export function removeNoteDraft(id: number): void {
  const drafts = readNoteDrafts(); delete drafts[noteDraftKey(id)];
  localStorage.setItem(KEY,JSON.stringify(drafts));
}
export function clearNoteDrafts(): void { localStorage.removeItem(KEY); }
