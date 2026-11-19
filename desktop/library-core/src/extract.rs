use crate::{models::Passage, Result};
use std::path::Path;

pub const MAX_FILE_BYTES: u64 = 32 * 1024 * 1024;
pub const MAX_PDF_BYTES: u64 = 8 * 1024 * 1024;
pub const MAX_TEXT_CHARS: usize = 2_000_000;
const CHUNK_CHARS: usize = 1600;

pub fn kind(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "md" | "markdown" => Some("md"),
        "txt" => Some("txt"),
        "pdf" => Some("pdf"),
        _ => None,
    }
}

fn decode_text(bytes: &[u8]) -> Result<String> {
    let text = if bytes.starts_with(&[0xff, 0xfe]) || bytes.starts_with(&[0xfe, 0xff]) {
        if !bytes.len().is_multiple_of(2) {
            return Err("Incomplete UTF-16 text file.".into());
        }
        let little = bytes[0] == 0xff;
        let words = bytes[2..]
            .chunks_exact(2)
            .map(|pair| {
                if little {
                    u16::from_le_bytes([pair[0], pair[1]])
                } else {
                    u16::from_be_bytes([pair[0], pair[1]])
                }
            })
            .collect::<Vec<_>>();
        String::from_utf16(&words).map_err(|_| "Invalid UTF-16 text.".to_string())?
    } else {
        std::str::from_utf8(bytes.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(bytes))
            .map_err(|_| "Use UTF-8 or UTF-16 with a byte-order mark for text files.".to_string())?
            .to_string()
    };
    if text.contains('\0') {
        return Err("This file contains binary data instead of readable text.".into());
    }
    Ok(text.replace("\r\n", "\n").replace('\r', "\n"))
}

fn pieces(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut result = Vec::new();
    let mut start = 0;
    while start < chars.len() {
        let max_end = (start + CHUNK_CHARS).min(chars.len());
        let end = if max_end < chars.len() {
            (start + CHUNK_CHARS / 2..max_end)
                .rev()
                .find(|i| chars[*i].is_whitespace())
                .unwrap_or(max_end)
        } else {
            max_end
        };
        let part: String = chars[start..end].iter().collect();
        if !part.trim().is_empty() {
            result.push(part);
        }
        start = end;
    }
    result
}

pub fn extract(path: &Path, bytes: &[u8]) -> Result<Vec<Passage>> {
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("File exceeds the 32 MiB indexing limit.".into());
    }
    let file_kind = kind(path).ok_or("Supported formats are Markdown, TXT and PDF.".to_string())?;
    let mut passages = Vec::new();
    if file_kind == "pdf" {
        if bytes.len() as u64 > MAX_PDF_BYTES {
            return Err("PDF exceeds the 8 MiB indexing limit.".into());
        }
        let pages = std::panic::catch_unwind(|| pdf_extract::extract_text_from_mem_by_pages(bytes))
            .map_err(|_| "PDF could not be decoded safely.".to_string())?
            .map_err(|_| {
                "PDF could not be read. It may be encrypted, damaged or unsupported.".to_string()
            })?;
        if pages.len() > 1000 {
            return Err("PDF exceeds the 1,000-page indexing limit.".into());
        }
        if pages.iter().map(|page| page.chars().count()).sum::<usize>() > MAX_TEXT_CHARS {
            return Err("Extracted text exceeds the 2,000,000-character indexing limit.".into());
        }
        for (page_index, page) in pages.iter().enumerate() {
            for text in pieces(page) {
                passages.push(Passage {
                    id: 0,
                    document_id: 0,
                    ordinal: passages.len() as u32,
                    page: Some(page_index as u32 + 1),
                    line_start: None,
                    line_end: None,
                    text,
                });
            }
        }
        if passages.is_empty() {
            return Err(
                "No selectable text found. Scanned PDFs need OCR, which Library does not run."
                    .into(),
            );
        }
    } else {
        let text = decode_text(bytes)?;
        if text.chars().count() > MAX_TEXT_CHARS {
            return Err("Text exceeds the 2,000,000-character indexing limit.".into());
        }
        let mut pending = String::new();
        let mut start_line = 1;
        let mut end_line = 1;
        let push = |passages: &mut Vec<Passage>, text: String, start, end| {
            for piece in pieces(&text) {
                passages.push(Passage {
                    id: 0,
                    document_id: 0,
                    ordinal: passages.len() as u32,
                    page: None,
                    line_start: Some(start),
                    line_end: Some(end),
                    text: piece,
                });
            }
        };
        for (index, line) in text.lines().enumerate() {
            if !pending.is_empty()
                && pending.chars().count() + line.chars().count() + 1 > CHUNK_CHARS
            {
                push(
                    &mut passages,
                    std::mem::take(&mut pending),
                    start_line,
                    end_line,
                );
            }
            if pending.is_empty() {
                start_line = index as u32 + 1;
            }
            pending.push_str(line);
            pending.push('\n');
            end_line = index as u32 + 1;
        }
        if !pending.trim().is_empty() {
            push(&mut passages, pending, start_line, end_line);
        }
        if passages.is_empty() {
            return Err("This document has no text to index.".into());
        }
    }
    Ok(passages)
}
