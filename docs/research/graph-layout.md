# Graph layout: research notes for the Service graph map

Researched 2026-10-19. Primary sources only, cited inline. **[unverified]** marks claims without a primary source. Measurements come from scripts run outside the repo (scratchpad) on `data/train-ticket-be.json`; repo source was not modified.

---

## 1. The problem, with evidence

Complaint: "all items are static and not adjusted/spread around the viewport for better navigation".

Code facts (read from `apps/web/src/lib/toFlowGraph.ts` and `organisms/GraphCanvas.tsx`):
- One dagre layout (`rankdir: 'TB'`, `nodesep: 16`, `ranksep: 80`, fixed 180x60 nodes), cached per graph object in a `WeakMap`. It covers every node, even when `matchedOnly` hides most of them, so hidden nodes leave holes and the visible ones are never re-packed.
- `nodesDraggable={false}`: the user cannot move anything. `fitView` with `padding: 0.05` runs once, at mount. Nothing re-fits when `matchedOnly` toggles or the canvas resizes. `minZoom` is 0.1.
- The layout has no knowledge of the viewport. Layout shape (aspect ratio) is whatever dagre produces.

Data facts (measured): 47 nodes (46 declared + 1 Inferred Node), 98 edges, 18 Entries, 20 leaves (kinds: 44 service, 1 rds, 1 sqs). Highest degrees: `preserve-service` 12, `preserve-other-service` 12, `order-service` 11.

Layout measurements (dagre 3.1.1 and elkjs 0.11.0, 180x60 nodes). "Node px" is the on-screen node width after `fitView` (padding 0.05) in a 1000x700 canvas:

| Layout | Bounding box | Aspect (w/h) | Node px |
|---|---|---|---|
| dagre TB (current) | 4868 x 760 | 6.41 | 34 (name font about 2.6px) |
| dagre TB `tight-tree` | 4878 x 760 | 6.42 | about 34 |
| dagre TB `longest-path` | 6222 x 760 | 8.19 | worse |
| dagre LR | 1480 x 2326 | 0.64 | about 49 |
| ELK layered DOWN | 4286 x 1144 | 3.75 | about 38 |
| ELK layered RIGHT | 2804 x 1804 | 1.55 | about 58 |
| ELK stress | 2632 x 1921 | 1.37 | about 60 |
| ELK force | 5277 x 4090 | 1.29 | smaller (sparse) |
| d3-force (300 ticks, collide 110) | 4105 x 3031 | 1.35 | about 44 |

Diagnosis: the graph is shallow (6 layers) and wide (many Entries and leaves per layer), so layered TB gives a strip with aspect 6.4. A 16:10 canvas then fits it at about 0.19x: node names render at about 2.6px and cannot be read. This is a layout-shape problem plus a no-interaction problem, not a node-count problem. Dagre's own LR option swaps the strip for a tall column (0.64) and helps only modestly. A layered layout in the RIGHT direction (ELK) or a stress layout gets near the canvas aspect and roughly 1.7x larger nodes.

Observed quirk: setting `elk.aspectRatio=1.6` and `elk.layered.wrapping.strategy` (SINGLE_EDGE/MULTI_EDGE) on the root, with direction DOWN, did not change the result at all in this run (4286x1144 each time). I did not investigate why. Do not rely on them without a test **[unverified, empirical]**.

---

## 2. What React Flow itself says

