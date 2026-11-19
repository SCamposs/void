# VOID Library

Library keeps a searchable copy of explicitly selected documents on this computer. It needs no model for import, search, reading or notes.

## Use

1. Open **Library** and add documents or a folder. Supported formats are Markdown, TXT and PDFs containing selectable text. Originals stay in place and are never edited.
2. Search inside the text, filter by source/format and open a result. The reader shows the indexed page or line range. Use **Refresh sources** after changing documents. A changed or missing original is identified when reading or preparing model context.
3. Choose **Use in Mind** on each passage you want to discuss, then **Open Mind Mini**. The passages belong to the currently selected conversation draft. Inspect or remove attachments in its composer before sending.
4. Mind Mini uses the existing local model configuration. No model is downloaded automatically. Only the current response's selected passages are added as reference data; archived source metadata from other turns is not automatically resent. Overlarge requests are rejected with a context-budget explanation.
5. Open a reference in the answer to inspect the exact saved passage. Matched identifiers prove which snapshot a reference opens, not whether the model's claim is supported. Unmatched or missing references are identified.
6. Use **Save as note** on an answer, or create a note in Library. Notes preserve their source snapshots. Unfinished edits are journaled on this device and can be resumed from **Unfinished notes** after leaving the module or restarting.

## Data and removal

The native SQLite index and saved notes live under the app's data directory in `library/library.sqlite`. Unfinished notes have a separate versioned local draft key. No external storage service is added.

Removing a source removes its index entries and preserves original files and saved notes. **Clear Library data** removes registered sources, indexed passages, saved Library notes and unfinished note drafts. Existing Mind conversations retain their own historical reference snapshots; those are removed with the corresponding conversations. Other modules and original files are preserved.

The existing **Export app data** backup includes settings, chats, game history and unfinished drafts. It does not include the native Library database or saved Library notes; Settings states that boundary explicitly.

## Limits and recovery

- Up to 100 registered sources, without overlapping parent/child registrations. Folder scans skip symbolic links and Windows reparse points and stop at 50,000 entries or 32 levels per source; incomplete scans are reported.
- TXT/Markdown: UTF-8 or UTF-16 with a BOM, at most 32 MiB and 2,000,000 decoded characters per file.
- PDF: at most 8 MiB, 1,000 pages and 2,000,000 extracted characters. Password-protected, damaged and textless documents produce an explanation. OCR is outside this version.
- PDF parsing has a disposable process, bounded I/O, a 20-second wall-clock deadline and OS memory limits. A failing document does not prevent other documents from being indexed.
- Source replacements commit atomically. Stop/restart retains completed documents; refresh resumes by content hash without duplicating unchanged passages.
- Up to 24 selected passages per response. Context accounting uses a conservative UTF-8 byte estimate, not a model-specific tokenizer. Older complete turns may be omitted to fit; the current question and selected evidence are never silently truncated.
- Note title: 120 characters; body: 100,000 characters; up to 20 unfinished drafts. A local-storage write failure is reported. Search covers all saved notes with paginated results.

## Verification

See [implementation checkpoints](IMPLEMENTATION.md), [controlled measurements](measurements-windows.json), and [manual acceptance issue #14](https://github.com/SCamposs/void/issues/14).

Automated checks use synthetic documents and simulated model responses. Native UI, real-model behavior and installed-app acceptance remain manual; automated evidence is not a claim that those scenarios were performed.
