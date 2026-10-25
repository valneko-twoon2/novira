// Pending "delete images" request; confirmed in DeleteImagesModal unless confirmation is turned off.
import { create } from 'zustand';
import { useSettings } from '@/state/settings';
import { deleteImagesNow } from './actions';

interface DeleteRequestState {
  pending: string[] | null;
  close: () => void;
}

export const useDeleteRequest = create<DeleteRequestState>()((set) => ({
  pending: null,
  close: () => set({ pending: null }),
}));

export function requestDeleteImages(names: string[]) {
  if (!names.length) return;
  if (!useSettings.getState().confirmOnDelete) {
    void deleteImagesNow(names);
    return;
  }
  useDeleteRequest.setState({ pending: names });
}
