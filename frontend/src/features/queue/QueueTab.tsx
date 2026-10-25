// Queue tab: processor controls and counts, the running item, and the full queue list.
import { CurrentItemCard } from './CurrentItemCard';
import { QueueControls } from './QueueControls';
import { QueueList } from './QueueList';
import { QueueStatusCards } from './QueueStatusCards';
import './queue.css';

export function QueueTab(_props: { tab?: unknown }) {
  return (
    <div className="qt" data-testid="queue-tab">
      <div className="qt__top">
        <div className="panel qt__summary">
          <QueueControls />
          <QueueStatusCards />
        </div>
        <div className="panel qt__current">
          <CurrentItemCard />
        </div>
      </div>
      <div className="panel qt__list">
        <QueueList />
      </div>
    </div>
  );
}
