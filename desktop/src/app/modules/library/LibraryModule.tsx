import { readNoteDrafts, writeNoteDraft, removeNoteDraft, clearNoteDrafts, noteDraftKey } from "./noteDrafts";
import { useMindStore } from "../mind/store";
import { useAppStore } from "../../store/appStore";
import "./library.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, FilePlus2, FolderPlus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button, Input, Select, ScrollSurface, Textarea, Tooltip, Disclosure, DisclosureTitle, DisclosureBody } from "../../components/ui/Controls";
import { useConfirm } from "../../components/ui/use-confirm";
import { isTauriRuntime } from "../mind/runtime";
import { libraryApi } from "./api";
import { passageLocation, type LibraryDocument, type LibraryHit, type LibraryNote, type LibraryOverview, type LibraryPassage } from "./types";

const EMPTY: LibraryOverview = { roots: [], notes: [], storageBytes: 0, progress: { phase: "", visited: 0, indexed: 0, unchanged: 0, errors: 0, skipped: 0, missing: 0, current: "", detail: "", startedAt: 0, finishedAt: null } };
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export function LibraryModule() {
  const confirm = useConfirm();
  const native = isTauriRuntime();
  const [overview, setOverview] = useState(EMPTY);
  const [query, setQuery] = useState("");
  const [root, setRoot] = useState("");
  const [kind, setKind] = useState("");
  const [tab, setTab] = useState<"documents" | "notes">("documents");
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [notes, setNotes] = useState<LibraryNote[]>([]);
  const [hits, setHits] = useState<LibraryHit[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [document, setDocument] = useState<LibraryDocument | null>(null);
  const [sourceWarning, setSourceWarning] = useState<string | null>(null);
  const [passages, setPassages] = useState<LibraryPassage[]>([]);
  const [readerOffset, setReaderOffset] = useState(0);
  const [targetPassage, setTargetPassage] = useState<number | null>(null);
  const [drafts, setDrafts] = useState(readNoteDrafts);
  const [note, setNote] = useState<LibraryNote | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const reader = useRef<HTMLDivElement>(null);
  const readerHeading = useRef<HTMLHeadingElement>(null);
  const readerReturn = useRef<HTMLButtonElement | null>(null);
  const indexing = overview.progress.phase === "running";
  const reload = useCallback(async () => {
    if (!native) return;
    setOverview(await libraryApi.overview());
    setRevision((v) => v + 1);
  }, [native]);

  useEffect(() => { let live = true; if (native) libraryApi.overview().then((data) => { if (live) setOverview(data); }).catch((e) => { if (live) setError(message(e)); }); return () => { live = false; }; }, [native]);
  useEffect(() => {
    if (!indexing) return;
    let live = true;
    let checking = false;
    const timer = window.setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const progress = await libraryApi.progress();
        if (!live) return;
        if (progress.phase !== "running") {
          const data = await libraryApi.overview();
          if (live) { setOverview(data); setRevision((value) => value + 1); }
        } else setOverview((value) => ({ ...value, progress }));
      } catch (e) { if (live) setError(message(e)); }
      finally { checking = false; }
    }, 400);
    return () => { live = false; clearInterval(timer); };
  }, [indexing, reload]);
  useEffect(() => {
    let live = true;
    if (!native) return;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        if (tab === "notes") {
          const result = await libraryApi.notes(query,offset);
          if (live) { setNotes(result); setMore(result.length === 40); }
        } else if (query.trim()) {
          const result = await libraryApi.search(query, root ? Number(root) : null, kind || null, offset);
          if (live) { setHits(result); setMore(result.length === 40); }
        } else {
          const result = await libraryApi.documents(root ? Number(root) : null, kind || null, offset);
          if (live) { setDocuments(result); setMore(result.length === 100); }
        }
      } catch (e) { if (live) setError(message(e)); }
      finally { if (live) setLoading(false); }
    }, 160);
    return () => { live = false; clearTimeout(timer); };
  }, [native, query, root, kind, offset, revision, tab]);
  useEffect(() => {
    let live = true;
    if (selected === null || !native) { setDocument(null); setPassages([]); return; }
    setLoading(true);
    libraryApi.reader(selected, readerOffset)
      .then(({ document, passages, sourceWarning }) => { if (live) { setDocument(document); setPassages(passages); setSourceWarning(sourceWarning ?? null); } })
      .catch((e) => { if (live) setError(message(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [selected, native, readerOffset, revision]);
  useEffect(() => {
    if (targetPassage !== null) reader.current?.querySelector(`[data-passage="${targetPassage}"]`)?.scrollIntoView({ block: "center" });
  }, [passages, targetPassage]);

  const hasNote = note !== null;
  useEffect(() => { if (selected !== null || hasNote) readerHeading.current?.focus(); }, [selected, hasNote]);
  const closeReader = () => { setSelected(null); setNote(null); requestAnimationFrame(() => readerReturn.current?.focus()); };

  const action = async (work: () => Promise<void>) => { setPending(true); setError(""); try { await work(); } catch (e) { setError(message(e)); } finally { setPending(false); } };
  const importSources = (directory: boolean) => action(async () => {
    const added = await libraryApi.chooseSources(directory);
    if (!added.length) return;
    await libraryApi.refresh(); await reload(); setRevision((value) => value + 1);
  });
  const openDocument = (id: number, passage?: LibraryPassage) => { setSelected(id); setNote(null); setReaderOffset(passage ? Math.floor(passage.ordinal / 100) * 100 : 0); setTargetPassage(passage?.id ?? null); };
  const results = query.trim() ? hits : documents;
  const openNote = (value: LibraryNote) => {
    const draft = readNoteDrafts()[noteDraftKey(value.id)] ?? value;
    setSelected(null); setNote(draft); setNoteTitle(draft.title); setNoteText(draft.content);
  };
  const newNote = () => openNote({ id:0,title:"",content:"",sources:[],updatedAt:0 });
  const updateNoteDraft = (title: string,content: string) => {
    if (!note) return;
    setNoteTitle(title); setNoteText(content);
    try { writeNoteDraft({...note,title,content,updatedAt:Date.now()}); setDrafts(readNoteDrafts()); }
    catch { setError("This draft could not be saved locally. Save the note before closing this editor."); }
  };


  return <section className="library-shell" aria-label="Library">
    <header className="library-header"><div><h1>Library</h1><p>Your documents, within reach.</p></div><div className="library-actions">
      <Tooltip label="Add documents"><Button aria-label="Add documents" disabled={!native || pending || indexing} onClick={() => void importSources(false)}><FilePlus2 size={17} /></Button></Tooltip>
      <Tooltip label="Add folder"><Button aria-label="Add folder" disabled={!native || pending || indexing} onClick={() => void importSources(true)}><FolderPlus size={17} /></Button></Tooltip>
      <Tooltip label="Refresh sources"><Button aria-label="Refresh sources" disabled={!native || pending || indexing || !overview.roots.length} onClick={() => void action(async () => { await libraryApi.refresh(); await reload(); setRevision((v) => v + 1); })}><RefreshCw size={17} /></Button></Tooltip>
    </div></header>
    {!native && <p className="library-notice" role="status">Open the installed VOID app to import and search your local documents.</p>}
    {notice && <div className="library-notice" role="status"><span>{notice}</span><Button onClick={() => useAppStore.getState().setModule("mind")}>Open Mind Mini</Button><Button aria-label="Dismiss source notice" onClick={() => setNotice("")}><X size={15} /></Button></div>}
    {error && <div className="library-notice" role="alert"><span>{error}</span><Button aria-label="Dismiss Library error" onClick={() => setError("")}><X size={15} /></Button></div>}
    {overview.progress.phase && <div className="library-progress" role="status"><span>{indexing ? `Indexing ${overview.progress.current || "selected sources"}` : overview.progress.phase === "cancelled" ? "Indexing stopped. Refresh to resume." : overview.progress.phase === "error" ? overview.progress.detail : `${overview.progress.indexed} indexed · ${overview.progress.unchanged} unchanged · ${overview.progress.errors} errors · ${overview.progress.missing} missing · ${overview.progress.skipped} skipped`}</span>{indexing ? <Button onClick={() => void action(() => libraryApi.cancel())}>Stop indexing</Button> : overview.progress.detail && <small>{overview.progress.detail}</small>}</div>}
    <div className="library-layout" data-reading={selected !== null || note !== null}>
      <aside className="library-sources" aria-label="Library sources">
        <div className="library-tabs"><Button aria-pressed={tab === "documents"} onClick={() => { setTab("documents"); setOffset(0); }}>Documents</Button><Button aria-pressed={tab === "notes"} onClick={() => { setTab("notes"); setOffset(0); }}>Notes <small>{overview.noteCount ?? overview.notes.length}</small></Button></div>
        {tab === "documents" ? <><label className="library-field">Source<Select label="Library source" value={root} onValueChange={(value) => { setRoot(value); setOffset(0); }}><option value="">All sources</option>{overview.roots.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</Select></label>
          <ScrollSurface className="library-root-scroll" label="Registered sources">{overview.roots.map((source) => <div className="library-root" key={source.id}><Button title={source.path} onClick={() => { setRoot(String(source.id)); setOffset(0); }}><strong>{source.label}</strong><small>{source.directory ? "Folder" : "Document"}</small></Button><Button aria-label={`Remove ${source.label}`} disabled={indexing || pending} onClick={() => void action(async () => { if (await confirm(`Remove “${source.label}” from Library? Original files and saved notes will be kept.`)) { await libraryApi.removeRoot(source.id); if (root === String(source.id)) setRoot(""); setSelected(null); await reload(); setRevision((v) => v + 1); } })}><X size={14} /></Button></div>)}</ScrollSurface>
        </> : <Button className="is-secondary" disabled={!native} onClick={(event) => { readerReturn.current = event.currentTarget; newNote(); }}>New note</Button>}
        <div className="library-storage"><small>{(overview.storageBytes / 1024 / 1024).toFixed(1)} MiB stored locally</small><Button disabled={!native || pending || indexing} onClick={() => void action(async () => { if (await confirm("Clear all Library sources, indexed text, saved notes and unfinished drafts? Original files and other VOID data will be kept.")) { await libraryApi.clear(); clearNoteDrafts(); setDrafts({}); setSelected(null); setNote(null); setRoot(""); await reload(); setRevision((v) => v + 1); } })}>Clear Library data</Button></div>
      </aside>
      <section className="library-results" aria-label={tab === "documents" ? "Library documents" : "Library notes"}>
        <div className="library-search"><Search size={16} aria-hidden="true" /><Input aria-label="Search Library" type="search" maxLength={500} value={query} onChange={(e) => { setQuery(e.target.value); setOffset(0); }} placeholder={tab === "notes" ? "Find a note…" : "Search inside your documents…"} /></div>
        {tab === "documents" && <Select label="Document format" value={kind} onValueChange={(value) => { setKind(value); setOffset(0); }}><option value="">All formats</option><option value="md">Markdown</option><option value="txt">Text</option><option value="pdf">PDF</option></Select>}
        <ScrollSurface className="library-result-scroll" label="Library results">
          {loading && <p className="library-hint" role="status">Loading documents…</p>}
          {tab === "notes" && Object.keys(drafts).length > 0 && <div className="library-drafts"><h2>Unfinished notes</h2>{Object.values(drafts).map((draft) => <Button className="library-result" key={noteDraftKey(draft.id)} onClick={() => openNote(draft)}><strong>{draft.title || "Untitled draft"}</strong><small>Draft saved on this device</small></Button>)}</div>}
          {tab === "notes" ? notes.map((value) => <Button className="library-result" key={value.id} onClick={(event) => { readerReturn.current = event.currentTarget; openNote(value); }}><strong>{value.title}</strong><small>{value.sources.length} linked sources</small><p>{value.content.slice(0,160)}</p></Button>) : results.map((result) => {
            const hit = "document" in result ? result as LibraryHit : null;
            const doc = hit?.document ?? result as LibraryDocument;
            return <Button className="library-result" key={hit ? `p${hit.passage.id}` : `d${doc.id}`} aria-pressed={selected === doc.id} onClick={(event) => { readerReturn.current = event.currentTarget; openDocument(doc.id,hit?.passage); }}><strong>{doc.title}</strong><small>{doc.kind.toUpperCase()} · {hit ? passageLocation(hit.passage) : `${doc.passageCount} passages`} {doc.status !== "ready" ? `· ${doc.status}` : ""}</small>{hit ? <p>{hit.excerpt}</p> : doc.detail && <p>{doc.detail}</p>}</Button>;
          })}
          {!loading && tab === "documents" && !results.length && <div className="library-empty"><BookOpen size={28} /><h2>{query.trim() ? "No matching passages" : overview.roots.length ? "No indexed documents yet" : "Keep useful things close."}</h2><p>{query.trim() ? "Try fewer words or another source." : "Add a folder or documents. Search their text and return to the exact passage, even without a model connected."}</p></div>}
          {!loading && tab === "notes" && !notes.length && <div className="library-empty"><h2>A place for what you learn.</h2><p>Create a note or save an answer with its sources.</p></div>}
        </ScrollSurface>
        {(offset > 0 || more) && <div className="library-pagination"><Button disabled={offset === 0} onClick={() => setOffset((v) => Math.max(0,v - (tab === "notes" || query.trim() ? 40 : 100)))}>Previous</Button><span>Page {Math.floor(offset / (tab === "notes" || query.trim() ? 40 : 100)) + 1}</span><Button disabled={!more} onClick={() => setOffset((v) => v + (tab === "notes" || query.trim() ? 40 : 100))}>Next</Button></div>}
      </section>
      {(selected !== null || note !== null) && <section className="library-reader" aria-label="Library reader"><div className="library-reader-heading"><div><h2 ref={readerHeading} tabIndex={-1}>{note ? note.id ? "Edit note" : "New note" : document?.title ?? "Opening document…"}</h2>{document && !note && <small>Indexed {new Date(document.indexedAt).toLocaleString()} · snapshot {document.fingerprint.slice(0,8)}</small>}</div><Button aria-label="Close reader" onClick={closeReader}><X size={17} /></Button></div>
        {note ? <div className="library-note-editor"><Input aria-label="Note title" placeholder="Note title" maxLength={120} value={noteTitle} onChange={(e) => updateNoteDraft(e.target.value,noteText)} /><Textarea aria-label="Note content" placeholder="Write what matters…" maxLength={100000} value={noteText} onChange={(e) => updateNoteDraft(noteTitle,e.target.value)} /><div className="library-note-sources">{note.sources.map((source,index) => <Disclosure key={`${source.passageId}-${index}`}><DisclosureTitle>{source.title} · {passageLocation(source)}</DisclosureTitle><DisclosureBody><p>{source.text}</p><small>Saved snapshot {source.fingerprint.slice(0,8)}</small></DisclosureBody></Disclosure>)}</div><div className="library-actions"><Button disabled={pending} onClick={() => void action(async () => { if (await confirm("Discard this unfinished draft? The last saved note will be kept.")) { removeNoteDraft(note.id); setDrafts(readNoteDrafts()); setNote(null); } })}>Discard draft</Button><Button className="is-primary" disabled={pending || !noteTitle.trim()} onClick={() => void action(async () => { const saved = await libraryApi.saveNote(noteTitle,noteText,note.sources,note.id || null); removeNoteDraft(note.id); setDrafts(readNoteDrafts()); setNote(saved); await reload(); })}>Save note</Button>{note.id > 0 && <Button aria-label="Delete note" disabled={pending} onClick={() => void action(async () => { if (await confirm(`Delete “${note.title}”?`)) { await libraryApi.deleteNote(note.id); removeNoteDraft(note.id); setDrafts(readNoteDrafts()); setNote(null); await reload(); } })}><Trash2 size={16} /></Button>}</div></div> : <ScrollSurface className="library-reader-scroll" label="Document passages"><div ref={reader}>{sourceWarning && <p className="library-notice" role="status">{sourceWarning} Showing the saved indexed snapshot.</p>}{document?.status !== "ready" && <p className="library-notice">{document?.detail}</p>}{passages.map((passage) => <article className="library-passage" data-passage={passage.id} data-selected={passage.id === targetPassage} key={passage.id}><header><small>{passageLocation(passage)}</small><Button disabled={pending || indexing || !!sourceWarning} onClick={() => void action(async () => {
          const sources = await libraryApi.snapshots([passage.id]); await libraryApi.validateSources(sources);
          sources.forEach((source) => useMindStore.getState().attachSource(source)); setNotice("Passage added to the current Mind draft. Choose more passages or open Mind Mini.");
        })}>Use in Mind</Button></header><p>{passage.text}</p></article>)}</div></ScrollSurface>}
        {!note && document && document.passageCount > 100 && <div className="library-pagination"><Button disabled={readerOffset === 0} onClick={() => setReaderOffset((v) => Math.max(0,v-100))}>Previous passages</Button><Button disabled={readerOffset+100 >= document.passageCount} onClick={() => setReaderOffset((v) => v+100)}>Next passages</Button></div>}
      </section>}
    </div>
  </section>;
}
