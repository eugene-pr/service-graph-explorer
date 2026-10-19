# Train Ticket Service Graph

A query engine over a graph of Train Ticket microservices and their dependencies, used to find risky routes between services.

## Language

**Route**:
A simple path (no repeated nodes) of at least one edge, starting at any node and ending at a node with no outgoing edges. Filters only select among Routes; they never change which Routes exist.
_Avoid_: Path, flow, chain

**Entry**:
A node with no incoming edges. When a Query has no start-position Filter, the default view shows only Routes that start at an Entry.
_Avoid_: Source, root, origin

**Sink**:
A node where data comes to rest or leaves the system, such as a database or queue. By default this means any node that is not a service (in this data, `rds` and `sqs`), and the set of sink kinds can be configured.
_Avoid_: Datastore, DB, target

**Inferred Node**:
A node that edges point to but that is missing from the source data. It is assumed to be a service and is flagged as inferred.
_Avoid_: Placeholder, ghost node

**Filter**:
A named, optionally parameterized condition that a Route either satisfies or doesn't (e.g. starts at a public service, ends at a Sink, passes through a vulnerable node).
_Avoid_: Rule, predicate, criterion

**Filter Catalog**:
The list of available Filters, each with its name, description and parameters. Adding a Filter to the catalog makes it available to the API and the UI.
_Avoid_: Filter registry, filter list

**Query**:
A combination of Filters using `and`, `or` and `not`. A plain list of Filters means all of them must hold.
_Avoid_: Search, expression
