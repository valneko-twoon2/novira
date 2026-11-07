// A subfolder (or the way back to its board) shown in the grid: the folder's latest picture, its name and its count.
// Opens on click and takes pictures dropped on it, like a row of the boards list.
import { ArrowUUpLeft, FolderSimple } from '@phosphor-icons/react';
import { useState, type DragEvent } from 'react';
import type { ImageDTO } from '@/backend';
import { hasDragImages, resolveDropImages } from '@/state/dnd';
import { useGallery, type BoardId } from '@/state/gallery';
import { cx } from '@/ui';
import { moveImagesToBoard, uploadFiles } from '../actions';

interface Props {
  /** Where the tile leads and where dropped pictures go. */
  boardId: BoardId;
  name: string;
  count?: number;
  cover?: ImageDTO | null;
  /** The way back to the board (a folder is open) rather than a subfolder. */
  up?: boolean;
  size: number;
}

export function FolderTile({ boardId, name, count, cover, up, size }: Props) {
  const [over, setOver] = useState(false);
  const onDragOver = (e: DragEvent) => {
    if (!hasDragImages(e.dataTransfer.types)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOver(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const files = [...e.dataTransfer.files];
    void resolveDropImages(e).then((names) => {
      if (names.length) void moveImagesToBoard(names, boardId);
      else if (files.length) {
        useGallery.getState().setAutoAddBoard(boardId);
        void uploadFiles(files);
      }
    });
  };
  return (
    <button
      type="button"
      className={cx('gfolder', up && 'is-up', over && 'is-over')}
      style={{ width: size, height: size }}
      title={name}
      data-testid={up ? 'gallery-folder-up' : 'gallery-folder'}
      data-board-id={boardId}
      onClick={() => useGallery.getState().selectBoard(boardId)}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={onDrop}
    >
      {cover ? <img src={cover.thumbnailUrl} alt="" draggable={false} loading="lazy" /> : <span className="gfolder__empty" />}
      <span className="gfolder__bar">
        {up ? <ArrowUUpLeft weight="bold" /> : <FolderSimple weight="fill" />}
        <span className="gfolder__name">{name}</span>
        {count !== undefined && <span className="gfolder__count">{count}</span>}
      </span>
    </button>
  );
}
