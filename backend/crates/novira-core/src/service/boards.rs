//! Boards.
use super::*;

impl Backend {
    pub fn create_board(&self, name: &str) -> Result<BoardDTO> {
        let name = board_name(name)?;
        let board = BoardDTO {
            id: new_id("board"),
            name,
            archived: false,
            created_at: now(),
        };
        self.db()
            .put(Table::Boards, &board.id, board.created_at, &board)?;
        self.state().boards.push(board.clone());
        Ok(board)
    }

    pub fn update_board(&self, id: &str, patch: BoardPatch) -> Result<BoardDTO> {
        // Validate before touching anything so a blank rename changes nothing.
        let name = patch.name.as_deref().map(board_name).transpose()?;
        let mut s = self.state();
        let board = s
            .boards
            .iter_mut()
            .find(|b| b.id == id)
            .ok_or_else(|| BackendError::NotFound(format!("board not found: {id}")))?;
        if let Some(name) = name {
            board.name = name;
        }
        if let Some(a) = patch.archived {
            board.archived = a;
        }
        let board = board.clone();
        drop(s);
        self.db()
            .put(Table::Boards, &board.id, board.created_at, &board)?;
        Ok(board)
    }

    pub fn delete_board(&self, id: &str, delete_images: bool) -> Result<Vec<String>> {
        let mut s = self.state();
        s.boards.retain(|b| b.id != id);
        let mut deleted = Vec::new();
        let mut moved = Vec::new();
        for img in s
            .images
            .iter_mut()
            .filter(|i| i.board_id.as_deref() == Some(id))
        {
            if delete_images {
                deleted.push(img.name.clone());
            } else {
                img.board_id = None;
                moved.push(img.clone());
            }
        }
        let gone = super::gallery::Picked::new(&deleted);
        s.images.retain(|i| !gone.contains(&i.name));
        drop(s);
        let mut db = self.db();
        db.delete(Table::Boards, &[id])?;
        db.delete(
            Table::Images,
            &deleted.iter().map(String::as_str).collect::<Vec<_>>(),
        )?;
        db.put_many(
            Table::Images,
            moved.iter().map(|i| (i.name.as_str(), i.created_at, i)),
        )?;
        drop(db);
        for name in &deleted {
            self.inner.files.delete(name);
        }
        Ok(deleted)
    }
}

/// A board name as stored: trimmed, and never blank.
fn board_name(name: &str) -> Result<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(BackendError::Invalid("Board name is empty".into()));
    }
    Ok(name.to_owned())
}
