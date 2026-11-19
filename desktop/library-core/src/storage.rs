use crate::{models::*, Result};
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::{
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

pub fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
fn err(error: impl std::fmt::Display) -> String {
    error.to_string()
}
const DOC: &str = "d.id,d.root_id,d.path,d.title,d.kind,d.fingerprint,d.status,d.detail,d.bytes,d.indexed_at,(SELECT count(*) FROM passages p WHERE p.document_id=d.id)";

pub struct Library {
    pub(crate) connection: Connection,
}

impl Library {
    pub fn open(path: &Path) -> Result<Self> {
        let connection = Connection::open(path).map_err(err)?;
        connection
            .busy_timeout(Duration::from_secs(3))
            .map_err(err)?;
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .map_err(err)?;
        if version > 1 {
            return Err(
                "This Library was created by a newer VOID version. Update VOID before opening it."
                    .into(),
            );
        }
        connection.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON;
          CREATE TABLE IF NOT EXISTS roots(id INTEGER PRIMARY KEY AUTOINCREMENT,path TEXT UNIQUE NOT NULL,label TEXT NOT NULL,directory INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY AUTOINCREMENT,root_id INTEGER NOT NULL REFERENCES roots(id) ON DELETE CASCADE,
            path TEXT UNIQUE NOT NULL,title TEXT NOT NULL,kind TEXT NOT NULL,fingerprint TEXT NOT NULL,status TEXT NOT NULL,detail TEXT NOT NULL,bytes INTEGER NOT NULL,indexed_at INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS passages(id INTEGER PRIMARY KEY AUTOINCREMENT,document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            ordinal INTEGER NOT NULL,page INTEGER,line_start INTEGER,line_end INTEGER,text TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS passages_document ON passages(document_id,ordinal);
          CREATE INDEX IF NOT EXISTS documents_root ON documents(root_id);
          CREATE VIRTUAL TABLE IF NOT EXISTS passage_search USING fts5(text,content='passages',content_rowid='id',tokenize='unicode61 remove_diacritics 2');
          CREATE TRIGGER IF NOT EXISTS passages_insert AFTER INSERT ON passages BEGIN INSERT INTO passage_search(rowid,text) VALUES(new.id,new.text); END;
          CREATE TRIGGER IF NOT EXISTS passages_delete AFTER DELETE ON passages BEGIN INSERT INTO passage_search(passage_search,rowid,text) VALUES('delete',old.id,old.text); END;
          CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,content TEXT NOT NULL,sources TEXT NOT NULL,updated_at INTEGER NOT NULL);
          PRAGMA user_version=1;").map_err(err)?;
        Ok(Self { connection })
    }

    pub fn roots(&self) -> Result<Vec<Root>> {
        self.connection
            .prepare("SELECT id,path,label,directory FROM roots ORDER BY label COLLATE NOCASE,id")
            .map_err(err)?
            .query_map([], |row| {
                Ok(Root {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    label: row.get(2)?,
                    directory: row.get(3)?,
                })
            })
            .map_err(err)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(err)
    }

    pub fn add_root(&self, path: &Path) -> Result<Root> {
        let metadata = std::fs::symlink_metadata(path).map_err(err)?;
        if crate::index::is_link(&metadata) {
            return Err("Select the original file or folder, not a symbolic link.".into());
        }
        let path = path.canonicalize().map_err(err)?;
        let directory = metadata.is_dir();
        if !directory && (!metadata.is_file() || crate::extract::kind(&path).is_none()) {
            return Err("Select a folder, Markdown, TXT or PDF file.".into());
        }
        let string = path
            .to_str()
            .ok_or("This path cannot be represented as Unicode.")?
            .to_string();
        let roots = self.roots()?;
        for root in &roots {
            if root.path == string {
                return Ok(root.clone());
            }
            let existing = Path::new(&root.path);
            if (root.directory && path.starts_with(existing))
                || (directory && existing.starts_with(&path))
            {
                return Err("This selection overlaps a registered source. Remove that source before replacing it with a parent or child folder.".into());
            }
        }
        if roots.len() >= 100 {
            return Err("Library supports up to 100 registered sources.".into());
        }
        let label = path
            .file_name()
            .unwrap_or(path.as_os_str())
            .to_string_lossy()
            .to_string();
        self.connection
            .execute(
                "INSERT INTO roots(path,label,directory) VALUES(?1,?2,?3)",
                params![string, label, directory],
            )
            .map_err(err)?;
        Ok(Root {
            id: self.connection.last_insert_rowid(),
            path: string,
            label,
            directory,
        })
    }

    pub fn add_roots(&self, paths: &[std::path::PathBuf]) -> Result<Vec<Root>> {
        let transaction = self.connection.unchecked_transaction().map_err(err)?;
        let roots = paths
            .iter()
            .map(|path| self.add_root(path))
            .collect::<Result<Vec<_>>>()?;
        transaction.commit().map_err(err)?;
        Ok(roots)
    }

    pub fn documents(&self, root: Option<i64>, offset: u32) -> Result<Vec<Document>> {
        self.documents_filtered(root, None, offset)
    }

    pub fn documents_filtered(
        &self,
        root: Option<i64>,
        kind: Option<&str>,
        offset: u32,
    ) -> Result<Vec<Document>> {
        let sql = format!("SELECT {DOC} FROM documents d WHERE (?1 IS NULL OR root_id=?1) AND (?2 IS NULL OR kind=?2) ORDER BY title COLLATE NOCASE,id LIMIT 100 OFFSET ?3");
        self.connection
            .prepare(&sql)
            .map_err(err)?
            .query_map(params![root, kind, offset], document_row)
            .map_err(err)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(err)
    }

    pub fn document(&self, id: i64) -> Result<Document> {
        self.connection
            .query_row(
                &format!("SELECT {DOC} FROM documents d WHERE id=?1"),
                [id],
                document_row,
            )
            .map_err(err)
    }

    pub fn passages(&self, document: i64, offset: u32) -> Result<Vec<Passage>> {
        self.connection.prepare("SELECT id,document_id,ordinal,page,line_start,line_end,text FROM passages WHERE document_id=?1 ORDER BY ordinal LIMIT 100 OFFSET ?2").map_err(err)?
            .query_map(params![document,offset], passage_row).map_err(err)?.collect::<rusqlite::Result<Vec<_>>>().map_err(err)
    }

    pub fn reader(&self, document: i64, offset: u32) -> Result<ReaderPage> {
        let transaction = self.connection.unchecked_transaction().map_err(err)?;
        let mut page = ReaderPage {
            source_warning: None,
            document: self.document(document)?,
            passages: self.passages(document, offset)?,
        };
        transaction.commit().map_err(err)?;
        if let Some(passage) = page.passages.first() {
            page.source_warning = self
                .snapshot(passage.id)
                .and_then(|source| self.validate_source(&source))
                .err();
        }
        Ok(page)
    }

    pub fn snapshot(&self, passage: i64) -> Result<SourceSnapshot> {
        let p = self.connection.query_row("SELECT id,document_id,ordinal,page,line_start,line_end,text FROM passages WHERE id=?1", [passage], passage_row).map_err(err)?;
        let d = self.document(p.document_id)?;
        if d.status != "ready" {
            return Err("This source is not currently available. Refresh the Library.".into());
        }
        Ok(SourceSnapshot {
            document_id: d.id,
            passage_id: p.id,
            title: d.title,
            path: d.path,
            fingerprint: d.fingerprint,
            page: p.page,
            line_start: p.line_start,
            line_end: p.line_end,
            text: p.text,
        })
    }

    pub fn validate_source(&self, source: &SourceSnapshot) -> Result<()> {
        use sha2::{Digest, Sha256};
        let current = self.snapshot(source.passage_id).map_err(|_| {
            "Selected source is no longer indexed. Refresh Library and select it again.".to_string()
        })?;
        if current.fingerprint != source.fingerprint
            || current.document_id != source.document_id
            || current.path != source.path
            || current.text != source.text
            || current.page != source.page
            || current.line_start != source.line_start
            || current.line_end != source.line_end
        {
            return Err(
                "Selected source changed. Refresh Library, remove the outdated attachment and add the updated passage.".into(),
            );
        }
        let path = Path::new(&current.path);
        let bytes = crate::index::read_source(path)?;
        if format!("{:x}", Sha256::digest(&bytes)) != current.fingerprint {
            return Err("An original document changed since indexing. Refresh Library, remove the outdated attachment and add the updated passage.".into());
        }
        Ok(())
    }

    pub fn search(
        &self,
        query: &str,
        root: Option<i64>,
        kind: Option<&str>,
        offset: u32,
    ) -> Result<Vec<SearchHit>> {
        let terms: Vec<_> = query
            .split(|c: char| !c.is_alphanumeric())
            .filter(|s| !s.is_empty())
            .take(24)
            .map(|s| format!("\"{}\"", s.chars().take(100).collect::<String>()))
            .collect();
        if terms.is_empty() {
            return Ok(Vec::new());
        }
        let sql = format!("SELECT {DOC},p.id,p.document_id,p.ordinal,p.page,p.line_start,p.line_end,p.text,
          snippet(passage_search,0,'','','…',40) FROM passage_search JOIN passages p ON p.id=passage_search.rowid
          JOIN documents d ON d.id=p.document_id WHERE passage_search MATCH ?1 AND d.status='ready'
          AND (?2 IS NULL OR d.root_id=?2) AND (?3 IS NULL OR d.kind=?3)
          ORDER BY bm25(passage_search),d.id,p.ordinal LIMIT 40 OFFSET ?4");
        self.connection
            .prepare(&sql)
            .map_err(err)?
            .query_map(params![terms.join(" AND "), root, kind, offset], |row| {
                Ok(SearchHit {
                    document: document_row(row)?,
                    passage: Passage {
                        id: row.get(11)?,
                        document_id: row.get(12)?,
                        ordinal: row.get(13)?,
                        page: row.get(14)?,
                        line_start: row.get(15)?,
                        line_end: row.get(16)?,
                        text: row.get(17)?,
                    },
                    excerpt: row.get(18)?,
                })
            })
            .map_err(err)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(err)
    }

    pub fn replace_document(
        &mut self,
        root: i64,
        path: &str,
        kind: &str,
        fingerprint: &str,
        bytes: u64,
        extracted: Result<Vec<Passage>>,
    ) -> Result<i64> {
        let title = Path::new(path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let (status, detail, passages) = match extracted {
            Ok(passages) => ("ready", String::new(), passages),
            Err(detail) => ("error", detail, Vec::new()),
        };
        let tx = self.connection.transaction().map_err(err)?;
        tx.execute("INSERT INTO documents(root_id,path,title,kind,fingerprint,status,detail,bytes,indexed_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)
            ON CONFLICT(path) DO UPDATE SET root_id=excluded.root_id,title=excluded.title,kind=excluded.kind,fingerprint=excluded.fingerprint,status=excluded.status,detail=excluded.detail,bytes=excluded.bytes,indexed_at=excluded.indexed_at",
            params![root,path,title,kind,fingerprint,status,detail,i64::try_from(bytes).map_err(err)?,now()]).map_err(err)?;
        let id = tx
            .query_row("SELECT id FROM documents WHERE path=?1", [path], |row| {
                row.get::<_, i64>(0)
            })
            .map_err(err)?;
        tx.execute("DELETE FROM passages WHERE document_id=?1", [id])
            .map_err(err)?;
        for p in passages {
            tx.execute("INSERT INTO passages(document_id,ordinal,page,line_start,line_end,text) VALUES(?1,?2,?3,?4,?5,?6)",params![id,p.ordinal,p.page,p.line_start,p.line_end,p.text]).map_err(err)?;
        }
        tx.commit().map_err(err)?;
        Ok(id)
    }

    pub(crate) fn fingerprint(&self, path: &str) -> Result<Option<String>> {
        self.connection
            .query_row(
                "SELECT fingerprint FROM documents WHERE path=?1 AND status='ready'",
                [path],
                |row| row.get(0),
            )
            .optional()
            .map_err(err)
    }

    pub(crate) fn mark_missing(&mut self, id: i64) -> Result<()> {
        let tx = self.connection.transaction().map_err(err)?;
        tx.execute("DELETE FROM passages WHERE document_id=?1", [id])
            .map_err(err)?;
        tx.execute("UPDATE documents SET status='missing',detail='Original file is missing or outside the selected source.',indexed_at=?2 WHERE id=?1",params![id,now()]).map_err(err)?;
        tx.commit().map_err(err)
    }

    pub fn remove_root(&self, id: i64) -> Result<()> {
        self.connection
            .execute("DELETE FROM roots WHERE id=?1", [id])
            .map_err(err)?;
        Ok(())
    }

    pub fn save_note(
        &self,
        id: Option<i64>,
        title: &str,
        content: &str,
        sources: &[SourceSnapshot],
    ) -> Result<Note> {
        let title = title.trim();
        if title.is_empty()
            || title.chars().count() > 120
            || content.chars().count() > 100_000
            || sources.len() > 24
            || sources
                .iter()
                .any(|source| source.text.chars().count() > 4000)
        {
            return Err("Note exceeds its title, text or source limits.".into());
        }
        let updated_at = now();
        let json = serde_json::to_string(sources).map_err(err)?;
        let note_id = if let Some(id) = id {
            if self
                .connection
                .execute(
                    "UPDATE notes SET title=?2,content=?3,sources=?4,updated_at=?5 WHERE id=?1",
                    params![id, title, content, json, updated_at],
                )
                .map_err(err)?
                == 0
            {
                return Err("Note no longer exists.".into());
            }
            id
        } else {
            self.connection
                .execute(
                    "INSERT INTO notes(title,content,sources,updated_at) VALUES(?1,?2,?3,?4)",
                    params![title, content, json, updated_at],
                )
                .map_err(err)?;
            self.connection.last_insert_rowid()
        };
        Ok(Note {
            id: note_id,
            title: title.into(),
            content: content.into(),
            sources: sources.into(),
            updated_at,
        })
    }

    pub fn notes(&self) -> Result<Vec<Note>> {
        self.notes_page("", 0)
    }
    pub fn note_count(&self) -> Result<u64> {
        self.connection
            .query_row("SELECT count(*) FROM notes", [], |row| row.get::<_, i64>(0))
            .map(|count| count as u64)
            .map_err(err)
    }
    pub fn notes_page(&self, query: &str, offset: u32) -> Result<Vec<Note>> {
        let needle = query.to_lowercase();
        let mut statement = self.connection.prepare("SELECT id,title,content,sources,updated_at FROM notes ORDER BY updated_at DESC,id DESC").map_err(err)?;
        let mut rows = statement.query([]).map_err(err)?;
        let mut matches = 0;
        let mut notes = Vec::new();
        while let Some(row) = rows.next().map_err(err)? {
            let title: String = row.get(1).map_err(err)?;
            let content: String = row.get(2).map_err(err)?;
            if !needle.is_empty()
                && !format!("{title} {content}")
                    .to_lowercase()
                    .contains(&needle)
            {
                continue;
            }
            if matches < offset {
                matches += 1;
                continue;
            }
            let json: String = row.get(3).map_err(err)?;
            notes.push(Note {
                id: row.get(0).map_err(err)?,
                title,
                content,
                sources: serde_json::from_str(&json).map_err(err)?,
                updated_at: row.get(4).map_err(err)?,
            });
            if notes.len() == 40 {
                break;
            }
        }
        Ok(notes)
    }

    pub fn delete_note(&self, id: i64) -> Result<()> {
        self.connection
            .execute("DELETE FROM notes WHERE id=?1", [id])
            .map_err(err)?;
        Ok(())
    }

    pub fn clear(&self) -> Result<()> {
        self.connection.execute_batch("BEGIN; DELETE FROM roots; DELETE FROM notes; COMMIT; INSERT INTO passage_search(passage_search) VALUES('optimize'); PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE);").map_err(err)
    }

    pub fn storage_bytes(&self) -> Result<u64> {
        let pages: i64 = self
            .connection
            .query_row("PRAGMA page_count", [], |r| r.get(0))
            .map_err(err)?;
        let size: i64 = self
            .connection
            .query_row("PRAGMA page_size", [], |r| r.get(0))
            .map_err(err)?;
        Ok((pages * size) as u64)
    }
}

fn document_row(row: &Row<'_>) -> rusqlite::Result<Document> {
    Ok(Document {
        id: row.get(0)?,
        root_id: row.get(1)?,
        path: row.get(2)?,
        title: row.get(3)?,
        kind: row.get(4)?,
        fingerprint: row.get(5)?,
        status: row.get(6)?,
        detail: row.get(7)?,
        bytes: row.get(8)?,
        indexed_at: row.get(9)?,
        passage_count: row.get(10)?,
    })
}
fn passage_row(row: &Row<'_>) -> rusqlite::Result<Passage> {
    Ok(Passage {
        id: row.get(0)?,
        document_id: row.get(1)?,
        ordinal: row.get(2)?,
        page: row.get(3)?,
        line_start: row.get(4)?,
        line_end: row.get(5)?,
        text: row.get(6)?,
    })
}
