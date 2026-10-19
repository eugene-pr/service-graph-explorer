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
  /** Positions of nodes the user dragged, by node name; they outlive Query changes until a relayout. */
  nodePositions: Record<string, { x: number; y: number }>;
  moveNode: (name: string, position: { x: number; y: number }) => void;
  /** A relayout replaces every position, dragged ones included. */
  clearNodePositions: () => void;
  /** Changes on every reset, even if the Query is already the default: the map refits and the Query panel remounts. */
  resetVersion: number;
  resetMap: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  selectedNode: undefined,
  selectNode: (selectedNode) => set({ selectedNode }),
  hoveredRoute: undefined,
  hoverRoute: (hoveredRoute) => set({ hoveredRoute }),
  selectedRoute: undefined,
  selectRoute: (selectedRoute) => set({ selectedRoute, hoveredRoute: undefined }),
  clearRouteHighlight: () => set({ selectedRoute: undefined, hoveredRoute: undefined }),
  nodePositions: {},
  moveNode: (name, position) => set((s) => ({ nodePositions: { ...s.nodePositions, [name]: position } })),
  clearNodePositions: () => set({ nodePositions: {} }),
  resetVersion: 0,
  resetMap: () => set((s) => ({
    selectedNode: undefined,
    selectedRoute: undefined,
    hoveredRoute: undefined,
    nodePositions: {},
    resetVersion: s.resetVersion + 1,
  })),
}));
