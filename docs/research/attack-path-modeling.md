# Attack-path modeling: research notes for the Train Ticket graph API

Researched 2026-10-19. Primary sources only, cited inline. **[unverified]** marks claims without a primary source.

Note: backslash.security now redirects most legacy pages to an AI-security homepage. Backslash's earlier AppSec pages were read through Wayback snapshots (`web.archive.org/web/2024id_/https://www.backslash.security/...`). The URLs below are the original ones.

---

## 1. Backslash Security's own concepts

- **Toxic code flows.** The CEO's launch post defines them as "unique combinations of undetected insecure code and/or configuration weaknesses, combined with 'toxic' conditions, that together increase risk dramatically". Its example: of "hundreds of potential SQL injections", teams should fix first the ones "in public-facing APIs, running in production, or that are part of a crown-jewel business app". (https://www.backslash.security/blog/disrupting-the-undisrupted-welcome-to-the-world-backslash)
  - The same post: "We also analyze microservices themselves - their interconnections and their exposure". This is the shape of our dataset.
- **Reachability vs. external reachability.** Reachability "determines whether application code is actively utilizing vulnerable code". On top of that, "Backslash examines the complete attack paths ... vulnerabilities accessible from the internet or local network". (https://www.backslash.security/backslash-reachability-analysis)
- **Source-to-sink.** Backslash "identifies exploitable external reachability ... prioritizing SAST vulnerabilities reachable from the internet. Leveraging source-to-sink flow analysis and application architecture context". It also says it prioritizes "based on finding the actual attack paths to reachable code". (https://www.backslash.security/backslash-vs-sca-sast)
- **Triggerability.** Defined as a vulnerability "practically accessible via user input ... HTTP requests, CLI commands, input variables". It is distinct from reachability, which only means the package is invoked. (https://www.backslash.security/blog/appsec-game-changer-1-triggerability-tm)
- **App Graph.** The App Graph finds triggerable vulns by "Mapping the application's data flow to uncover interaction points" and "Examining external inputs". (same URL) Business Process Impact "builds on our App Graph technology" to map vulns to business flows. (https://www.backslash.security/blog/appsec-game-changer-2-business-process-impact-view)
- **Soundness.** A Backslash blog says reachability "must clearly show the flow of adversary-controlled data or calls ... across all its layers and modules (inter-procedural and inter-package)". It names explainability as a criterion: "Explain how you found this". (https://www.backslash.security/blog/proving-reachability-static-analysis-vs-runtime-detection)
- **[unverified]** No public Backslash doc gives the App Graph's node/edge schema, its API, or a formal definition of "entry point" or "sink".

**What this means for the exercise:** public exposure (entry), a vulnerable node (weakness) and a DB (crown jewel / sink) are exactly the three "toxic" conditions Backslash names. Explainability argues for returning the concrete path, not only a yes/no.

## 2. Cloud security graphs and attack paths

### Microsoft Defender for Cloud / Exposure Management
- **Attack path definition.** It "starts at an external entry point, such as an internet-exposed vulnerable resource", "follows available lateral movement", and "continues until the attacker reaches a critical target, such as databases containing sensitive data". (https://learn.microsoft.com/en-us/azure/defender-for-cloud/concept-attack-path)
- **Algorithm.** It "scans each customer's unique cloud security graph for exploitable entry points. If an entry point is found, the algorithm searches for potential next steps ... to reach critical assets". This is a forward search from entry points. (same)
- **Cloud security graph.** It holds assets, "connections, lateral movement possibilities, internet exposure, permissions, network connections, vulnerabilities". Cloud security explorer runs "graph-based path-finding queries" on it. (same)
- **Explorer UI.** Pick a resource type, add filters with "+", and add "subfilters". Query templates and shareable query links are available. (https://learn.microsoft.com/en-us/azure/defender-for-cloud/how-to-manage-cloud-security-explorer)
- **Attack Path Map roles.** The map highlights "Vulnerable nodes", "Entry points", "Target assets" and "Choke points" ("nodes where multiple attack paths converge"). The list filters on risk level, asset type, remediation status and time frame. (https://learn.microsoft.com/en-us/azure/defender-for-cloud/how-to-manage-attack-path)
- **Exposure graph schema.** The graph is two tables, `ExposureGraphNodes` (`NodeId`, `NodeLabel`, `NodeName`, `Categories`, `NodeProperties`, `EntityIds`) and `ExposureGraphEdges` (`SourceNodeId`, `TargetNodeId`, `EdgeLabel`, `SourceNodeLabel`, `TargetNodeLabel`). (https://learn.microsoft.com/en-us/security-exposure-management/query-enterprise-exposure-graph)
  - A bounded variable-length path query looks like this. Start and end predicates are separate `where` clauses:
    `graph-match (IP)-[anyEdge*1..3]->(VM) where set_has_element(IP.Categories,"ip_address") and set_has_element(VM.Categories,"virtual_machine")`
  - Node predicates are property checks, e.g. `NodeProperties.rawData.exposedToInternet`, `vulnerableToRCE`, `containsSensitiveData`.
  - The docs advise pre-filtering nodes and edges before `make-graph`.
- **[unverified]** The "cloud security graph components list" (`attack-path-reference`) now redirects, so the full list of insight and edge types could not be read.

### Wiz
- **Toxic combination.** Wiz describes it as separate risk factors (network exposure, unprotected data, excessive permissions) that combine. Its example is a "sensitive customer database reachable from a internet-exposed virtual machine that has a critical vulnerability". (https://www.wiz.io/blog/the-anatomy-of-a-toxic-combination-of-risk)
  - A Critical Wiz Issue means high likelihood of compromise plus significant business impact. (same)
  - The Security Graph is "the database, data model, and analysis layer, not just a visualization" (WebFetch summary of the same post).
- **Storage.** The graph is stored in Amazon Neptune. Wiz describes risk engines that "traverse the graph" to connect risk factors. Example: "externally exposed, unpatched VMs" holding SSH keys that allow lateral movement. (https://aws.amazon.com/blogs/database/the-world-is-a-graph-how-wiz-reimagines-cloud-security-using-a-graph-in-amazon-neptune/)
- **[unverified]** Wiz's public sources do not document its node/edge schema or query language (Gremlin vs. openCypher). Customer docs require login.

### Orca
- **Attack path definition.** "The automatic identification of risk combinations that create dangerous attack paths" toward "crown jewels" (PII, secrets, IP, financial data). Crown jewels are auto-detected or tagged by the user. (https://orca.security/resources/blog/cloud-attack-path-analysis/)
- **Scoring and filtering.** Each path gets a 0–99 score from severity, accessibility (internet-facing entry), lateral movement, and business impact. Attack vectors carry tags "for easy identification and filtering", including MITRE categories. (same)

### AWS Security Hub
- **Exposure findings.** They correlate "vulnerabilities, configurations, threats, and resource relationships". Contributing traits include vulnerabilities, misconfigurations, network exposure, permissions, and "Resource criticality". (https://docs.aws.amazon.com/securityhub/latest/userguide/exposure-findings.html)
- **Attack path graph.** It shows the primary resource, the network path, and the downstream "blast radius". "Each node represents a resource, and the connections between nodes show the permissions that enable an attacker to move". Findings with a reachability trait "show the public internet" as the start. (https://docs.aws.amazon.com/securityhub/latest/userguide/potential-attack-path-graph.html)
- **One finding per resource.** "A resource can be the primary resource in, at most, one exposure finding". The finding is anchored on a resource, not on a path. (exposure-findings URL above)

### BloodHound (SpecterOps)
- **Edge direction.** "The direction of the edge ... always indicates the direction of attack or privilege". Each edge type's schema lists valid sources and targets and "specifies whether the edge is traversable". (https://bloodhound.specterops.io/resources/edges/overview)
- **Path queries.** BloodHound uses openCypher:
  - Shortest paths: `match p = shortestPath((u:User)-[*..]->(:Domain)) ... return p`, and likewise `allShortestPaths`.
  - Bounded hops: `[r:MemberOf*2..4]`.
  - The crown-jewel set is a label: "Tier Zero membership is represented with the `Tag_Tier_Zero` label".
  - (https://bloodhound.specterops.io/analyze-data/explore/cypher-supported)
- **Cost warnings.** `allShortestPaths` "could result in higher resource consumption". Hop ranges like `*1..3` restrict path length. Results render in a graph view. (https://bloodhound.specterops.io/analyze-data/explore/cypher-search)
- **OpenGraph ingest format.** The format is `{graph:{nodes:[{id,kinds[],properties}], edges:[{kind,start:{value,match_by},end:{value,match_by}}]}}`. Properties must be primitives or arrays of primitives. (https://bloodhound.specterops.io/opengraph/schema, https://bloodhound.specterops.io/opengraph/developer/edges)

**Common pattern across vendors:** a typed property graph. Entry-point predicates (internet exposed), weakness predicates (vuln or misconfig on a node), and target predicates (sensitive data, crown jewel, tier zero) are node properties or labels. A path is a directed walk from an entry node to a target node, and the path is the unit that gets returned and rendered.

## 3. Code-level analogue: source → sink taint

- **CodeQL configuration.** `isSource` "defines where data may flow from". `isSink` "defines where data may flow to". `isBarrier` "defines where data flow is blocked". `isAdditionalFlowStep` "adds additional flow steps". Taint tracking extends data flow with "non-value-preserving flow steps". (https://codeql.github.com/docs/codeql-language-guides/analyzing-data-flow-in-java/)
- **CodeQL path queries.** `@kind path-problem` queries expose an `edges(PathNode a, PathNode b)` query predicate and an optional `nodes`. The result is `select element, source, sink, message`, so each alert carries its path. (https://codeql.github.com/docs/writing-codeql-queries/creating-path-queries/)
- **Semgrep taint mode.** Rules use `pattern-sources` (required), `pattern-sinks`, `pattern-sanitizers`, and `pattern-propagators` (Pro; each has `from`/`to`). (https://docs.semgrep.dev/writing-rules/data-flow/taint-mode/overview)
  - **[unverified, partial]** Release notes say sinks can have taint-label `requires` expressions (boolean over labels). The full syntax was not confirmed. (https://docs.semgrep.dev/release-notes/march-2023)
- **Mapping to this task.**
  - Start filter = `isSource`.
  - End filter = `isSink`.
  - "Contains vulnerable node" = a waypoint predicate. CodeQL has no direct equivalent; it is closest to requiring a flow state.
  - A future "exclude node" filter = `isBarrier`.

## 4. Graph query and API patterns

- **Variable-length paths in Cypher.** Quantified path patterns look like `((:Stop)-[:NEXT]->(:Stop)){1,3}` and `-[:NEXT]->{1,10}`. Unbounded patterns can match "very large numbers of paths, resulting in a slow query performance". Use finite upper bounds and inline predicates. (https://neo4j.com/docs/cypher-manual/current/patterns/variable-length-patterns/)
  - By default Cypher "does not allow relationships to be re-traversed in the same graph pattern match". (https://neo4j.com/docs/cypher-manual/current/patterns/match-modes/)
  - `SHORTEST k`, `ALL SHORTEST` and `ANY` (a reachability test) replace `shortestPath()` and `allShortestPaths()`. (https://neo4j.com/docs/cypher-manual/current/patterns/shortest-paths/)
- **Gremlin.** `repeat(out()).times(n)` loops. `simplePath()` filters any traverser whose "path has repeated objects", which is cycle-safe. `path()` returns the walk but "Path calculation is costly in terms of space". GraphSON is the JSON serialization meant for non-JVM consumers. (https://tinkerpop.apache.org/docs/current/reference/)
- **Render-ready JSON for Cytoscape.js.** Cytoscape accepts either a flat array or `{nodes:[...], edges:[...]}`. Each element has `data.id`, and edges also have `data.source` and `data.target`. Optional `classes` drive styling, e.g. `public`, `sink`, `vulnerable`. (https://js.cytoscape.org/#notation/elements-json)
- **Path explosion levers**, as used by the sources above:
  - hop bounds (`*1..3`, `{1,3}`)
  - shortest-only (`SHORTEST`, `shortestPath`)
  - reachability-only (`ANY`)
  - pre-filtering nodes and edges (MS exposure graph)
  - `LIMIT`/`SKIP` paging (BloodHound)
  - returning a merged subgraph or "choke points" instead of every path (Defender)

## 5. Dataset facts (computed locally from `data/train-ticket-be.json`)

- **Size.** 46 nodes (44 `service`, 1 `rds` = `prod-postgresdb`, 1 `sqs` = `prod-sqs`) and 27 edge records expanding to 98 directed edges.
- **Edge `to` shape.** It is usually an array but a plain string once (`consign-service -> consign-price-service`). Normalize it on load.
- **Dangling reference.** `assurance-service` is referenced in edges but is not a defined node. Decide whether to create a placeholder node (BloodHound OpenGraph creates placeholders for unmatched nodes, per a SpecterOps blog; [unverified] in the docs) or to drop the edge and warn.
- **No cycles (DAG).** Even so, use visited-set or simple-path semantics.
  - 18 root nodes.
  - 222 maximal root-to-leaf paths.
  - 440 simple paths overall.
  - Full enumeration is cheap here, but it would not scale.
- **Public nodes are `frontend` and `gateway-service`.** `gateway-service` has no outgoing edges. `frontend` reaches only `admin-basic-info-service` and its children.
- **Consequence: the three filters ANDed together, on directed edges, return an empty result for this data.** The README should state this. Tests should cover each filter alone and in pairs. One option is a documented assumption, e.g. treating the gateway as fronting all services, but the safer default is to report empty honestly.
- **Vulnerable nodes are `auth-service` and `order-service`.** Both connect directly to `prod-postgresdb`. All 30 root-to-rds paths contain a vulnerable node.
- **Vulnerability metadata is inconsistent.** E.g. a SQL-injection message is tagged CWE-22. Don't derive logic from the CWE field.

## Takeaways for this task

1. **Route definition.**
   - A route is a directed simple path (no repeated node) `n0 → … → nk` over `edges`.
   - Make the enumeration semantics explicit, e.g. "all simple paths, `maxDepth` default N", and note shortest-only as an option.
   - This matches the start/traverse/target model used by Defender ("entry point → lateral movement → critical target"), Backslash ("public-facing ... crown-jewel") and AWS (internet → primary resource → blast radius).
2. **Three predicate positions.** Express filters as predicates over nodes, attached to a position:
   - `start` (source / entry point): `publicExposed == true`
   - `end` (sink / target): `kind ∈ {rds, sqs?}`
   - `any` (waypoint / weakness): `vulnerabilities.length > 0`
   - Add `none` / barrier later.

   This mirrors CodeQL `isSource` / `isSink` / `isBarrier`, and Defender's entry / target / vulnerable node roles.
3. **Filter registry.**
   - Each filter has a name, a position and a predicate `(node) => boolean`, e.g. `{ name: "publicStart", position: "start", test: n => n.publicExposed === true }`.
   - A new filter is a one-line registry entry.
   - Combine filters by AND by default, as Defender ANDs filter rows and KQL ANDs `where` clauses.
   - Optionally accept a small boolean tree (`{and:[...]}` / `{or:[...]}`) for OR. Keep it JSON so it works in a POST body or in repeated query params (`?filter=publicStart&filter=endsInSink`).
4. **What counts as a sink.**
   - The task says "rds/sql". Industry targets are "databases containing sensitive data" (Defender), "sensitive customer database" (Wiz), and PII/secrets/financial data (Orca).
   - Make the sink kinds configurable. Default to `rds`, and offer `sqs` as an opt-in or second filter (queues are data-exfil / injection targets, but the spec doesn't name them).
   - Also treat storage (s3, etc.) as a sink when such node kinds appear. **[unverified]**: no source names queues as sinks in the attack-path sense.
5. **Do the search in one pass.**
   - Run DFS from the nodes matching `start`, or from all nodes if there is no start filter.
   - Prune by `maxDepth`.
   - Check `end` at the terminal node and `any` over the whole path.
   - Rationale: Defender searches forward from entry points, and Microsoft's docs recommend pre-filtering nodes before matching.
   - Guard against explosion with `maxDepth`, `limit`, and an optional `mode=shortest|all`. Include a truncation flag in the response.
6. **Response shape** (render-ready and explainable):
   ```json
   {
     "nodes": [{ "id": "order-service", "kind": "service", "publicExposed": false, "vulnerabilities": [...], "classes": ["vulnerable"] }],
     "edges": [{ "id": "order-service->prod-postgresdb", "source": "order-service", "target": "prod-postgresdb" }],
     "routes": [{ "nodes": ["user-service", "auth-service", "prod-postgresdb"] }],
     "meta": { "filters": ["endsInSink", "hasVulnerability"], "routeCount": 30, "truncated": false }
   }
   ```
   - `nodes` + `edges` are the union subgraph of matching routes. They map 1:1 to Cytoscape `{data:{id}}` / `{data:{id,source,target}}`.
   - `routes` keeps each path explicit. This follows CodeQL `edges`+`select source,sink` and Backslash's "explain how you found this".
   - Optional `format=cytoscape` wraps the elements in `data`.
7. **Extensibility notes for the README.**
   - Node predicates are pure functions over node properties, and new node kinds and properties flow through untouched (as in BloodHound OpenGraph's open `properties`).
   - Edge predicates (edge kind / traversable) are a natural next step. BloodHound marks edge types as traversable.
   - Choke points (nodes shared by many matching routes) are a cheap derived insight, as in Defender's Attack Path Map.
8. **Data-quality decisions to document:**
   - string-or-array `to`
   - the dangling `assurance-service` reference
   - the empty result when all three filters are ANDed
   - mislabeled CWE metadata
