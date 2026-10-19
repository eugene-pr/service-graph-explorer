import { create } from 'zustand';

/** Short-lived UI state only: never server data or the Query. The app's single store. */
interface UiState {
  /** Id of the node shown in the details panel; a node's id is its name. */
  selectedNode: string | undefined;
  selectNode: (name: string | undefined) => void;
  hoveredRoute: string | undefined;
  hoverRoute: (key: string | undefined) => void;
  selectedRoute: string | undefined;
  selectRoute: (key: string) => void;
  clearRouteHighlight: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  selectedNode: undefined,
  selectNode: (selectedNode) => set({ selectedNode }),
  hoveredRoute: undefined,
  hoverRoute: (hoveredRoute) => set({ hoveredRoute }),
  selectedRoute: undefined,
  selectRoute: (selectedRoute) => set({ selectedRoute, hoveredRoute: undefined }),
  clearRouteHighlight: () => set({ selectedRoute: undefined, hoveredRoute: undefined }),
}));
