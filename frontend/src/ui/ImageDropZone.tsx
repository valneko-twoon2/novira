// Drop target that accepts gallery images (drag from the gallery or a canvas layer) or files from the OS.
import { useEffect, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { isImageDrag, resolveDropImages } from '@/state/dnd';
import { cx } from './controls';

export function ImageDropZone({
  onImages,
  onFiles,
  label,
  children,
  className,
  style,
  disabled,
}: {
  /** Names of gallery images dropped here (`alt`: Alt was held at the drop). */
  onImages: (names: string[], drop: { alt: boolean }) => void;
  onFiles?: (files: File[], drop: { alt: boolean }) => void;
  /** Text shown in the overlay while dragging over. */
  label: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Inline style of the drop target, for a drop target placed by its box (a panel of a page). */
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  // A drop on a zone inside this one (a popover's own drop zone) stops here, and a drag cancelled elsewhere never leaves it, so the
  // overlay would stay up: while it shows, any drop or end of a drag anywhere on the page puts it away.
  useEffect(() => {
    if (!over) return;
    const clear = () => setOver(false);
    // No pointer or key event is delivered while a drag is under way, so one that arrives means the drag is over, however it ended
    // (a drop or a leave the page was never told about). A move of no distance is the browser's own, after a change of layout.
    const moved = (e: PointerEvent) => {
      if (e.movementX || e.movementY) setOver(false);
    };
    window.addEventListener('drop', clear, true);
    window.addEventListener('dragend', clear, true);
    window.addEventListener('pointerdown', clear, true);
    window.addEventListener('keydown', clear, true);
    window.addEventListener('pointermove', moved, true);
    return () => {
      window.removeEventListener('drop', clear, true);
      window.removeEventListener('dragend', clear, true);
      window.removeEventListener('pointerdown', clear, true);
      window.removeEventListener('keydown', clear, true);
      window.removeEventListener('pointermove', moved, true);
    };
  }, [over]);
  const onDragOver = (e: DragEvent) => {
    if (disabled || !isImageDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setOver(true);
  };
  const onDrop = (e: DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const drop = { alt: !!e.altKey };
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    void resolveDropImages(e).then((names) => {
      if (names.length) onImages(names, drop);
      else if (files.length && onFiles) onFiles(files, drop);
    });
  };
  return (
    <div
      className={cx('ui-dropzone', over && 'is-over', className)}
      style={style}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={onDrop}
    >
      {children}
      {over && <div className="ui-dropzone__overlay">{label}</div>}
    </div>
  );
}
