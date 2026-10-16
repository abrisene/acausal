//! A pairwise network: a graph of nodes that each hold one label, with
//! per-node label weights and per-edge pair tables.
//!
//! The model is plain data. Two solvers read it:
//!
//! * [`Network::sample`] runs a graph-colouring Gibbs/ICM sweep. Every draw
//!   comes from a [`Counter`] keyed by `(node, round, purpose)`, so the result
//!   does not depend on the order nodes of one colour are visited.
//! * [`Network::solve`] treats every pair-table entry of zero as forbidden and
//!   searches for a labelling with arc consistency and bounded backtracking. It
//!   refuses with a reason when the budget runs out.
//!
//! All weights are unsigned 32-bit integers. Products are renormalised with
//! integer shifts, so a port that follows `docs/specs/network.md` reproduces
//! every label.

use crate::Error;
use crate::counter::{Counter, pick_below};
use std::collections::BTreeSet;

/// Largest label count a network or table may have. A pair table holds
/// `labels * labels` weights, so this bounds memory at 64 MiB per table.
pub const MAX_LABELS: u32 = 4096;

/// Largest `gibbs + icm` a sample may run.
pub const MAX_ROUNDS: u32 = 100_000;

/// A directed half of a graph edge. `relation` selects the pair table read for
/// `(label of this node, label of `to`)`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Edge {
    pub to: u32,
    pub relation: u32,
}

/// `weights[a * labels + b]` is the weight of this node holding `a` while the
/// neighbour holds `b`. Zero forbids the pair.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PairTable {
    labels: u32,
    weights: Vec<u32>,
}

impl PairTable {
    pub fn new(labels: u32, weights: Vec<u32>) -> Result<Self, Error> {
        if labels > MAX_LABELS {
            return Err(bad("too many labels for a pair table"));
        }
        let expected = (labels as usize)
            .checked_mul(labels as usize)
            .ok_or_else(|| bad("pair table is too large"))?;
        if weights.len() != expected {
            return Err(bad("pair table must hold labels * labels weights"));
        }
        Ok(Self { labels, weights })
    }

    /// A table that gives every pair the same weight.
    pub fn uniform(labels: u32, weight: u32) -> Self {
        Self {
            labels,
            weights: vec![weight; labels as usize * labels as usize],
        }
    }

    pub fn labels(&self) -> u32 {
        self.labels
    }

    pub fn weights(&self) -> &[u32] {
        &self.weights
    }

    #[inline]
    pub fn get(&self, a: u32, b: u32) -> u32 {
        self.weights[a as usize * self.labels as usize + b as usize]
    }
}

/// Sweep counts for [`Network::sample`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Schedule {
    /// Rounds that draw from the conditional distribution.
    pub gibbs: u32,
    /// Rounds after those that take the heaviest label (ICM).
    pub icm: u32,
}

/// Limits for [`Network::solve`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Budget {
    pub max_decisions: u32,
    pub max_backtracks: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RefusalReason {
    /// Some node has no label left and there is no decision to undo.
    Unsatisfiable,
    BacktrackLimit,
    DecisionLimit,
}

