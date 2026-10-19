import { create } from 'zustand';

/** Short-lived UI state only: never server data or the Query. The app's single store. */
interface UiState {
  /** Id of the node shown in the details panel; a node's id is its name. */
  selectedNode: string | undefined;
  selectNode: (name: string | undefined) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  selectedNode: undefined,
  selectNode: (selectedNode) => set({ selectedNode }),
}));
