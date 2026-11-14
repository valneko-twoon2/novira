// A card centred over an empty drawing area (the Canvas and Text screens): a bold title with the explanation under it.
// It lets pointer events through, so the area under it can still be drawn on and clicked.
export function EmptyOverlay({ title, description, 'data-testid': testId }: { title: string; description: string; 'data-testid'?: string }) {
  return (
    <div className="ui-empty-overlay" data-testid={testId}>
      <div className="ui-empty-overlay__title">{title}</div>
      <div className="ui-empty-overlay__desc">{description}</div>
    </div>
  );
}
