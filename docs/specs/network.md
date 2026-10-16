# Counter hash, pairwise networks and pair statistics

A port (GPU compute shader, GDScript, another language) can be written from this page and checked against `fixtures/graph.json`. The Rust code in `rust/counter.rs`, `rust/network.rs` and `rust/pairstats.rs` is the reference. Every operation here uses unsigned integer arithmetic, except that pair counts are held as doubles (exact below 2^53).

## Counter hash

`Counter` has no state. Its word depends only on `(seed, keys)`.

```
mix(x):                       # 32-bit, all operations wrap
  x ^= x >> 16
  x *= 0x7feb352d
  x ^= x >> 15
  x *= 0x846ca68b
  x ^= x >> 16
  return x

word(seed, keys):
  h = mix(seed ^ 0x9e3779b9)
  for key in keys:
    h = mix(h ^ key) + 0x9e3779b9      # wrapping add
  return h

unit(seed, keys)  = word(seed, keys) >> 8          # 24 bits, fraction unit / 2^24
below(unit, total) = (unit * total) >> 24          # a plain unsigned 64-bit product; total must be < 2^40 (renormalised totals can exceed it by at most the label count). The 24-bit unit is the resolution: a label whose share of the total is below 2^-24 can never be drawn.
```

## Network

A network has `labels` L (at most 4096), `nodes` N, and these data:

* `edges[node]`: list of `(to, relation)`. Every edge has a reverse edge, and the reverse edge's table is the transpose.
* `tables[relation]`: `L * L` weights. `tables[r][a * L + b]` is the weight of this node holding `a` while the neighbour holds `b`. Zero forbids the pair.
* `unary[node]`: `(label, weight)` in strictly ascending label order. Zero weights are dropped. These are the node's candidate labels.

All weights are unsigned 32-bit integers.

### Colouring

Node `i` takes the smallest colour that no neighbour with a lower index holds. Nodes of one colour share no edge.

### Weights of a node given a labelling

```
w[label] = unary weight                       # 64-bit
for edge in edges[node], in listed order:
  for each candidate: w[label] *= tables[edge.relation][label * L + labelling[edge.to]]
  shift_down(w, 32)
shift_down_total(w, 40)

shift_down(w, bits):                          # largest weight must have <= bits bits
  m = max(w); length = bit length of m
  if length > bits: s = length - bits; for each w > 0: w = max(1, w >> s)

shift_down_total(w, bits):                    # total must have <= bits bits
  same, with length taken from sum(w)
```

A weight below `2^32` times a table entry below `2^32` fits in 64 bits.

### Draw from weights

```
total  = sum(w)                               # 0 -> no draw
target = below(unit, total)
walk candidates in ascending label order, add weights; first label whose running sum > target
```

### `sample(seed, gibbs, icm)`

```
round 0: each node draws from its unary weights alone (after shift_down_total(w, 40)), unit = unit(seed, [node, 0, 0]);
         a node with no candidates makes the whole sample fail
rounds 1 .. gibbs + icm (at most 100000 in all):
  for colour in 0 .. colour_count - 1:
    for every node of that colour (any order, updates applied after the colour is done):
      w = weights(node, current labelling)
      if total(w) == 0: keep the label
      elif round <= gibbs: draw with unit(seed, [node, round, 0])
      else: take the heaviest label; ties are the tied labels in ascending order,
            index below(unit(seed, [node, round, 1]), tied_count)
```

### `solve(seed, max_decisions, max_backtracks)`

The search treats every table entry above zero as allowed.

```
domain[node] = the unary labels
arc consistency: a label b of node j survives only if, for every edge (j -> i, r),
  some label a in domain[i] has tables[r][b * L + a] > 0.
  Queue discipline: FIFO of nodes with a queued flag, so a node already waiting is not added again;
  revising a node that lost labels enqueues its neighbours in edge order; a contradiction empties the queue.
start: a node with no candidates -> refuse "unsatisfiable" naming the lowest-index such node.
       Otherwise every node is enqueued in index order and propagated; contradiction -> refuse "unsatisfiable".

loop:
  pick the node with more than one label and the smallest domain; ties by smaller word(seed, [node, 0, 2]), then smaller index.
  none left -> solved: each domain holds one label.
  if decisions == max_decisions -> refuse "decision-limit".
  serial = decisions; decisions += 1
  weights = unary weights of the node's remaining labels
  shift_down_total(weights, 40), then draw with unit(seed, [node, serial, 1])    # same draw rule as above
  remove the other labels, enqueue the node and its neighbours, propagate.
  on contradiction:
    repeat: backtracks += 1; if backtracks > max_backtracks -> refuse "backtrack-limit"
            undo to the decision's mark, remove its label from the node's domain,
            propagate if the domain is non-empty; success -> go on; otherwise pop the previous decision and repeat.
            stack empty -> refuse "unsatisfiable".
```

A refusal reports the reason, the node whose domain emptied last (or none), the decisions and the backtracks.

## Violations

`violations(labels)` counts the edges `(i, j)` with `i < j` for which `tables[r][a][b]` is zero, where `r` is the relation of `i`'s edge to `j`, `a` the label of `i` and `b` the label of `j`. (The reverse edge's table is the transpose, so one direction decides.) `sample` treats zero as forbidden: a node whose candidates all have weight zero keeps its current label, so a sample can finish with violations. Use `repair` to mend them locally, or `solve` for hard constraints over the whole network.

## Repair