- **Layout is external.** The layouting overview lists dagre, d3-hierarchy, d3-force and elkjs. React Flow does not lay out nodes for you. (https://reactflow.dev/learn/layouting/layouting)
  - Dagre: "If you need to organize your flows into a tree, we highly recommend dagre." Dynamic node sizes supported; sub-flows only partly (open issue when sub-flow nodes link outside the sub-flow); no edge routing.
  - d3-hierarchy: single-root trees only, same size for all nodes. Not applicable to our multi-Entry DAG.
  - d3-force: "a force-directed layout might be the way to go" for more than a tree. Iterative, so "computing the force layout every render forever is going to incur a big performance hit". The page ships a custom rectangular collision force, since d3's built-in one assumes circles.
  - elkjs: "certainly the most configurable option available, but it's also the most complicated". Supports dynamic sizes, sub-flows and edge routing. The layout runs asynchronously and needs its own hook, and the team "doesn't often recommend it" because support is hard.
- **ELK and force examples** are linked from the overview. The ELK page shows only the data and links to the ELK option reference (https://reactflow.dev/examples/layout/elkjs). The force-layout and expand/collapse examples are Pro-only under the xyflow Pro License (https://reactflow.dev/examples/layout/force-layout, https://reactflow.dev/examples/layout/expand-collapse). The expand/collapse Pro example uses dagre, keeps the full graph in memory and renders only the visible part, and recalculates layout on change. The idea (dagre on the visible subset) needs no Pro code.
- **`useNodesInitialized`** returns a boolean: false when a node is added, true once it is measured; always false for an empty array; option `includeHiddenNodes` defaults to false. (https://reactflow.dev/api-reference/hooks/use-nodes-initialized) It matters only for layouts that need measured sizes. Our nodes are a fixed 180x60 and are given `width`/`height`, so it is not needed.
- **`fitView` prop** zooms to fit "all the nodes initially provided"; it applies only to the initial view. Re-fitting after a relayout needs an explicit `fitView()` call from `useReactFlow`. Top-level `minZoom` default is 0.5 (we override to 0.1). (https://reactflow.dev/api-reference/react-flow)
- **Dragging and bounds.** `nodesDraggable` is global, and a node's own `draggable` overrides it. `nodeExtent` sets a boundary for node positions; it is not needed for a precomputed layout. `nodeDragThreshold` defaults to 1, so clicks do not trigger drags (same URL). Dragging only works if the node positions live in state we update from `onNodesChange` (`position` changes); today `toFlowGraph` rebuilds nodes from the cached layout each render, so a drag would snap back.
- **Keyboard a11y.** `nodesFocusable` (Tab to cycle, Enter to select), `disableKeyboardA11y` (default false; arrow keys move selected nodes), `autoPanOnNodeFocus` (default true). (same URL.) Arrow-key node moves only matter once nodes are draggable. Layout changes do not break Tab/Enter selection. `autoPanOnNodeFocus` helps when the view is zoomed in.
- **MiniMap.** SVG overview with a viewport mask; `pannable` and `zoomable` default to false; `nodeColor` accepts a function; accessible name via `ariaLabel` (default "Mini Map"; the docs say to provide one). (https://reactflow.dev/api-reference/components/minimap) Good for orientation at 47 nodes, and it can reuse the severity/highlight colors.
- **Sub-flows.** `parentId` positions children relative to the parent; `extent: 'parent'` keeps them inside; parents must come before children in the array. (https://reactflow.dev/learn/layouting/sub-flows) The page says nothing about layout libraries for grouping.

---

## 3. Layout libraries

### dagre (current, `@dagrejs/dagre` 3.1.1)
- Graph options: `rankdir` (TB/BT/LR/RL, default TB), `align` (UL/UR/DL/DR, default undefined), `ranker` (`network-simplex` default, `tight-tree`, `longest-path`), `nodesep` (default 50), `ranksep` (default 50). (https://github.com/dagrejs/dagre/wiki)
- No option for aspect ratio or wrapping. In our data `ranker` changes did not fix the strip (table above). Only `rankdir` changes the shape.
- Synchronous, deterministic **[unverified in docs; observed: same output across runs]**. ESM build is about 48 KB (about 17 KB gzipped), already in the bundle (measured from `dist/dagre.esm.js`).

### elkjs (Eclipse Layout Kernel)
- Algorithms: layered, force, stress, radial, mrtree, disco. (https://eclipse.dev/elk/reference/algorithms.html)
- `elk.aspectRatio`: "the quotient of width by height"; applies to parent nodes; default not stated on the page. (https://eclipse.dev/elk/reference/options/org-eclipse-elk-aspectRatio.html) See the quirk in section 1.
- `elk.layered.wrapping.strategy`: values `OFF` (default), `SINGLE_EDGE`, `MULTI_EDGE`; splits the layout into side-by-side sections joined by wrapped edges; applies to parents. (https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-wrapping-strategy.html)
- `elk.layered.considerModelOrder.strategy`: keeps node/edge input order if it adds no crossings; values `NONE` (default), `NODES_AND_EDGES`, `PREFER_EDGES`, `PREFER_NODES`. (https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-considerModelOrder-strategy.html) Useful for stable layouts when the input order is stable.
- elkjs API: `layout()` returns a Promise; Web Workers supported out of the box via `workerUrl` with `elk-api.js`; `elk.bundled.js` is the no-worker build; options use `elk.`-prefixed names; without the `web-worker` package in Node it falls back to non-worker. (https://github.com/kieler/elkjs)
- Size (measured, elkjs 0.11.0): `elk.bundled.js` 1.6 MB raw, about 475 KB gzipped; `elk-worker.min.js` 1.6 MB. That is about 28x dagre gzipped. Layout of our 47 nodes took 65 to 300 ms in Node (includes JIT warmup).
- Tests: the async API means jsdom tests must await layout (or use the non-worker bundle). Output for identical input and options is deterministic **[unverified]**.

### d3-force
- Deterministic by design: fixed-seed LCG random source; initial positions in a phyllotaxis arrangement. The page does not guarantee whole-simulation determinism. (https://d3js.org/d3-force/simulation)
- Static use: `.stop()` then `.tick(300)` runs synchronously (default ticks 300). "For large graphs, static layouts should be computed in a web worker." (same URL)
- Needs a collision force for 180x60 rectangles (built-in is circular, per React Flow's overview). Result in our data: aspect 1.35 but 4105x3031 with overlaps depending on tuning; hierarchy (Entries to Sinks) is lost, which hurts the "top-down Route" reading in the spec (`.scratch/service-graph-explorer/spec.md`, "laid out top-down").
- Adds `d3-force` (small, no new category of risk) **[size unverified]**.

### WebCola
- "JavaScript constraint based layout"; images show groups and alignment constraints. (https://github.com/tgdwyer/WebCola) Releases section empty and no maintenance statement on the page; maintenance status **[unverified]**. Not recommended: not on React Flow's list.

---

## 4. Graph-theory options (layout independent)

- **Relayout the visible subset only.** When `matchedOnly` is on, run the layout on matched nodes and edges. Fewer nodes means a smaller, denser result and larger zoom. This is what the Pro expand/collapse example does with dagre (keep full graph, lay out the visible part). Cost: nodes move when the Query changes, which can disorient; mitigate by animating or keeping the full layout when `matchedOnly` is off.
- **Subgraph focus.** Show the neighborhood of a selected node or Route (nodes within k hops on the Routes) and dim the rest. Reuses `passesThrough` ("show Routes through here", story 10). Not measured.
- **Cluster/compound grouping.** Would need a domain attribute (e.g. ticket, order, travel, station). Nodes have `name`, `kind`, `language`, `path`; `path` is `train-ticket/ts-<name>-service`, so there is no group field. A domain grouping would be a guessed naming heuristic **[unverified]**; do not build it. ELK supports hierarchy and React Flow supports `parentId`, but dagre handles clusters poorly with external edges (React Flow overview above).
- **Collapse/expand.** Entries (18) and leaves (20) are 38 of 47 nodes. Collapsing leaf-only services into their callers would shrink the graph, but it changes what "Route" shows; out of scope under YAGNI.

---

## 5. Compatibility with existing features

| Feature | Dagre sync (subset/direction) | ELK async | d3-force |
|---|---|---|---|
| jsdom + MSW tests | Works as now | Needs `await` or non-worker; slower tests | Works (sync `tick`), tuning-sensitive |
| Highlighted Routes / dimming | Style-only, unaffected | Same | Same |
| `matchedOnly` hiding | Relayout on visible nodes | Same, but async flicker | Same |
| Selection / Tab+Enter | Unaffected | Unaffected | Unaffected |
| Bundle | +0 KB | +475 KB gz | small **[unverified]** |
| Determinism | Yes (observed) | Likely **[unverified]** | Yes (LCG, phyllotaxis) |

---

## 6. Recommendation (ranked, minimal diff)

1. **Make nodes draggable and keep positions in UI state, add MiniMap.** Directly answers "static". Add the dragged-position map to the single zustand store (short-lived UI state); `toFlowGraph` takes it as an input and overrides `position`; `onNodesChange` forwards `position` changes (`dragging: true`). Re-layout resets it. `<MiniMap pannable zoomable ariaLabel="Service graph overview" />` in `GraphCanvas`. No new deps. Tests: one `ExplorerPage` test with the existing React Flow stubs.
2. **Pick the layout direction to fit the viewport.** Compute dagre in both TB and LR (cheap, sync), choose the one whose aspect ratio is closest to the canvas (measure the canvas via `useReactFlow`/ResizeObserver; keep the chooser a pure lib function `pickDirection(boxes, viewport)` and test it directly). In our data: TB 6.41 vs LR 0.64 gives 34px vs about 49px nodes at 1000x700; modest but free. Keep the per-graph `WeakMap` cache, keyed by direction and node set.
3. **Relayout only visible nodes when `matchedOnly` is on, and refit.** Pass the matched node ids into the layout function; cache by (graph, direction, visible-set key). Call `fitView({ padding: 0.05, duration: 200 })` from an effect keyed on that cache key (the `fitView` prop is initial-only). Fixes holes and gives bigger nodes for small result sets.
4. **Only if 1-3 still read too small: ELK layered RIGHT (about 58px) or stress (about 60px) behind a lazy `import('elkjs/lib/elk.bundled.js')`.** The gain over dagre LR is about 18 percent in node size for +475 KB gz and async tests; not justified by this data. Skip d3-force (loses top-down hierarchy), WebCola, clusters and collapse.

Architecture fit: layout and direction chooser are pure functions in `lib/` (no store, no hooks); the zustand store gets only the dragged-position map; `GraphCanvas` (organism) wires the store, `useReactFlow` and `MiniMap`; atoms/molecules untouched. `pnpm verify` stays green with no new dependency for items 1-3.
