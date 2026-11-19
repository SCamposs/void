use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Root {
    pub id: i64,
    pub path: String,
    pub label: String,
    pub directory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: i64,
    pub root_id: i64,
    pub path: String,
    pub title: String,
    pub kind: String,
    pub fingerprint: String,
    pub status: String,
    pub detail: String,
    pub bytes: i64,
    pub indexed_at: i64,
    pub passage_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Passage {
    pub id: i64,
    pub document_id: i64,
    pub ordinal: u32,
    pub page: Option<u32>,
    pub line_start: Option<u32>,
    pub line_end: Option<u32>,
    pub text: String,
}

/// Durable context is a snapshot, so an answer still has inspectable evidence after a source changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSnapshot {
    pub document_id: i64,
    pub passage_id: i64,
    pub title: String,
    pub path: String,
    pub fingerprint: String,
    pub page: Option<u32>,
    pub line_start: Option<u32>,
    pub line_end: Option<u32>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub document: Document,
    pub passage: Passage,
    pub excerpt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub sources: Vec<SourceSnapshot>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexProgress {
    pub phase: String,
    pub visited: usize,
    pub indexed: usize,
    pub unchanged: usize,
    pub errors: usize,
    pub skipped: usize,
    pub missing: usize,
    pub current: String,
    pub detail: String,
    pub started_at: i64,
    pub finished_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderPage {
    pub source_warning: Option<String>,
    pub document: Document,
    pub passages: Vec<Passage>,
}