`repair(labels, seed, budget)` mends the violations of a labelling locally. It frees a neighbourhood around one cluster of violations at a time, pins the nodes just outside it to their current labels, and solves the neighbourhood with the `solve` search. Nodes outside the solved neighbourhoods keep their labels.

`budget` is `max_radius` (1 to 16), `max_decisions` and `max_backtracks` (the limits of each neighbourhood search) and `max_rounds` (at most 100000). A budget out of range, a labelling whose length is not the node count, or a label that is not one of its node's candidates (a unary label with non-zero weight) is an invalid-parameter error. Everything else returns an outcome.

```
state = labels
bad = the violating edges (i, j), i < j, as in `violations`
rounds = decisions = backtracks = 0
loop:
  bad empty -> repaired
  v0 = the smallest i over bad (the lowest node that has a violating edge)
  rounds == max_rounds -> refuse "round-limit"
  layer[0] = cluster: the nodes reached from v0 over violating edges (under state)
  layer[d] = the nodes at hop distance exactly d from the cluster over all edges
  for radius in 1 ..= max_radius:
    if radius > 1 and layer[radius] is empty: stop growing      # the component is already free
    free     = layer[0] .. layer[radius]
    boundary = layer[radius + 1]                               # pinned
    order    = free + boundary, ascending node id; a node's local index is its position in order
    edges:  for each node in order, its edges in listed order, keeping an edge (node -> to)
            when `to` is in order and at least one of node, to is free
    unary:  a free node keeps its candidates and weights; a boundary node has the single
            candidate (state[node], its unary weight)
    run the `solve` search on this subproblem with
      counter = Counter(word(seed, [0x52455041, v0, radius]))
      budget  = (max_decisions, max_backtracks)
      every hash that `solve` keys on a node index, word(.., [node, 0, 2]) and
      unit(.., [node, serial, 1]), uses the node's id in the whole network instead
    decisions += its decisions; backtracks += its backtracks          # failed searches count too
    solved -> state[node] = its label for every free node; drop from bad every edge
              touching a free node; rounds += 1; next loop iteration
  no radius solved -> refuse "unrepairable"
```

A refusal names `v0` as `node`, reports `remaining` (the number of edges in `bad`) and returns `state` as repaired so far. Both outcomes report `rounds`, `decisions`, `backtracks` (sums, saturating at `2^32 - 1`) and `changed`, the number of nodes whose label differs from the input.

The subproblem keeps no edge between two pinned nodes, because neither label can change. Arc consistency leaves each pinned node its own label only when that label supports every free neighbour, so a solved subproblem satisfies every edge that touches a free node. Every edge of the cluster lies between free nodes, and edges between locked nodes do not change. A round therefore removes the cluster's violations and adds none, and an edge that is satisfied stays satisfied. There are at most as many rounds as violating edges in the input, and `v0` increases from round to round.

The subproblem's numbering is ascending node id and every hash reads the node id, so the result does not depend on how the subproblem is numbered. The radius a cluster needs depends on the constraints. On a 12 by 12 grid with three labels that must differ, some clusters left by `sample` need radius 6, because the labels pinned around a smaller region leave no colouring of its inside.

## Pair statistics

`PairStats(L)` counts, per relation, how often label `a` was next to label `b`, and how often each label was seen. `observe_graph(edges, labels)` counts every node and every directed edge once.

```
table(relation):  T = total count, R[a] = row sum, C[b] = column sum
  weight(a, b) = 33                                    if R[a] == 0 or C[b] == 0
  weight(a, b) = 1 + min(254, floor(32 * count(a,b) * T / (R[a] * C[b])))     otherwise
support_table(relation): 1 where count > 0, otherwise 0
unary_weights: 1 + floor(254 * count[l] / max(1, max count))      # the maximum is over all L labels
```

Integer division throughout. A relation with no observations gives 33 everywhere. A single count must be below 2^32 (2^32 itself is refused), and a table is exact while a sum stays under 2^53.

## Fixtures

`fixtures/graph.json` holds counter words and units, networks with sampling, solving runs (solved and refused) and repair runs (repaired and refused; each records its starting labelling), and pair statistics tables. Regenerate with `cargo run --offline --example graph_fixtures`; the replay is `tests/graph_replay.rs`, and `scripts/smoke-bindings.*` replay the same file through wasm and Python.

## Notes a porter needs

* **Validation `Network::new` enforces.** At most 4096 labels and at most 2^31 - 1 nodes; one unary list per node, with labels below `labels` in strictly ascending order (weights of zero are dropped); one table per relation an edge uses, each with `labels * labels` entries; no self edge and no repeated neighbour in a node's list; every edge has a reverse edge, and the two relations' tables are transposes of each other. `violations(labels)` also needs one label per node, each below `labels`, and refuses otherwise.
* **Key allocation.** Draws use these key shapes under one seed: sampling `[node, round, 0]` and ICM tie-breaks `[node, round, 1]`; `solve` value draws `[id, serial, 0]` and decision tie-breaks `[id, serial, 1]`; `repair` seeds a fresh counter per neighbourhood from `word(seed, [0x52455041, v0, radius])`. The shapes coincide across `sample` and `solve` on one seed, so the draws are correlated; callers that use both on the same network give each a different seed.
* **Cost.** `solve` scans every undecided node on each decision and hashes each tie, so a solve is quadratic in the node count (a 128 by 128 grid with four labels takes about one second, 192 by 192 about seven). `repair` solves only neighbourhoods and does not pay this on the whole network. `sample` does `rounds * nodes` work, and the 100000-round cap is not a work cap.
