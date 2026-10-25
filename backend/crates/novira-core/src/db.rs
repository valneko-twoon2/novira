//! SQLite persistence. Each table keeps one JSON document per row; the in-memory state is the working copy
//! and every change is written through, so a crash loses at most the change in flight.
use rusqlite::{params, Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Serialize};
use std::path::Path;

pub const DB_FILE: &str = "novira.sqlite";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Table {
    Boards,
    Images,
    Workflows,
    Models,
    Queue,
    Comics,
    /// Watermark ids of exported copies and the gallery picture each came from.
    Watermarks,
}

impl Table {
    fn name(self) -> &'static str {
        match self {
            Table::Boards => "boards",
            Table::Images => "images",
            Table::Workflows => "workflows",
            Table::Models => "models",
            Table::Queue => "queue",
            Table::Comics => "comics",
            Table::Watermarks => "watermarks",
        }
    }

    const ALL: [Table; 7] = [
        Table::Boards,
        Table::Images,
        Table::Workflows,
        Table::Models,
        Table::Queue,
        Table::Comics,
        Table::Watermarks,
    ];
}

pub struct Db {
    conn: Connection,
}

impl Db {
    pub fn open(data_dir: &Path) -> rusqlite::Result<Self> {
        Self::init(Connection::open(data_dir.join(DB_FILE))?)
    }

