// Seed: random / fixed segmented switch, number box and a re-roll button (the row is shared with the media screens).
import { SeedControl } from '@/features/media/SeedControl';
import { newRandomSeed, useParams } from '@/state/params';

export function SeedRow() {
  const seed = useParams((s) => s.seed);
  const random = useParams((s) => s.shouldRandomizeSeed);
  const set = useParams((s) => s.set);
  return <SeedControl seed={seed} random={random} onSeed={(v) => set({ seed: v })} onRandom={(v) => set({ shouldRandomizeSeed: v })} onShuffle={newRandomSeed} />;
}
