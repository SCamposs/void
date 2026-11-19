import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauriRuntime } from "../mind/runtime";
import type { IndexProgress, LibraryDocument, LibraryHit, LibraryNote, LibraryOverview, LibraryPassage, LibraryRoot, SourceSnapshot } from "./types";

export const libraryApi = {
  overview: () => invoke<LibraryOverview>("library_overview"),
  progress: () => invoke<IndexProgress>("library_progress"),
  refresh: () => invoke<IndexProgress>("library_refresh"),
  cancel: () => invoke<void>("library_cancel"),
  documents: (root: number | null, kind: string | null, offset = 0) => invoke<LibraryDocument[]>("library_documents", { root, kind, offset }),
  reader: (document: number, offset = 0) => invoke<{ document: LibraryDocument; passages: LibraryPassage[] }>("library_reader", { document, offset }),
  document: (id: number) => invoke<LibraryDocument>("library_document", { id }),
  passages: (document: number, offset = 0) => invoke<LibraryPassage[]>("library_passages", { document, offset }),
  search: (query: string, root: number | null, kind: string | null, offset = 0) => invoke<LibraryHit[]>("library_search", { query, root, kind, offset }),
  snapshots: (passages: number[]) => invoke<SourceSnapshot[]>("library_snapshots", { passages }),
  removeRoot: (id: number) => invoke<void>("library_remove_root", { id }),
  clear: () => invoke<void>("library_clear"),
  saveNote: (title: string, content: string, sources: SourceSnapshot[], id: number | null = null) => invoke<LibraryNote>("library_save_note", { id, title, content, sources }),
  deleteNote: (id: number) => invoke<void>("library_delete_note", { id }),
  async chooseSources(directory: boolean): Promise<LibraryRoot[]> {
    if (!isTauriRuntime()) throw new Error("Import sources in the installed VOID app.");
    const selected = await open({ title: directory ? "Add a folder to Library" : "Add documents to Library", directory, multiple: !directory,
      ...(directory ? {} : { filters: [{ name: "Documents", extensions: ["md", "markdown", "txt", "pdf"] }] }) });
    if (!selected) return [];
    return invoke<LibraryRoot[]>("library_add_paths", { paths: Array.isArray(selected) ? selected : [selected] });
  },
};