    pub fn in_memory() -> rusqlite::Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(conn: Connection) -> rusqlite::Result<Self> {
        conn.pragma_update_and_check(None, "journal_mode", "WAL", |_| Ok(()))?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        for t in Table::ALL {
            conn.execute_batch(&format!(
                "CREATE TABLE IF NOT EXISTS {} (id TEXT PRIMARY KEY, sort INTEGER NOT NULL, data TEXT NOT NULL);",
                t.name()
            ))?;
        }
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
        )?;
        Ok(Self { conn })
    }

    /// All rows of a table in `sort` order (then `id`). Rows that no longer parse are skipped and reported.
    pub fn load<T: DeserializeOwned>(&self, table: Table) -> rusqlite::Result<Vec<T>> {
        // Sorted here, not with ORDER BY: `sort` has no index, so SQLite sorted the whole rows, JSON included, in a
        // temporary b-tree. For a gallery of 2400 pictures (3.3 MB) that was 15 of the 25 ms the start spent loading it.
        let mut stmt = self
            .conn
            .prepare(&format!("SELECT sort, id, data FROM {}", table.name()))?;
        let mut rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        // `id` is TEXT in the BINARY collation, which compares bytes as `String` does.
        rows.sort_unstable_by(|a, b| (a.0, &a.1).cmp(&(b.0, &b.1)));
        let mut out = Vec::with_capacity(rows.len());
        for (_, id, data) in rows {
            match serde_json::from_str(&data) {
                Ok(v) => out.push(v),
                Err(e) => crate::applog::warn(
                    "database",
                    format!("skipped unreadable {} row {id}: {e}", table.name()),
                ),
            }
        }
        Ok(out)
    }

    /// One row by id, or `None` when there is none or it no longer parses (reported like `load`).
    pub fn get<T: DeserializeOwned>(&self, table: Table, id: &str) -> rusqlite::Result<Option<T>> {
        let data: Option<String> = self
            .conn
            .query_row(
                &format!("SELECT data FROM {} WHERE id = ?1", table.name()),
                params![id],
                |r| r.get(0),
            )
            .optional()?;
        Ok(data.and_then(|d| match serde_json::from_str(&d) {
            Ok(v) => Some(v),
            Err(e) => {
                crate::applog::warn(
                    "database",
                    format!("unreadable {} row {id}: {e}", table.name()),
                );
                None
            }
        }))
    }

    pub fn put<T: Serialize>(
        &self,
        table: Table,
        id: &str,
        sort: i64,
        value: &T,
    ) -> rusqlite::Result<()> {
        let data = serde_json::to_string(value).expect("wire types always serialize");
        self.conn.execute(
            &format!("INSERT INTO {} (id, sort, data) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET sort = ?2, data = ?3", table.name()),
            params![id, sort, data],
        )?;
        Ok(())
    }

    /// Writes several rows in one transaction.
    pub fn put_many<'a, T: Serialize + 'a>(
        &mut self,
        table: Table,
        rows: impl IntoIterator<Item = (&'a str, i64, &'a T)>,
    ) -> rusqlite::Result<()> {
        let tx = self.conn.transaction()?;
        {
            let mut stmt = tx.prepare(&format!(
                "INSERT INTO {} (id, sort, data) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET sort = ?2, data = ?3",
                table.name()
            ))?;
            for (id, sort, value) in rows {
                stmt.execute(params![
                    id,
                    sort,
                    serde_json::to_string(value).expect("wire types always serialize")
                ])?;
            }
        }
        tx.commit()
    }

    pub fn delete(&mut self, table: Table, ids: &[&str]) -> rusqlite::Result<()> {
        let tx = self.conn.transaction()?;
        {
            let mut stmt = tx.prepare(&format!("DELETE FROM {} WHERE id = ?1", table.name()))?;
            for id in ids {
                stmt.execute(params![id])?;
            }
        }
        tx.commit()
    }

    pub fn clear(&self, table: Table) -> rusqlite::Result<()> {
        self.conn
            .execute(&format!("DELETE FROM {}", table.name()), [])?;
        Ok(())
    }

    pub fn meta(&self, key: &str) -> rusqlite::Result<Option<String>> {
        self.conn
            .query_row("SELECT value FROM meta WHERE key = ?1", params![key], |r| {
                r.get(0)
            })
            .optional()
    }

    /// Writes a consistent copy of the whole database to `dest` (a new file) with `VACUUM INTO`, which reads one
    /// snapshot even while the live database is in WAL mode. Used by backups.
    pub fn backup_to(&self, dest: &Path) -> rusqlite::Result<()> {
        let dest = dest
            .to_str()
            .ok_or_else(|| rusqlite::Error::InvalidPath(dest.to_path_buf()))?;
        self.conn.execute("VACUUM INTO ?1", params![dest])?;
        Ok(())
    }

    pub fn set_meta(&self, key: &str, value: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, PartialEq, Serialize, Deserialize)]
    struct Row {
        id: String,
        n: u32,
    }

    #[test]
    fn rows_round_trip_in_sort_order_and_can_be_deleted() {
        let mut db = Db::in_memory().unwrap();
        db.put(
            Table::Boards,
            "b",
            2,
            &Row {
                id: "b".into(),
                n: 2,
            },
        )
        .unwrap();
        db.put(
            Table::Boards,
            "a",
            1,
            &Row {
                id: "a".into(),
                n: 1,
            },
        )
        .unwrap();
        db.put(
            Table::Boards,
            "a",
            1,
            &Row {
                id: "a".into(),
                n: 10,
            },
        )
        .unwrap();
        let rows: Vec<Row> = db.load(Table::Boards).unwrap();
        assert_eq!(
            rows,
            vec![
                Row {
                    id: "a".into(),
                    n: 10
                },
                Row {
                    id: "b".into(),
                    n: 2
                }
            ]
        );
        db.delete(Table::Boards, &["a"]).unwrap();
        assert_eq!(db.load::<Row>(Table::Boards).unwrap().len(), 1);
    }

    #[test]
    fn rows_load_in_the_order_sqlite_gives_for_sort_then_id() {
        let mut db = Db::in_memory().unwrap();
        // Equal sorts (ties broken by id, byte-wise: upper case, digits, multi-byte letters), negative and large sorts.
        let rows = [
            ("b", 5),
            ("a", 5),
            ("B", 5),
            ("10", 5),
            ("2", 5),
            ("é", 5),
            ("z", -3),
            ("y", i64::MAX),
            ("x", 0),
            ("aa", 5),
        ];
        let values: Vec<Row> = rows
            .iter()
            .map(|(id, n)| Row {
                id: id.to_string(),
                n: *n as u32,
            })
            .collect();
        db.put_many(
            Table::Images,
            rows.iter()
                .zip(&values)
                .map(|((id, sort), v)| (*id, *sort, v)),
        )
        .unwrap();
        let mut stmt = db
            .conn
            .prepare("SELECT id FROM images ORDER BY sort, id")
            .unwrap();
        let by_sqlite: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .map(Result::unwrap)
            .collect();
        let loaded: Vec<String> = db
            .load::<Row>(Table::Images)
            .unwrap()
            .into_iter()
            .map(|r| r.id)
            .collect();
        assert_eq!(loaded, by_sqlite);
        assert_eq!(loaded.first().map(String::as_str), Some("z"));
    }

    #[test]
    fn unreadable_rows_are_skipped() {
        let db = Db::in_memory().unwrap();
        db.conn
            .execute(
                "INSERT INTO queue (id, sort, data) VALUES ('x', 0, 'not json')",
                [],
            )
            .unwrap();
        assert!(db.load::<Row>(Table::Queue).unwrap().is_empty());
    }

    #[test]
    fn a_row_is_read_by_id_and_a_missing_or_broken_one_is_none() {
        let db = Db::in_memory().unwrap();
        let row = Row {
            id: "00000000002a".into(),
            n: 7,
        };
        assert_eq!(db.get::<Row>(Table::Watermarks, &row.id).unwrap(), None);
        db.put(Table::Watermarks, &row.id, 0, &row).unwrap();
        assert_eq!(
            db.get::<Row>(Table::Watermarks, &row.id).unwrap(),
            Some(row)
        );
        // Ids are bound, not pasted into the SQL.
        assert_eq!(
            db.get::<Row>(Table::Watermarks, "x' OR '1'='1").unwrap(),
            None
        );
        db.conn
            .execute(
                "INSERT INTO watermarks (id, sort, data) VALUES ('bad', 0, 'not json')",
                [],
            )
            .unwrap();
        assert_eq!(db.get::<Row>(Table::Watermarks, "bad").unwrap(), None);
    }

    #[test]
    fn meta_values_persist() {
        let db = Db::in_memory().unwrap();
        assert_eq!(db.meta("k").unwrap(), None);
        db.set_meta("k", "v").unwrap();
        assert_eq!(db.meta("k").unwrap().as_deref(), Some("v"));
    }
}
