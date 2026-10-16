# Counter hash, pairwise networks and pair statistics

A port (GPU compute shader, GDScript, another language) can be written from this page and checked against `fixtures/graph.json`. The Rust code in `rust/counter.rs`, `rust/network.rs` and `rust/pairstats.rs` is the reference. Every operation here uses unsigned integer arithmetic.

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
below(unit, total) = (unit * total) >> 24          # a plain unsigned 64-bit product; total must be < 2^40
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

`violations(labels)` counts the edges `(i, j)` with `i < j` for which `tables[r][a][b]` or `tables[r'][b][a]` is zero, where `r` is the relation of `i`'s edge to `j`, `r'` that of `j`'s edge to `i`. `sample` treats zero as forbidden: a node whose candidates all have weight zero keeps its current label, so a sample can finish with violations. Use `solve` for hard constraints.

## Pair statistics

`PairStats(L)` counts, per relation, how often label `a` was next to label `b`, and how often each label was seen. `observe_graph(edges, labels)` counts every node and every directed edge once.

```
table(relation):  T = total count, R[a] = row sum, C[b] = column sum
  weight(a, b) = 33                                    if R[a] == 0 or C[b] == 0
  weight(a, b) = 1 + min(254, floor(32 * count(a,b) * T / (R[a] * C[b])))     otherwise
support_table(relation): 1 where count > 0, otherwise 0
unary_weights: 1 + floor(254 * count[l] / max(1, max count))      # the maximum is over all L labels
```

Integer division throughout. A relation with no observations gives 33 everywhere. A single count may not exceed 2^32, and a table is exact while a sum stays under 2^53.

## Fixtures

`fixtures/graph.json` holds counter words and units, networks with sampling and solving runs (solved and refused), and pair statistics tables. Regenerate with `cargo run --offline --example graph_fixtures`; the replay is `tests/graph_replay.rs`, and `scripts/smoke-bindings.*` replay the same file through wasm and Python.
