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
        Search::new(self, counter, budget).run()
    }
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
    net: &'a Network,
    counter: &'a Counter,
    budget: Budget,
    words: usize,
    domain: Vec<u64>,
    size: Vec<u32>,
    /// `rows[relation][a * words ..]` is the bitset of neighbour labels `b`
    /// with a non-zero table entry for `(a, b)`.
    rows: Vec<Vec<u64>>,
    trail: Vec<(u32, u32)>,
    queue: std::collections::VecDeque<u32>,
    queued: Vec<bool>,
    stats: SolveStats,
    last_empty: Option<u32>,
}

impl<'a> Search<'a> {
    fn new(net: &'a Network, counter: &'a Counter, budget: Budget) -> Self {
        let n = net.nodes();
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
        let rows = net
            .tables
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
            .collect();
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
        let n = self.net.nodes();
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
                        self.counter.word(&[node as u32, 0, 2]),
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
            let label = draw(&weights, self.counter.unit(&[node as u32, serial, 1]))
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
}
