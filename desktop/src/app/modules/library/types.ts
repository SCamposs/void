export type LibraryRoot = { id: number; path: string; label: string; directory: boolean };
export type LibraryDocument = { id: number; rootId: number; path: string; title: string; kind: string; fingerprint: string; status: string; detail: string; bytes: number; indexedAt: number; passageCount: number };
export type LibraryPassage = { id: number; documentId: number; ordinal: number; page: number | null; lineStart: number | null; lineEnd: number | null; text: string };
export type SourceSnapshot = Pick<LibraryDocument, "title" | "path" | "fingerprint"> & Pick<LibraryPassage, "documentId" | "page" | "lineStart" | "lineEnd" | "text"> & { passageId: number };
export type LibraryHit = { document: LibraryDocument; passage: LibraryPassage; excerpt: string };
export type LibraryNote = { id: number; title: string; content: string; sources: SourceSnapshot[]; updatedAt: number };
export type IndexProgress = { phase: string; visited: number; indexed: number; unchanged: number; errors: number; skipped: number; missing: number; current: string; detail: string; startedAt: number; finishedAt: number | null };
export type LibraryOverview = { roots: LibraryRoot[]; notes: LibraryNote[]; progress: IndexProgress; storageBytes: number };

export function passageLocation(source: Pick<LibraryPassage, "page" | "lineStart" | "lineEnd">): string {
  if (source.page !== null) return `Page ${source.page}`;
  return source.lineStart === source.lineEnd ? `Line ${source.lineStart}` : `Lines ${source.lineStart}–${source.lineEnd}`;
}
