//! Writes to a database file whose index pages were damaged after it was created (a disk that fails, a half-copied
//! file): every write reports the error instead of pretending to succeed, while reading the rows still works.
use novira_core::db::{Db, Table};
use std::io::{Seek, SeekFrom, Write};

const FILE: &str = "novira.sqlite";
const PAGE: u64 = 4096;

/// The page of the index SQLite keeps for the `id` column of each table (two pages per table, created in this order:
/// the table, then its index; `meta` last).
fn index_page(table: Option<Table>) -> u64 {
    match table {
        Some(Table::Boards) => 3,
        Some(Table::Images) => 5,
        Some(Table::Workflows) => 7,
        Some(Table::Models) => 9,
        Some(Table::Queue) => 11,
        Some(Table::Comics) => 13,
        Some(Table::Watermarks) => 15,
        Some(Table::Trash) => 17,
        None => 19,
    }
}

/// Creates a database with its tables, closes it and overwrites the index page of `table` (`None`: of `meta`).
fn damaged(dir: &std::path::Path, table: Option<Table>) -> Db {
    drop(Db::open(dir).unwrap());
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .open(dir.join(FILE))
        .unwrap();
    file.seek(SeekFrom::Start((index_page(table) - 1) * PAGE))
        .unwrap();
    file.write_all(&[0xff; PAGE as usize]).unwrap();
    drop(file);
    Db::open(dir).unwrap()
}

#[test]
fn writing_a_row_to_a_damaged_table_reports_the_error() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = damaged(dir.path(), Some(Table::Images));
    let row = serde_json::json!({"k": 1});
    assert!(db.put(Table::Images, "a", 1, &row).is_err());
    assert!(db.put_many(Table::Images, [("a", 1, &row)]).is_err());
    // Reading what is there still works, and a table that is not damaged is still writable.
    assert!(db
        .load::<serde_json::Value>(Table::Images)
        .unwrap()
        .is_empty());
    db.put(Table::Boards, "b", 1, &row).unwrap();
}

#[test]
fn writing_a_setting_to_a_damaged_meta_table_reports_the_error() {
    let dir = tempfile::tempdir().unwrap();
    let db = damaged(dir.path(), None);
    assert!(db.set_meta("k", "v").is_err());
}
