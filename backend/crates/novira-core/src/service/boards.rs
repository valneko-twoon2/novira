//! Boards.
use super::*;

/// How many levels boards can nest, a top board being the first. Windows paths limit how deep a board's folder can go.
/// `frontend/src/backend/boardNesting.ts` holds the same number for its menu (a test compares them).
pub const MAX_BOARD_DEPTH: usize = 8;

/// The level of a board, a top board being 1. Stops at a loop, which no call can make.
fn board_level(boards: &[BoardDTO], id: &str) -> usize {
    let mut level = 1;
    let mut current = boards.iter().find(|b| b.id == id);
    while let Some(parent) = current
        .and_then(|b| b.parent_id.as_deref())
        .and_then(|p| boards.iter().find(|b| b.id == p))
    {
        level += 1;
        if level > boards.len() {
            break;
        }
        current = Some(parent);
    }
    level
}

/// The ids of a board and of everything inside it, however deep; empty when there is no such board.
fn with_descendants(boards: &[BoardDTO], id: &str) -> Vec<String> {
    if !boards.iter().any(|b| b.id == id) {
        return Vec::new();
    }
    let mut out = vec![id.to_string()];
    let mut at = 0;
    while at < out.len() {
        for b in boards {
            if b.parent_id.as_deref() == Some(out[at].as_str()) && !out.contains(&b.id) {
                out.push(b.id.clone());
            }
        }
        at += 1;
    }
    out
}

impl Backend {
    pub fn create_board(&self, name: &str) -> Result<BoardDTO> {
        self.create_board_in(name, None)
    }

    /// Creates a board, or a subfolder of `parent_id` (up to `MAX_BOARD_DEPTH` levels).
    pub fn create_board_in(&self, name: &str, parent_id: Option<String>) -> Result<BoardDTO> {
        let name = board_name(name)?;
        if let Some(parent) = &parent_id {
            let s = self.state();
            match s.boards.iter().find(|b| &b.id == parent) {
                None => {
                    return Err(BackendError::NotFound(format!("board not found: {parent}")));
                }
                Some(b) if board_level(&s.boards, &b.id) >= MAX_BOARD_DEPTH => {
                    return Err(BackendError::Invalid(format!(
                        "Boards cannot nest more than {MAX_BOARD_DEPTH} levels"
                    )));
                }
                Some(_) => {}
            }
        }
        let board = BoardDTO {
            id: new_id("board"),
            name,
            archived: false,
            created_at: now(),
            parent_id,
        };
        self.db()
            .put(Table::Boards, &board.id, board.created_at, &board)?;
        self.state().boards.push(board.clone());
        self.emit_boards();
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
        self.emit_boards();
        // The board's folder follows its name (and so may another board's that shared it).
        self.arrange_files(None);
        Ok(board)
    }

    pub fn delete_board(&self, id: &str, delete_images: bool) -> Result<Vec<String>> {
        let mut s = self.state();
        // A board takes everything inside it with it.
        let gone_boards = with_descendants(&s.boards, id);
        s.boards.retain(|b| !gone_boards.contains(&b.id));
        let mut deleted = Vec::new();
        let mut moved = Vec::new();
        for img in s
            .images
            .iter_mut()
            .filter(|i| i.board_id.as_ref().is_some_and(|b| gone_boards.contains(b)))
        {
            if delete_images {
                deleted.push(img.name.clone());
            } else {
                img.board_id = None;
                moved.push(img.clone());
            }
        }
        let gone = super::gallery::Picked::new(&deleted);
        let trashed: Vec<ImageDTO> = s
            .images
            .iter()
            .filter(|i| gone.contains(&i.name))
            .cloned()
            .collect();
        s.images.retain(|i| !gone.contains(&i.name));
        drop(s);
        let mut db = self.db();
        let gone_ids: Vec<&str> = gone_boards.iter().map(String::as_str).collect();
        db.delete(Table::Boards, &gone_ids)?;
        db.put_many(
            Table::Images,
            moved.iter().map(|i| (i.name.as_str(), i.created_at, i)),
        )?;
        drop(db);
        self.emit_boards();
        // The pictures of the board wait in the trash like any deleted picture.
        let trashing = self.move_to_trash(&trashed);
        self.emit_images(moved, &deleted);
        trashing?;
        self.arrange_files(None);
        Ok(deleted)
    }

    /// Tells every page the boards as they are now.
    pub(super) fn emit_boards(&self) {
        let boards = self.state().boards.clone();
        self.emit(BackendEvent::BoardsChanged { boards });
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