impl RefusalReason {
    pub fn name(self) -> &'static str {
        match self {
            Self::Unsatisfiable => "unsatisfiable",
            Self::BacktrackLimit => "backtrack-limit",
            Self::DecisionLimit => "decision-limit",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct SolveStats {
    pub decisions: u32,
    pub backtracks: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Outcome {
    Solved {
        labels: Vec<u32>,
        stats: SolveStats,
    },
    Refused {
        reason: RefusalReason,
        /// The node whose domain emptied last.
        node: Option<u32>,
        stats: SolveStats,
    },
}

/// Largest neighbourhood radius [`Network::repair`] may grow to.
pub const MAX_REPAIR_RADIUS: u32 = 16;

/// Largest number of rounds [`Network::repair`] may run.
pub const MAX_REPAIR_ROUNDS: u32 = 100_000;

/// First key of the counter word that seeds each repair search ("REPA").
const REPAIR_KEY: u32 = 0x5245_5041;

/// Limits for [`Network::repair`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RepairBudget {
    /// Largest hop distance from a cluster of violations that is freed, `1..=16`.
    pub max_radius: u32,
    /// Decision limit of each neighbourhood search.
    pub max_decisions: u32,
    /// Backtrack limit of each neighbourhood search.
    pub max_backtracks: u32,
    /// Largest number of repaired clusters, at most 100000.
    pub max_rounds: u32,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct RepairStats {
    /// Clusters repaired.
    pub rounds: u32,
    /// Decisions summed over every neighbourhood search, failed ones included.
    pub decisions: u32,
    /// Backtracks summed over every neighbourhood search, failed ones included.
    pub backtracks: u32,
    /// Nodes whose label differs from the input labelling.
    pub changed: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RepairRefusal {
    /// No neighbourhood up to `max_radius` could be solved.
    Unrepairable,
    /// Violations remain after `max_rounds` rounds.
    RoundLimit,
}

impl RepairRefusal {
    pub fn name(self) -> &'static str {
        match self {
            Self::Unrepairable => "unrepairable",
            Self::RoundLimit => "round-limit",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RepairOutcome {
    Repaired {
        labels: Vec<u32>,
        stats: RepairStats,
    },
    Refused {
        reason: RepairRefusal,
        /// The lowest node that still has a violating edge.
        node: u32,
        /// Violating edges left.
        remaining: usize,
        /// The labelling as far as it was repaired.
        labels: Vec<u32>,
        stats: RepairStats,
    },
}

#[derive(Clone, Debug)]
pub struct Network {
    labels: u32,
    edges: Vec<Vec<Edge>>,
    tables: Vec<PairTable>,
    unary: Vec<Vec<(u32, u32)>>,
    colours: Vec<u32>,
    colour_count: u32,
}

fn bad(message: &str) -> Error {
    Error::InvalidModel(message.to_owned())
}

impl Network {
    /// Build and validate a network.
    ///
    /// * `unary[node]` lists `(label, weight)` in strictly ascending label
    ///   order. Zero weights are dropped.
    /// * Every edge needs a reverse edge, and the reverse edge's table must be
    ///   the transpose of the forward one.
    pub fn new(
        labels: u32,
        edges: Vec<Vec<Edge>>,
        tables: Vec<PairTable>,
        unary: Vec<Vec<(u32, u32)>>,
    ) -> Result<Self, Error> {
        let n = edges.len();
        if labels > MAX_LABELS {
            return Err(bad("too many labels"));
        }
        if unary.len() != n {
            return Err(bad("unary must have one entry per node"));
        }
        if n > u32::MAX as usize / 2 {
            return Err(bad("too many nodes"));
        }
        for table in &tables {
            if table.labels != labels {
                return Err(bad("every pair table must have the network's label count"));
            }
        }
        let mut cleaned = Vec::with_capacity(n);
        for (node, list) in unary.into_iter().enumerate() {
            let mut previous: Option<u32> = None;
            let mut kept = Vec::with_capacity(list.len());
            for (label, weight) in list {
                if label >= labels {
                    return Err(bad(&format!("node {node} has label {label} out of range")));
                }
                if previous.is_some_and(|p| p >= label) {
                    return Err(bad("unary labels must be strictly ascending"));
                }
                previous = Some(label);
                if weight > 0 {
                    kept.push((label, weight));
                }
            }
            cleaned.push(kept);
        }
        let mut pairs = BTreeSet::new();
        for (node, list) in edges.iter().enumerate() {
            let mut seen = BTreeSet::new();
            for edge in list {
                let to = edge.to as usize;
                if to >= n || to == node {
                    return Err(bad(&format!("node {node} has an invalid neighbour")));
                }
                if edge.relation as usize >= tables.len() {
                    return Err(bad("edge relation has no pair table"));
                }
                if !seen.insert(edge.to) {
                    return Err(bad(&format!("node {node} lists a neighbour twice")));
                }
                let reverse = edges[to]
                    .iter()
                    .find(|back| back.to as usize == node)
                    .ok_or_else(|| bad(&format!("edge {node}->{to} has no reverse edge")))?;
                pairs.insert((edge.relation, reverse.relation));
            }
        }
        for (forward, back) in pairs {
            let f = &tables[forward as usize];
            let b = &tables[back as usize];
            for x in 0..labels {
                for y in 0..labels {
                    if f.get(x, y) != b.get(y, x) {
                        return Err(bad(&format!(
                            "relations {forward} and {back} are not transposes"
                        )));
                    }
                }
            }
        }
        let mut colours = vec![0u32; n];
        let mut colour_count = 0;
        for node in 0..n {
            let mut used = BTreeSet::new();
            for edge in &edges[node] {
                if (edge.to as usize) < node {
                    used.insert(colours[edge.to as usize]);
                }
            }
            let mut colour = 0;
            while used.contains(&colour) {
                colour += 1;
            }
            colours[node] = colour;
            colour_count = colour_count.max(colour + 1);
        }
        Ok(Self {
            labels,
            edges,
            tables,
            unary: cleaned,
            colours,
            colour_count,
        })
    }

    pub fn nodes(&self) -> usize {
        self.edges.len()
    }

    pub fn labels(&self) -> u32 {
        self.labels
    }

    /// Greedy colour of each node: the smallest colour no lower-numbered
    /// neighbour holds. Nodes of one colour share no edge.
    pub fn colours(&self) -> &[u32] {
        &self.colours
    }

    /// Weights of each candidate label of `node` given the current labelling.
    fn conditional(&self, node: usize, state: Option<&[u32]>) -> Vec<(u32, u64)> {
        let mut weights: Vec<(u32, u64)> = self.unary[node]
            .iter()
            .map(|&(label, weight)| (label, weight as u64))
            .collect();
        if let Some(state) = state {
            for edge in &self.edges[node] {
                let table = &self.tables[edge.relation as usize];
                let other = state[edge.to as usize];
                for entry in weights.iter_mut() {
                    entry.1 *= table.get(entry.0, other) as u64;
                }
                shift_down(&mut weights, 32);
            }
        }
        shift_down_total(&mut weights, 40);
        weights
    }

    /// Draw every label from the unary weights, then run `schedule.gibbs`
    /// sampling rounds and `schedule.icm` greedy rounds.
    ///
    /// Round 0 is the initial draw. Rounds `1..=gibbs` draw, rounds after that
    /// take the heaviest label. In every round the colours are visited in
    /// ascending order and each node uses the labels its neighbours hold at
    /// that moment. A node whose weights are all zero keeps its label.
    pub fn sample(&self, counter: &Counter, schedule: Schedule) -> Result<Vec<u32>, Error> {
        self.sample_ordered(counter, schedule, false, false)
    }

    /// `sample` with the visiting order made explicit, so a test can show that
    /// the result does not depend on it: `reverse` visits each colour's nodes
    /// from the highest index, and `immediate` applies each update at once
    /// instead of after the whole colour. Nodes of one colour share no edge,
    /// so every combination gives the same labelling.
    fn sample_ordered(
        &self,
        counter: &Counter,
        schedule: Schedule,
        reverse: bool,
        immediate: bool,
    ) -> Result<Vec<u32>, Error> {
        let rounds = schedule.gibbs.saturating_add(schedule.icm);
        if rounds > MAX_ROUNDS {
            return Err(Error::InvalidParameter(format!(
                "gibbs + icm may not exceed {MAX_ROUNDS}"
            )));
        }
        let n = self.nodes();
        let mut state = vec![0u32; n];
        for (node, slot) in state.iter_mut().enumerate() {
            if self.unary[node].is_empty() {
                return Err(Error::EmptySupport);
            }
            let weights = self.conditional(node, None);
            *slot = draw(&weights, counter.unit(&[node as u32, 0, 0])).expect("non-empty");
        }
        let order: Vec<usize> = if reverse {
            (0..n).rev().collect()
        } else {
            (0..n).collect()
        };
        for round in 1..=rounds {
            let greedy = round > schedule.gibbs;
            for colour in 0..self.colour_count {
                // Nodes of one colour are independent, so this loop may run in
                // any order or in parallel; updates are staged then applied.
                let mut updates = Vec::new();
                for &node in &order {
                    if self.colours[node] != colour {
                        continue;
                    }
                    let weights = self.conditional(node, Some(&state));
                    let chosen = if greedy {
                        heaviest(&weights, counter.unit(&[node as u32, round, 1]))
                    } else {
                        draw(&weights, counter.unit(&[node as u32, round, 0]))
                    };
                    if let Some(label) = chosen {
                        if immediate {
                            state[node] = label;
                        } else {
                            updates.push((node, label));
                        }
                    }
                }
                for (node, label) in updates {
                    state[node] = label;
                }
            }
        }
        Ok(state)
    }

    /// The number of edges (each counted once) whose pair weight is zero under
    /// `labels`. The reverse edge's table is the transpose, so one direction
    /// decides. `sample` treats a zero as forbidden but
    /// may leave a node stuck on a label every candidate of which conflicts, so
    /// a caller that needs hard constraints reads this, or uses `solve`.
    pub fn violations(&self, labels: &[u32]) -> usize {
        let mut count = 0;
        for (node, list) in self.edges.iter().enumerate() {
            for edge in list {
                if (edge.to as usize) > node {
                    let table = &self.tables[edge.relation as usize];
                    let (a, b) = (labels[node], labels[edge.to as usize]);
                    if table.get(a, b) == 0 {
                        count += 1;
                    }
                }
            }
        }
        count
    }

    /// Search for a labelling where every edge's pair weight is non-zero.
    pub fn solve(&self, counter: &Counter, budget: Budget) -> Outcome {
        let rows = support_rows(self.labels, &self.tables);
        let problem = Problem {
            labels: self.labels,
            edges: &self.edges,
            unary: &self.unary,
            ids: None,
        };
        Search::new(problem, &rows, counter, budget).run()
    }

    /// Repair the violations of `labels` locally.
    ///
    /// Each round takes the lowest node with a violating edge and its cluster
    /// (the nodes reached from it over violating edges), frees every node
    /// within `radius` hops of the cluster, pins the nodes just outside to
    /// their current labels, and solves that region with the `solve` search.
    /// The radius grows from 1 until a region is solved. Nodes outside the
    /// solved regions keep their labels.
    ///
    /// `Err` only for invalid input: a labelling of the wrong length, a label
    /// that is not one of the node's candidates, or a budget out of range.
    pub fn repair(
        &self,
        labels: &[u32],
        counter: &Counter,
        budget: RepairBudget,
    ) -> Result<RepairOutcome, Error> {
        if !(1..=MAX_REPAIR_RADIUS).contains(&budget.max_radius) {
            return Err(Error::InvalidParameter(format!(
                "max_radius must be in 1..={MAX_REPAIR_RADIUS}"
            )));
        }
        if budget.max_rounds > MAX_REPAIR_ROUNDS {
            return Err(Error::InvalidParameter(format!(
                "max_rounds may not exceed {MAX_REPAIR_ROUNDS}"
            )));
        }
        let n = self.nodes();
        if labels.len() != n {
            return Err(Error::InvalidParameter(
                "repair needs one label per node".to_owned(),
            ));
        }
        for (node, &label) in labels.iter().enumerate() {
            if self.unary_weight(node, label).is_none() {
                return Err(Error::InvalidParameter(format!(
                    "label {label} is not a candidate of node {node}"
                )));
            }
        }
        let mut state = labels.to_vec();
        let mut stats = RepairStats::default();
        // Violating edges as (lower node, higher node), in ascending order.
        let mut bad: BTreeSet<(u32, u32)> = BTreeSet::new();
        for (node, list) in self.edges.iter().enumerate() {
            for edge in list {
                if edge.to as usize > node && self.violates(&state, node, edge) {
                    bad.insert((node as u32, edge.to));
                }
            }
        }
        let mut rows: Option<Vec<Vec<u64>>> = None;
        // Scratch indexed by node, reset after each use: hop distance from the
        // cluster (u32::MAX = unreached), and index in the current region.
        let mut dist = vec![u32::MAX; n];
        let mut local = vec![u32::MAX; n];
        loop {
            let Some(&(v0, _)) = bad.first() else {
                stats.changed = changed(labels, &state);
                return Ok(RepairOutcome::Repaired {
                    labels: state,
                    stats,
                });
            };
            if stats.rounds == budget.max_rounds {
                return Ok(self.repair_refused(
                    RepairRefusal::RoundLimit,
                    v0,
                    bad.len(),
                    labels,
                    state,
                    stats,
                ));
            }
            let rows = rows.get_or_insert_with(|| support_rows(self.labels, &self.tables));
            // layers[d] holds the nodes at hop distance d from the cluster,
            // each in ascending order. Layer 0 is the cluster.
            let mut layers: Vec<Vec<u32>> = vec![self.cluster(&state, v0, &mut dist)];
            let mut solved = false;
            for radius in 1..=budget.max_radius {
                while layers.len() <= radius as usize + 1 {
                    let next = self.next_layer(layers.last().expect("layer 0"), &mut dist);
                    layers.push(next);
                }
                if radius > 1 && layers[radius as usize].is_empty() {
                    // The region is a whole connected component already.
                    break;
                }
                let mut order: Vec<u32> = layers[..=radius as usize + 1]
                    .iter()
                    .flatten()
                    .copied()
                    .collect();
                order.sort_unstable();
                for (k, &node) in order.iter().enumerate() {
                    local[node as usize] = k as u32;
                }
                let free = |node: u32| dist[node as usize] <= radius;
                let mut edges = Vec::with_capacity(order.len());
                let mut unary = Vec::with_capacity(order.len());
                for &node in &order {
                    let node_free = free(node);
                    edges.push(
                        self.edges[node as usize]
                            .iter()
                            .filter(|e| {
                                local[e.to as usize] != u32::MAX && (node_free || free(e.to))
                            })
                            .map(|e| Edge {
                                to: local[e.to as usize],
                                relation: e.relation,
                            })
                            .collect::<Vec<_>>(),
                    );
                    unary.push(if node_free {
                        self.unary[node as usize].clone()
                    } else {
                        let label = state[node as usize];
                        let weight = self.unary_weight(node as usize, label).expect("candidate");
                        vec![(label, weight)]
                    });
                }
                let problem = Problem {
                    labels: self.labels,
                    edges: &edges,
                    unary: &unary,
                    ids: Some(&order),
                };
                let search_counter = Counter::new(counter.word(&[REPAIR_KEY, v0, radius]));
                let outcome = Search::new(
                    problem,
                    rows,
                    &search_counter,
                    Budget {
                        max_decisions: budget.max_decisions,
                        max_backtracks: budget.max_backtracks,
                    },
                )
                .run();
                for &node in &order {
                    local[node as usize] = u32::MAX;
                }
                let search = match &outcome {
                    Outcome::Solved { stats, .. } | Outcome::Refused { stats, .. } => *stats,
                };
                stats.decisions = stats.decisions.saturating_add(search.decisions);
                stats.backtracks = stats.backtracks.saturating_add(search.backtracks);
                if let Outcome::Solved { labels: found, .. } = outcome {
                    for (k, &node) in order.iter().enumerate() {
                        if free(node) {
                            state[node as usize] = found[k];
                            for edge in &self.edges[node as usize] {
                                let pair = (node.min(edge.to), node.max(edge.to));
                                bad.remove(&pair);
                            }
                        }
                    }
                    stats.rounds += 1;
                    solved = true;
                    break;
                }
            }
            for &node in layers.iter().flatten() {
                dist[node as usize] = u32::MAX;
            }
            if !solved {
                return Ok(self.repair_refused(
                    RepairRefusal::Unrepairable,
                    v0,
                    bad.len(),
                    labels,
                    state,
                    stats,
                ));
            }
        }
    }

    /// The weight of `label` among `node`'s candidates.
    fn unary_weight(&self, node: usize, label: u32) -> Option<u32> {
        let list = &self.unary[node];
        list.binary_search_by_key(&label, |p| p.0)
            .ok()
            .map(|i| list[i].1)
    }

    fn violates(&self, state: &[u32], node: usize, edge: &Edge) -> bool {
        self.tables[edge.relation as usize].get(state[node], state[edge.to as usize]) == 0
    }

    /// The nodes reached from `start` over violating edges, ascending. Marks
    /// each with distance 0.
    fn cluster(&self, state: &[u32], start: u32, dist: &mut [u32]) -> Vec<u32> {
        let mut cluster = vec![start];
        dist[start as usize] = 0;
        let mut at = 0;
        while at < cluster.len() {
            let node = cluster[at] as usize;
            at += 1;
            for edge in &self.edges[node] {
                if dist[edge.to as usize] == u32::MAX && self.violates(state, node, edge) {
                    dist[edge.to as usize] = 0;
                    cluster.push(edge.to);
                }
            }
        }
        cluster.sort_unstable();
        cluster
    }

    /// The unreached neighbours of `layer`, ascending, marked one hop further.
    fn next_layer(&self, layer: &[u32], dist: &mut [u32]) -> Vec<u32> {
        let mut next = Vec::new();
        for &node in layer {
            let d = dist[node as usize] + 1;
            for edge in &self.edges[node as usize] {
                if dist[edge.to as usize] == u32::MAX {
                    dist[edge.to as usize] = d;
                    next.push(edge.to);
                }
            }
        }
        next.sort_unstable();
        next
    }

    fn repair_refused(
        &self,
        reason: RepairRefusal,
        node: u32,
        remaining: usize,
        input: &[u32],
        labels: Vec<u32>,
        mut stats: RepairStats,
    ) -> RepairOutcome {
        stats.changed = changed(input, &labels);
        RepairOutcome::Refused {
            reason,
            node,
            remaining,
            labels,
            stats,
        }
    }
}

fn changed(before: &[u32], after: &[u32]) -> u32 {
    before.iter().zip(after).filter(|(a, b)| a != b).count() as u32
}

/// `rows[relation][a * words ..]` is the bitset of neighbour labels `b` with a
/// non-zero table entry for `(a, b)`; `words` is `ceil(labels / 64)`, at least 1.
fn support_rows(labels: u32, tables: &[PairTable]) -> Vec<Vec<u64>> {
    let labels = labels as usize;
    let words = labels.div_ceil(64).max(1);
    tables
        .iter()
        .map(|table| {
            let mut rows = vec![0u64; labels * words];
            for a in 0..labels {
                for b in 0..labels {
                    if table.get(a as u32, b as u32) > 0 {
                        rows[a * words + b / 64] |= 1 << (b % 64);
                    }
                }
            }
            rows
        })
        .collect()
}

/// What a [`Search`] reads: the whole network for `solve`, or a region of it
/// for `repair`. `ids[node]` is the id hashed for a node (its index in the
/// whole network); `None` hashes the index itself.
#[derive(Clone, Copy)]
struct Problem<'a> {
    labels: u32,
    edges: &'a [Vec<Edge>],
    unary: &'a [Vec<(u32, u32)>],
    ids: Option<&'a [u32]>,
}

/// While the largest weight is `>= 2^bits`, shift every weight right so the
/// largest has exactly `bits` bits. Weights that were positive stay positive.
fn shift_down(weights: &mut [(u32, u64)], bits: u32) {
    let max = weights.iter().map(|w| w.1).max().unwrap_or(0);
    let length = 64 - max.leading_zeros();
    if length > bits {
        let shift = length - bits;
        for entry in weights.iter_mut() {
            if entry.1 > 0 {
                entry.1 = (entry.1 >> shift).max(1);
            }
        }
    }
}

/// Same, keyed on the total, so that `total < 2^bits`.
fn shift_down_total(weights: &mut [(u32, u64)], bits: u32) {
    let total: u128 = weights.iter().map(|w| w.1 as u128).sum();
    let length = 128 - total.leading_zeros();
    if length > bits {
        let shift = length - bits;
        for entry in weights.iter_mut() {
            if entry.1 > 0 {
                entry.1 = (entry.1 >> shift).max(1);
            }
        }
    }
}

fn draw(weights: &[(u32, u64)], unit: u32) -> Option<u32> {
    let total: u64 = weights.iter().map(|w| w.1).sum();
    if total == 0 {
        return None;
    }
    let target = pick_below(unit, total);
    let mut cumulative = 0u64;
    for &(label, weight) in weights {
        cumulative += weight;
        if cumulative > target {
            return Some(label);
        }
    }
    None
}

/// The heaviest label; ties are broken by `unit` among the tied labels.
fn heaviest(weights: &[(u32, u64)], unit: u32) -> Option<u32> {
    let max = weights.iter().map(|w| w.1).max()?;
    if max == 0 {
        return None;
    }
    let tied: Vec<u32> = weights.iter().filter(|w| w.1 == max).map(|w| w.0).collect();
    Some(tied[pick_below(unit, tied.len() as u64) as usize])
}

struct Frame {
    node: usize,
    trail_len: usize,
    label: u32,
}

struct Search<'a> {
    net: Problem<'a>,
    counter: &'a Counter,
    budget: Budget,
    words: usize,
    domain: Vec<u64>,
    size: Vec<u32>,
    /// See [`support_rows`].
    rows: &'a [Vec<u64>],
    trail: Vec<(u32, u32)>,
    queue: std::collections::VecDeque<u32>,
    queued: Vec<bool>,
    stats: SolveStats,
    last_empty: Option<u32>,
}

impl<'a> Search<'a> {
    fn new(net: Problem<'a>, rows: &'a [Vec<u64>], counter: &'a Counter, budget: Budget) -> Self {
        let n = net.edges.len();
        let labels = net.labels as usize;
        let words = labels.div_ceil(64).max(1);
        let mut domain = vec![0u64; n * words];
        let mut size = vec![0u32; n];
        for node in 0..n {
            for &(label, _) in &net.unary[node] {
                domain[node * words + label as usize / 64] |= 1 << (label % 64);
                size[node] += 1;
            }
        }
        Self {
            net,
            counter,
            budget,
            words,
            domain,
            size,
            rows,
            trail: Vec::new(),
            queue: Default::default(),
            queued: vec![false; n],
            stats: SolveStats::default(),
            last_empty: None,
        }
    }

    /// The id hashed for `node`.
    fn id(&self, node: usize) -> u32 {
        self.net.ids.map_or(node as u32, |ids| ids[node])
    }

    fn has(&self, node: usize, label: u32) -> bool {
        self.domain[node * self.words + label as usize / 64] >> (label % 64) & 1 == 1
    }

    fn remove(&mut self, node: usize, label: u32) {
        self.domain[node * self.words + label as usize / 64] &= !(1 << (label % 64));
        self.size[node] -= 1;
        self.trail.push((node as u32, label));
        if self.size[node] == 0 {
            self.last_empty = Some(node as u32);
        }
    }

    fn undo_to(&mut self, length: usize) {
        while self.trail.len() > length {
            let (node, label) = self.trail.pop().expect("trail");
            self.domain[node as usize * self.words + label as usize / 64] |= 1 << (label % 64);
            self.size[node as usize] += 1;
        }
    }

    fn enqueue(&mut self, node: usize) {
        if !self.queued[node] {
            self.queued[node] = true;
            self.queue.push_back(node as u32);
        }
    }

    fn labels_of(&self, node: usize) -> Vec<u32> {
        (0..self.net.labels)
            .filter(|&l| self.has(node, l))
            .collect()
    }

    /// Remove labels of `node` that some neighbour cannot support. Returns
    /// whether the domain changed.
    fn revise(&mut self, node: usize) -> bool {
        let mut changed = false;
        for label in self.labels_of(node) {
            let supported = self.net.edges[node].iter().all(|edge| {
                let row = &self.rows[edge.relation as usize]
                    [label as usize * self.words..(label as usize + 1) * self.words];
                let other = &self.domain[edge.to as usize * self.words..][..self.words];
                row.iter().zip(other).any(|(r, d)| r & d != 0)
            });
            if !supported {
                self.remove(node, label);
                changed = true;
                if self.size[node] == 0 {
                    return true;
                }
            }
        }
        changed
    }

    /// Propagate until nothing changes. Returns false on a contradiction.
    fn propagate(&mut self) -> bool {
        while let Some(node) = self.queue.pop_front() {
            let node = node as usize;
            self.queued[node] = false;
            if self.revise(node) {
                if self.size[node] == 0 {
                    self.queue.clear();
                    self.queued.iter_mut().for_each(|q| *q = false);
                    return false;
                }
                for edge in self.net.edges[node].clone() {
                    self.enqueue(edge.to as usize);
                }
            }
        }
        true
    }

    fn refused(&self, reason: RefusalReason) -> Outcome {
        Outcome::Refused {
            reason,
            node: self.last_empty,
            stats: self.stats,
        }
    }

    fn run(mut self) -> Outcome {
        let n = self.net.edges.len();
        if (0..n).any(|node| self.size[node] == 0) {
            self.last_empty = (0..n).find(|&node| self.size[node] == 0).map(|v| v as u32);
            return self.refused(RefusalReason::Unsatisfiable);
        }
        for node in 0..n {
            self.enqueue(node);
        }
        if !self.propagate() {
            return self.refused(RefusalReason::Unsatisfiable);
        }
        let mut stack: Vec<Frame> = Vec::new();
        loop {
            // Fewest remaining labels first; ties by a fixed per-node hash.
            let mut best: Option<(u32, u32, usize)> = None;
            for node in 0..n {
                if self.size[node] > 1 {
                    let key = (
                        self.size[node],
                        self.counter.word(&[self.id(node), 0, 2]),
                        node,
                    );
                    if best.is_none_or(|b| key < b) {
                        best = Some(key);
                    }
                }
            }
            let Some((_, _, node)) = best else {
                let labels = (0..n)
                    .map(|node| self.labels_of(node)[0])
                    .collect::<Vec<_>>();
                return Outcome::Solved {
                    labels,
                    stats: self.stats,
                };
            };
            if self.stats.decisions >= self.budget.max_decisions {
                return self.refused(RefusalReason::DecisionLimit);
            }
            let serial = self.stats.decisions;
            self.stats.decisions += 1;
            let mut weights: Vec<(u32, u64)> = self
                .labels_of(node)
                .into_iter()
                .map(|l| {
                    let w = self.net.unary[node]
                        .iter()
                        .find(|(label, _)| *label == l)
                        .map_or(1, |p| p.1);
                    (l, w as u64)
                })
                .collect();
            shift_down_total(&mut weights, 40);
            let label = draw(&weights, self.counter.unit(&[self.id(node), serial, 1]))
                .expect("a live domain has positive weights");
            let frame = Frame {
                node,
                trail_len: self.trail.len(),
                label,
            };
            // Assign `frame.label` and propagate. On a contradiction undo the
            // decision, forbid its label at its own level, and keep going up
            // the stack until propagation succeeds or the stack is empty.
            for other in self.labels_of(frame.node) {
                if other != frame.label {
                    self.remove(frame.node, other);
                }
            }
            self.enqueue(frame.node);
            for edge in self.net.edges[frame.node].clone() {
                self.enqueue(edge.to as usize);
            }
            if self.propagate() {
                stack.push(frame);
                continue;
            }
            let mut failed = frame;
            loop {
                self.stats.backtracks += 1;
                if self.stats.backtracks > self.budget.max_backtracks {
                    return self.refused(RefusalReason::BacktrackLimit);
                }
                self.undo_to(failed.trail_len);
                self.remove(failed.node, failed.label);
                if self.size[failed.node] > 0 {
                    self.enqueue(failed.node);
                    for edge in self.net.edges[failed.node].clone() {
                        self.enqueue(edge.to as usize);
                    }
                    if self.propagate() {
                        break;
                    }
                } else {
                    self.queue.clear();
                    self.queued.iter_mut().for_each(|q| *q = false);
                }
                match stack.pop() {
                    Some(previous) => failed = previous,
                    None => return self.refused(RefusalReason::Unsatisfiable),
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn path(n: usize, labels: u32, table: PairTable) -> (Vec<Vec<Edge>>, Vec<PairTable>) {
        let mut edges = vec![Vec::new(); n];
        for i in 0..n.saturating_sub(1) {
            edges[i].push(Edge {
                to: i as u32 + 1,
                relation: 0,
            });
            edges[i + 1].push(Edge {
                to: i as u32,
                relation: 0,
            });
        }
        let _ = labels;
        (edges, vec![table])
    }

    fn everything(n: usize, labels: u32) -> Vec<Vec<(u32, u32)>> {
        vec![(0..labels).map(|l| (l, 1)).collect(); n]
    }

    /// Two labels, neighbours must differ.
    fn alternating() -> PairTable {
        PairTable::new(2, vec![0, 1, 1, 0]).unwrap()
    }

    #[test]
    fn colouring_separates_every_edge() {
        let (edges, tables) = path(9, 2, alternating());
        let net = Network::new(2, edges.clone(), tables, everything(9, 2)).unwrap();
        for (node, list) in edges.iter().enumerate() {
            for edge in list {
                assert_ne!(net.colours()[node], net.colours()[edge.to as usize]);
            }
        }
    }

    #[test]
    fn solve_finds_the_only_alternation_or_its_mirror() {
        let (edges, tables) = path(12, 2, alternating());
        let net = Network::new(2, edges, tables, everything(12, 2)).unwrap();
        let Outcome::Solved { labels, .. } = net.solve(
            &Counter::new(5),
            Budget {
                max_decisions: 100,
                max_backtracks: 100,
            },
        ) else {
            panic!("refused");
        };
        for pair in labels.windows(2) {
            assert_ne!(pair[0], pair[1]);
        }
    }

    #[test]
    fn solve_is_a_function_of_the_seed() {
        let table = PairTable::uniform(4, 1);
        let (edges, tables) = path(30, 4, table);
        let net = Network::new(4, edges, tables, everything(30, 4)).unwrap();
        let budget = Budget {
            max_decisions: 1000,
            max_backtracks: 10,
        };
        let a = net.solve(&Counter::new(1), budget);
        assert_eq!(a, net.solve(&Counter::new(1), budget));
        assert_ne!(a, net.solve(&Counter::new(2), budget));
    }

    #[test]
    fn an_odd_cycle_cannot_alternate_and_the_search_refuses() {
        let mut edges = vec![Vec::new(); 5];
        for i in 0..5usize {
            let j = (i + 1) % 5;
            edges[i].push(Edge {
                to: j as u32,
                relation: 0,
            });
            edges[j].push(Edge {
                to: i as u32,
                relation: 0,
            });
        }
        let net = Network::new(2, edges, vec![alternating()], everything(5, 2)).unwrap();
        match net.solve(
            &Counter::new(3),
            Budget {
                max_decisions: 100,
                max_backtracks: 100,
            },
        ) {
            Outcome::Refused { reason, .. } => assert_eq!(reason, RefusalReason::Unsatisfiable),
            other => panic!("expected a refusal, got {other:?}"),
        }
    }

    #[test]
    fn a_tight_backtrack_budget_refuses_instead_of_hanging() {
        // 3-colour a graph that has no solution after a long search: K4.
        let mut edges = vec![Vec::new(); 4];
        for (i, node) in edges.iter_mut().enumerate() {
            for j in 0..4usize {
                if i != j {
                    node.push(Edge {
                        to: j as u32,
                        relation: 0,
                    });
                }
            }
        }
        let differ = PairTable::new(3, vec![0, 1, 1, 1, 0, 1, 1, 1, 0]).unwrap();
        let net = Network::new(3, edges, vec![differ], everything(4, 3)).unwrap();
        match net.solve(
            &Counter::new(1),
            Budget {
                max_decisions: 100,
                max_backtracks: 0,
            },
        ) {
            Outcome::Refused { reason, .. } => {
                assert!(matches!(
                    reason,
                    RefusalReason::BacktrackLimit | RefusalReason::Unsatisfiable
                ));
            }
            other => panic!("expected a refusal, got {other:?}"),
        }
    }

    #[test]
    fn sampling_follows_unary_weights_and_pair_attraction() {
        // No edges: labels follow the unary weights.
        let net = Network::new(
            2,
            vec![Vec::new(); 4000],
            vec![],
            vec![vec![(0, 3), (1, 1)]; 4000],
        )
        .unwrap();
        let state = net
            .sample(&Counter::new(9), Schedule { gibbs: 1, icm: 0 })
            .unwrap();
        let zeros = state.iter().filter(|&&l| l == 0).count();
        assert!((2800..3200).contains(&zeros), "{zeros}");
        // A strong "same label" table makes neighbours agree far more often.
        let same = PairTable::new(2, vec![9, 1, 1, 9]).unwrap();
        let (edges, tables) = path(2000, 2, same);
        let net = Network::new(2, edges, tables, everything(2000, 2)).unwrap();
        let state = net
            .sample(&Counter::new(9), Schedule { gibbs: 6, icm: 0 })
            .unwrap();
        let agree = state.windows(2).filter(|p| p[0] == p[1]).count();
        assert!(agree > 1700, "{agree}");
    }

    #[test]
    fn sampling_does_not_depend_on_visit_order_within_a_colour() {
        // Reverse order with immediate updates is the most different order
        // there is; it agrees only because one colour's nodes share no edge.
        let (edges, tables) = path(64, 3, PairTable::uniform(3, 2));
        let mut grid = vec![Vec::new(); 36];
        for y in 0..6usize {
            for x in 0..6usize {
                let i = y * 6 + x;
                for (dx, dy, relation) in [(1i32, 0i32, 0u32), (-1, 0, 0), (0, 1, 0), (0, -1, 0)] {
                    let (nx, ny) = (x as i32 + dx, y as i32 + dy);
                    if (0..6).contains(&nx) && (0..6).contains(&ny) {
                        grid[i].push(Edge {
                            to: (ny * 6 + nx) as u32,
                            relation,
                        });
                    }
                }
            }
        }
        let attract = PairTable::new(3, vec![9, 1, 1, 1, 9, 1, 1, 1, 9]).unwrap();
        let networks = [
            Network::new(3, edges, tables, everything(64, 3)).unwrap(),
            Network::new(3, grid, vec![attract], everything(36, 3)).unwrap(),
        ];
        let schedule = Schedule { gibbs: 5, icm: 2 };
        for net in &networks {
            for seed in 0..5 {
                let c = Counter::new(seed);
                let reference = net.sample(&c, schedule).unwrap();
                assert_eq!(
                    reference,
                    net.sample_ordered(&c, schedule, true, true).unwrap()
                );
                assert_eq!(
                    reference,
                    net.sample_ordered(&c, schedule, true, false).unwrap()
                );
                assert_eq!(
                    reference,
                    net.sample_ordered(&c, schedule, false, true).unwrap()
                );
            }
        }
    }

    #[test]
    fn violations_count_each_conflicting_edge_once() {
        let (edges, tables) = path(5, 2, alternating());
        let net = Network::new(2, edges, tables, everything(5, 2)).unwrap();
        assert_eq!(net.violations(&[0, 1, 0, 1, 0]), 0);
        assert_eq!(net.violations(&[0, 0, 0, 1, 1]), 3);
    }

    #[test]
    fn violations_follow_the_direction_of_an_asymmetric_table() {
        // Holding 0 beside a neighbour that holds 1 is forbidden going east,
        // and so holding 1 beside a neighbour that holds 0 is forbidden going west.
        let east = PairTable::new(2, vec![1, 0, 1, 1]).unwrap();
        let west = PairTable::new(2, vec![1, 1, 0, 1]).unwrap();
        let edges = vec![
            vec![Edge { to: 1, relation: 0 }],
            vec![Edge { to: 0, relation: 1 }],
        ];
        let net = Network::new(2, edges, vec![east, west], everything(2, 2)).unwrap();
        assert_eq!(net.violations(&[0, 1]), 1);
        assert_eq!(net.violations(&[1, 0]), 0);
        assert_eq!(net.violations(&[0, 0]), 0);
    }

    #[test]
    fn a_long_run_or_a_huge_label_count_is_refused_not_attempted() {
        let (edges, tables) = path(3, 2, alternating());
        let net = Network::new(2, edges, tables, everything(3, 2)).unwrap();
        let schedule = Schedule {
            gibbs: MAX_ROUNDS + 1,
            icm: 0,
        };
        assert!(net.sample(&Counter::new(1), schedule).is_err());
        assert!(PairTable::new(MAX_LABELS + 1, vec![]).is_err());
        assert!(Network::new(MAX_LABELS + 1, vec![], vec![], vec![]).is_err());
    }

    #[test]
    fn non_transpose_tables_are_rejected() {
        let skew = PairTable::new(2, vec![1, 2, 3, 4]).unwrap();
        let mut edges = vec![Vec::new(); 2];
        edges[0].push(Edge { to: 1, relation: 0 });
        edges[1].push(Edge { to: 0, relation: 0 });
        assert!(Network::new(2, edges, vec![skew], everything(2, 2)).is_err());
    }

    #[test]
    fn missing_reverse_edges_are_rejected() {
        let mut edges = vec![Vec::new(); 2];
        edges[0].push(Edge { to: 1, relation: 0 });
        assert!(Network::new(2, edges, vec![PairTable::uniform(2, 1)], everything(2, 2)).is_err());
    }

    // ---- repair ----

    /// Directions of a grid node's edges: 0 east, 1 down, 2 west, 3 up.
    fn grid(w: usize, h: usize) -> Vec<Vec<Edge>> {
        let mut edges = vec![Vec::new(); w * h];
        for y in 0..h {
            for x in 0..w {
                let i = y * w + x;
                if x + 1 < w {
                    edges[i].push(Edge {
                        to: (i + 1) as u32,
                        relation: 0,
                    });
                }
                if y + 1 < h {
                    edges[i].push(Edge {
                        to: (i + w) as u32,
                        relation: 1,
                    });
                }
                if x > 0 {
                    edges[i].push(Edge {
                        to: (i - 1) as u32,
                        relation: 2,
                    });
                }
                if y > 0 {
                    edges[i].push(Edge {
                        to: (i - w) as u32,
                        relation: 3,
                    });
                }
            }
        }
        edges
    }

    fn transpose(t: &PairTable) -> PairTable {
        let n = t.labels();
        let mut w = vec![0; (n * n) as usize];
        for a in 0..n {
            for b in 0..n {
                w[(a * n + b) as usize] = t.get(b, a);
            }
        }
        PairTable::new(n, w).unwrap()
    }

    /// Tables for the four grid relations from the east and down tables.
    fn four(east: PairTable, down: PairTable) -> Vec<PairTable> {
        let (west, up) = (transpose(&east), transpose(&down));
        vec![east, down, west, up]
    }

    fn differ(labels: u32) -> PairTable {
        let n = labels as usize;
        PairTable::new(
            labels,
            (0..n * n).map(|i| u32::from(i / n != i % n)).collect(),
        )
        .unwrap()
    }

    fn budget(max_radius: u32) -> RepairBudget {
        RepairBudget {
            max_radius,
            max_decisions: 1_000_000,
            max_backtracks: 1_000_000,
            max_rounds: 10_000,
        }
    }

    /// Every directed edge holds a pair with a non-zero table entry, read
    /// straight from the tables the network was built from.
    fn satisfies(edges: &[Vec<Edge>], tables: &[PairTable], labels: &[u32]) -> bool {
        edges.iter().enumerate().all(|(node, list)| {
            list.iter()
                .all(|e| tables[e.relation as usize].get(labels[node], labels[e.to as usize]) > 0)
        })
    }

    /// Endpoints of edges whose table entry is zero.
    fn conflicted(edges: &[Vec<Edge>], tables: &[PairTable], labels: &[u32]) -> Vec<usize> {
        (0..edges.len())
            .filter(|&node| {
                edges[node].iter().any(|e| {
                    tables[e.relation as usize].get(labels[node], labels[e.to as usize]) == 0
                })
            })
            .collect()
    }

    /// Hop distance from the nearest source (u32::MAX if unreachable).
    fn hops(edges: &[Vec<Edge>], sources: &[usize]) -> Vec<u32> {
        let mut dist = vec![u32::MAX; edges.len()];
        let mut queue = std::collections::VecDeque::new();
        for &s in sources {
            dist[s] = 0;
            queue.push_back(s);
        }
        while let Some(node) = queue.pop_front() {
            for e in &edges[node] {
                if dist[e.to as usize] == u32::MAX {
                    dist[e.to as usize] = dist[node] + 1;
                    queue.push_back(e.to as usize);
                }
            }
        }
        dist
    }

    /// What every repair must uphold: a repaired labelling satisfies every
    /// edge, only nodes within `max_radius` hops of a violation change, every
    /// round removes at least one violating edge, and `changed` counts the
    /// nodes that changed.
    fn check(
        edges: &[Vec<Edge>],
        tables: &[PairTable],
        start: &[u32],
        outcome: &RepairOutcome,
        max_radius: u32,
    ) {
        let (labels, stats) = match outcome {
            RepairOutcome::Repaired { labels, stats } => {
                assert!(satisfies(edges, tables, labels));
                (labels, stats)
            }
            RepairOutcome::Refused {
                labels,
                stats,
                node,
                remaining,
                ..
            } => {
                assert!(*remaining > 0);
                assert!(conflicted(edges, tables, labels).contains(&(*node as usize)));
                (labels, stats)
            }
        };
        let near = hops(edges, &conflicted(edges, tables, start));
        let mut changed = 0;
        for node in 0..start.len() {
            if labels[node] != start[node] {
                assert!(
                    near[node] <= max_radius,
                    "node {node} changed {} hops away",
                    near[node]
                );
                changed += 1;
            }
        }
        assert_eq!(stats.changed, changed);
        let before = (0..edges.len())
            .flat_map(|i| edges[i].iter().map(move |e| (i, e)))
            .filter(|(i, e)| {
                *i < e.to as usize
                    && tables[e.relation as usize].get(start[*i], start[e.to as usize]) == 0
            })
            .count();
        assert!(stats.rounds as usize <= before);
    }

    #[test]
    fn repair_clears_what_sampling_leaves_on_a_three_colour_grid() {
        let edges = grid(12, 12);
        let tables = four(differ(3), differ(3));
        let net = Network::new(3, edges.clone(), tables.clone(), everything(144, 3)).unwrap();
        let mut frustrated = 0;
        for seed in 0..8 {
            let start = net
                .sample(&Counter::new(seed), Schedule { gibbs: 3, icm: 1 })
                .unwrap();
            if net.violations(&start) == 0 {
                continue;
            }
            frustrated += 1;
            // A pinned boundary can force a 3-colouring's parity, so some
            // clusters need a region several hops wide.
            let outcome = net.repair(&start, &Counter::new(seed), budget(8)).unwrap();
            assert!(
                matches!(outcome, RepairOutcome::Repaired { .. }),
                "{outcome:?}"
            );
            check(&edges, &tables, &start, &outcome, 8);
            for radius in [1, 2] {
                let outcome = net
                    .repair(&start, &Counter::new(seed), budget(radius))
                    .unwrap();
                check(&edges, &tables, &start, &outcome, radius);
            }
        }
        assert!(frustrated > 0, "sampling left no violations to repair");
    }

    /// Pipe tiles: label bits are the open sides (1 east, 2 up, 4 west,
    /// 8 down). Neighbours must agree on the side they share, so the east
    /// and down tables are not symmetric and the four relations differ. Only
    /// straights and corners (two open sides) are candidates, so a node whose
    /// neighbours ask for three open sides has no label that fits.
    type Unary = Vec<Vec<(u32, u32)>>;

    fn pipes(w: usize, h: usize) -> (Vec<Vec<Edge>>, Vec<PairTable>, Unary) {
        let mut east = vec![0; 256];
        let mut down = vec![0; 256];
        for a in 0..16usize {
            for b in 0..16usize {
                east[a * 16 + b] = u32::from((a & 1 != 0) == (b & 4 != 0));
                down[a * 16 + b] = u32::from((a & 8 != 0) == (b & 2 != 0));
            }
        }
        let tables = four(
            PairTable::new(16, east).unwrap(),
            PairTable::new(16, down).unwrap(),
        );
        let unary = vec![
            (0..16u32)
                .filter(|l| l.count_ones() == 2)
                .map(|l| (l, if l == 5 || l == 10 { 1 } else { 4 }))
                .collect();
            w * h
        ];
        (grid(w, h), tables, unary)
    }

    #[test]
    fn repair_joins_pipes_that_sampling_left_broken() {
        let (edges, tables, unary) = pipes(9, 7);
        assert_ne!(tables[0], transpose(&tables[0]));
        let net = Network::new(16, edges.clone(), tables.clone(), unary).unwrap();
        let mut frustrated = 0;
        for seed in 0..6 {
            let start = net
                .sample(&Counter::new(seed), Schedule { gibbs: 2, icm: 1 })
                .unwrap();
            if net.violations(&start) == 0 {
                continue;
            }
            frustrated += 1;
            let outcome = net.repair(&start, &Counter::new(seed), budget(8)).unwrap();
            assert!(
                matches!(outcome, RepairOutcome::Repaired { .. }),
                "{outcome:?}"
            );
            check(&edges, &tables, &start, &outcome, 8);
            for radius in [1, 2] {
                let outcome = net
                    .repair(&start, &Counter::new(seed), budget(radius))
                    .unwrap();
                check(&edges, &tables, &start, &outcome, radius);
            }
        }
        assert!(frustrated > 0, "sampling left no violations to repair");
    }

    fn complete(n: usize) -> Vec<Vec<Edge>> {
        (0..n)
            .map(|i| {
                (0..n)
                    .filter(|&j| j != i)
                    .map(|j| Edge {
                        to: j as u32,
                        relation: 0,
                    })
                    .collect()
            })
            .collect()
    }

    fn ring(n: usize) -> Vec<Vec<Edge>> {
        (0..n)
            .map(|i| {
                vec![
                    Edge {
                        to: ((i + 1) % n) as u32,
                        relation: 0,
                    },
                    Edge {
                        to: ((i + n - 1) % n) as u32,
                        relation: 0,
                    },
                ]
            })
            .collect()
    }

    #[test]
    fn repair_refuses_networks_with_no_valid_labelling() {
        for (labels, edges, start) in [
            (3u32, complete(4), vec![0u32, 0, 1, 2]),
            (2, ring(5), vec![0, 1, 0, 1, 0]),
            (2, ring(9), vec![1, 1, 0, 1, 0, 1, 0, 1, 0]),
        ] {
            let tables = vec![differ(labels)];
            let n = edges.len();
            let net =
                Network::new(labels, edges.clone(), tables.clone(), everything(n, labels)).unwrap();
            let outcome = net
                .repair(&start, &Counter::new(4), budget(MAX_REPAIR_RADIUS))
                .unwrap();
            let RepairOutcome::Refused { reason, .. } = outcome else {
                panic!("{outcome:?}");
            };
            assert_eq!(reason, RepairRefusal::Unrepairable);
            check(&edges, &tables, &start, &outcome, MAX_REPAIR_RADIUS);
        }
    }

    #[test]
    fn a_round_limit_stops_with_the_rest_unrepaired() {
        // Two conflicts far apart on a three-colour path: two rounds.
        let edges = path(40, 3, differ(3)).0;
        let tables = vec![differ(3)];
        let net = Network::new(3, edges.clone(), tables.clone(), everything(40, 3)).unwrap();
        let mut start: Vec<u32> = (0..40).map(|i| i % 3).collect();
        start[5] = start[4];
        start[30] = start[29];
        let initial = net.violations(&start);
        assert_eq!(initial, 2);
        let limited = |max_rounds| {
            net.repair(
                &start,
                &Counter::new(1),
                RepairBudget {
                    max_rounds,
                    ..budget(2)
                },
            )
            .unwrap()
        };
        for max_rounds in [0, 1] {
            let outcome = limited(max_rounds);
            check(&edges, &tables, &start, &outcome, 2);
            let RepairOutcome::Refused {
                reason,
                remaining,
                labels,
                stats,
                ..
            } = &outcome
            else {
                panic!("{outcome:?}");
            };
            assert_eq!(*reason, RepairRefusal::RoundLimit);
            assert_eq!(stats.rounds, max_rounds);
            assert_eq!(*remaining, net.violations(labels));
            assert_eq!(*remaining, initial - max_rounds as usize);
        }
        let outcome = limited(2);
        check(&edges, &tables, &start, &outcome, 2);
        assert!(matches!(outcome, RepairOutcome::Repaired { stats, .. } if stats.rounds == 2));
    }

    #[test]
    fn a_valid_labelling_comes_back_untouched() {
        let (edges, tables) = path(9, 2, alternating());
        let net = Network::new(2, edges, tables, everything(9, 2)).unwrap();
        let start: Vec<u32> = (0..9).map(|i| i % 2).collect();
        assert_eq!(
            net.repair(&start, &Counter::new(1), budget(1)).unwrap(),
            RepairOutcome::Repaired {
                labels: start.clone(),
                stats: RepairStats::default()
            }
        );
    }

    #[test]
    fn repair_rejects_bad_input() {
        let (edges, tables) = path(3, 3, differ(3));
        let mut unary = everything(3, 3);
        unary[1] = vec![(0, 1), (2, 1)];
        let net = Network::new(3, edges, tables, unary).unwrap();
        let ok = [0u32, 2, 0];
        let c = Counter::new(1);
        assert!(net.repair(&ok, &c, budget(1)).is_ok());
        for labels in [&[0u32, 2][..], &[0, 2, 0, 0], &[0, 1, 0], &[0, 2, 3]] {
            assert!(matches!(
                net.repair(labels, &c, budget(1)),
                Err(Error::InvalidParameter(_))
            ));
        }
        for bad_budget in [
            budget(0),
            budget(MAX_REPAIR_RADIUS + 1),
            RepairBudget {
                max_rounds: MAX_REPAIR_ROUNDS + 1,
                ..budget(1)
            },
        ] {
            assert!(matches!(
                net.repair(&ok, &c, bad_budget),
                Err(Error::InvalidParameter(_))
            ));
        }
    }

    #[test]
    fn repair_is_a_function_of_its_inputs_and_the_seed() {
        // Four colours on a grid: many repairs of an all-equal start exist.
        let edges = grid(8, 8);
        let tables = four(differ(4), differ(4));
        let net = Network::new(4, edges.clone(), tables.clone(), everything(64, 4)).unwrap();
        let start = vec![0u32; 64];
        let a = net.repair(&start, &Counter::new(1), budget(2)).unwrap();
        check(&edges, &tables, &start, &a, 2);
        assert_eq!(a, net.repair(&start, &Counter::new(1), budget(2)).unwrap());
        let b = net.repair(&start, &Counter::new(2), budget(2)).unwrap();
        check(&edges, &tables, &start, &b, 2);
        let (
            RepairOutcome::Repaired { labels: la, .. },
            RepairOutcome::Repaired { labels: lb, .. },
        ) = (&a, &b)
        else {
            panic!("{a:?} {b:?}");
        };
        assert_ne!(la, lb);
    }

    /// A proper four-colouring of a `w` by `h` grid, `(x + 2y) % 4`.
    fn four_coloured(w: usize, h: usize) -> Vec<u32> {
        (0..w * h)
            .map(|i| ((i % w + 2 * (i / w)) % 4) as u32)
            .collect()
    }

    #[test]
    fn violations_just_outside_a_region_do_not_block_its_repair() {
        // Two conflicts: one at (2,2)-(3,2), one at (2,4)-(3,4), two hops
        // away, so the second sits on the pinned ring of the first.
        let w = 8;
        let edges = grid(w, 8);
        let tables = four(differ(4), differ(4));
        let net = Network::new(4, edges.clone(), tables.clone(), everything(64, 4)).unwrap();
        let mut start = four_coloured(w, 8);
        start[2 * w + 2] = start[2 * w + 3];
        start[4 * w + 2] = start[4 * w + 3];
        for seed in 0..4 {
            let outcome = net.repair(&start, &Counter::new(seed), budget(1)).unwrap();
            assert!(
                matches!(outcome, RepairOutcome::Repaired { .. }),
                "{outcome:?}"
            );
            check(&edges, &tables, &start, &outcome, 1);
        }
    }

    #[test]
    fn repair_does_not_depend_on_where_a_region_sits_in_the_numbering() {
        // Node 0 is either isolated or tied by an unconstraining edge to a
        // node next to the conflict, so it joins the region as a pinned
        // node with the lowest index. Pinned and unconstraining, it changes
        // nothing, so the grid nodes (1..=100) must repair the same way.
        let w = 10;
        let mut start = vec![0u32];
        start.extend(four_coloured(w, 10));
        let (a, b) = (1 + 5 * w + 5, 1 + 5 * w + 6);
        start[a] = start[b];
        let mut tables = four(differ(4), differ(4));
        tables.push(PairTable::uniform(4, 1));
        let shifted = |edges: Vec<Vec<Edge>>| -> Vec<Vec<Edge>> {
            let mut out = vec![Vec::new()];
            out.extend(edges.into_iter().map(|list| {
                list.into_iter()
                    .map(|e| Edge {
                        to: e.to + 1,
                        relation: e.relation,
                    })
                    .collect::<Vec<_>>()
            }));
            out
        };
        let alone = shifted(grid(w, 10));
        let mut tied = alone.clone();
        let neighbour = a - w; // one hop from the conflict
        tied[0].push(Edge {
            to: neighbour as u32,
            relation: 4,
        });
        tied[neighbour].push(Edge { to: 0, relation: 4 });
        let nets = [alone, tied]
            .map(|edges| Network::new(4, edges, tables.clone(), everything(101, 4)).unwrap());
        let mut moved = 0;
        for seed in 0..12 {
            let [x, y] = [0, 1].map(|k| {
                nets[k]
                    .repair(&start, &Counter::new(seed), budget(1))
                    .unwrap()
            });
            let (
                RepairOutcome::Repaired { labels: lx, .. },
                RepairOutcome::Repaired { labels: ly, .. },
            ) = (&x, &y)
            else {
                panic!("{x:?} {y:?}");
            };
            assert_eq!(lx, ly, "seed {seed}");
            moved += usize::from(lx[a] != start[a] || lx[b] != start[b]);
        }
        assert!(moved > 0);
    }

    /// Small random networks against brute force. With a radius that reaches
    /// the whole graph, a satisfiable network is always repaired; at any
    /// radius, whatever is repaired is valid and local.
    #[test]
    fn repair_agrees_with_brute_force_on_small_random_networks() {
        let mut satisfiable_cases = 0;
        let mut needed_growth = 0;
        for case in 0..600u32 {
            let c = Counter::new(case);
            let n = 5 + c.below(5, &[0]) as usize;
            let labels = 2 + c.below(2, &[1]) as u32;
            let relations = 1 + c.below(2, &[2]) as u32;
            let cells = (labels * labels) as usize;
            let mut tables: Vec<PairTable> = (0..relations)
                .map(|r| {
                    let w = (0..cells as u32)
                        .map(|k| {
                            if c.unit(&[3, r, k]) < (1 << 24) * 3 / 10 {
                                0
                            } else {
                                1 + c.below(4, &[4, r, k]) as u32
                            }
                        })
                        .collect();
                    PairTable::new(labels, w).unwrap()
                })
                .collect();
            let back: Vec<PairTable> = tables.iter().map(transpose).collect();
            tables.extend(back);
            let mut edges = vec![Vec::new(); n];
            for i in 0..n as u32 {
                for j in (i + 1)..n as u32 {
                    if c.unit(&[5, i, j]) < (1 << 24) * 2 / 5 {
                        let r = c.below(relations as u64, &[6, i, j]) as u32;
                        edges[i as usize].push(Edge { to: j, relation: r });
                        edges[j as usize].push(Edge {
                            to: i,
                            relation: r + relations,
                        });
                    }
                }
            }
            let unary: Vec<Vec<(u32, u32)>> = (0..n as u32)
                .map(|node| {
                    let mut list: Vec<(u32, u32)> = (0..labels)
                        .filter(|&l| c.unit(&[7, node, l]) >= (1 << 24) / 5)
                        .map(|l| (l, 1 + c.below(3, &[8, node, l]) as u32))
                        .collect();
                    if list.is_empty() {
                        list.push((c.below(labels as u64, &[9, node]) as u32, 1));
                    }
                    list
                })
                .collect();
            let start: Vec<u32> = (0..n as u32)
                .map(|node| {
                    let list = &unary[node as usize];
                    list[c.below(list.len() as u64, &[10, node]) as usize].0
                })
                .collect();
            let net = Network::new(labels, edges.clone(), tables.clone(), unary.clone()).unwrap();
            // Brute force over every candidate combination.
            let mut satisfiable = false;
            let mut pick = vec![0usize; n];
            'all: loop {
                let labelling: Vec<u32> = (0..n).map(|i| unary[i][pick[i]].0).collect();
                if satisfies(&edges, &tables, &labelling) {
                    satisfiable = true;
                    break;
                }
                for i in 0..n {
                    pick[i] += 1;
                    if pick[i] < unary[i].len() {
                        continue 'all;
                    }
                    pick[i] = 0;
                }
                break;
            }
            let diameter = (0..n)
                .flat_map(|s| hops(&edges, &[s]))
                .filter(|&d| d != u32::MAX)
                .max()
                .unwrap_or(0)
                .max(1);
            let full = net
                .repair(&start, &Counter::new(case), budget(diameter))
                .unwrap();
            check(&edges, &tables, &start, &full, diameter);
            if satisfiable {
                satisfiable_cases += 1;
                assert!(
                    matches!(full, RepairOutcome::Repaired { .. }),
                    "case {case}: {full:?}"
                );
            } else {
                assert!(matches!(
                    full,
                    RepairOutcome::Refused {
                        reason: RepairRefusal::Unrepairable,
                        ..
                    }
                ));
            }
            let small = net.repair(&start, &Counter::new(case), budget(1)).unwrap();
            check(&edges, &tables, &start, &small, 1);
            // Satisfiable, repaired at full radius, refused at radius 1:
            // growing the radius was what repaired it.
            if satisfiable && matches!(small, RepairOutcome::Refused { .. }) {
                needed_growth += 1;
            }
        }
        assert!(satisfiable_cases > 100, "{satisfiable_cases}");
        assert!(needed_growth > 0);
    }
}
