//! Neighbour statistics learned from labelled example graphs.
//!
//! Each relation keeps its pair counts in an order-1 [`Markov`] model: seeing
//! label `b` next to label `a` through relation `r` is one transition
//! `[a] -> b`. Label frequencies live in a [`Weighted`] table. The tables a
//! [`crate::Network`] reads are derived from those counts with integer
//! arithmetic only, so every runtime derives the same table.

use crate::network::{Edge, PairTable};
use crate::{Error, Markov, Weighted};
use std::collections::BTreeMap;

/// Lift of 1 (the pair is exactly as common as chance) maps to this weight.
pub const NEUTRAL: u32 = 33;
/// Weight of a pair that was never seen, and the smallest weight.
pub const FLOOR: u32 = 1;
/// Largest weight a table entry takes.
pub const CEILING: u32 = 255;

#[derive(Clone, Debug)]
pub struct PairStats {
    labels: u32,
    counts: Weighted<u32>,
    relations: BTreeMap<u32, Markov<u32>>,
}

impl PairStats {
    pub fn new(labels: u32) -> Self {
        Self {
            labels,
            counts: Weighted::new(Vec::new()).expect("empty table is valid"),
            relations: BTreeMap::new(),
        }
    }

    pub fn labels(&self) -> u32 {
        self.labels
    }

    /// Count one node holding `label`.
    pub fn observe_label(&mut self, label: u32) -> Result<(), Error> {
        self.check(label)?;
        self.counts.adjust(label, 1.0)
    }

    /// Count `n` nodes holding `label` (restoring saved counts).
    pub fn observe_label_n(&mut self, label: u32, n: u64) -> Result<(), Error> {
        self.check(label)?;
        if n == 0 {
            return Ok(());
        }
        self.counts.adjust(label, n as f64)
    }

    /// Count `a` next to `b` through `relation`. The reverse direction is the
    /// caller's to count (a graph visit does so, because every edge has a
    /// reverse edge).
    pub fn observe_pair(&mut self, relation: u32, a: u32, b: u32) -> Result<(), Error> {
        self.observe_pair_n(relation, a, b, 1)
    }

    /// Count `a` next to `b` through `relation`, `n` times.
    pub fn observe_pair_n(&mut self, relation: u32, a: u32, b: u32, n: u64) -> Result<(), Error> {
        self.check(a)?;
        self.check(b)?;
        if n == 0 {
            return Ok(());
        }
        let model = match self.relations.entry(relation) {
            std::collections::btree_map::Entry::Occupied(e) => e.into_mut(),
            std::collections::btree_map::Entry::Vacant(e) => e.insert(Markov::new(1)?),
        };
        model.add_transition(&[a], b, n as f64)
    }

    /// Every observed `(a, b, count)` of `relation`, ascending.
    pub fn pairs(&self, relation: u32) -> Vec<(u32, u32, u64)> {
        self.pair_counts(relation)
            .into_iter()
            .map(|((a, b), n)| (a, b, n))
            .collect()
    }

    /// How many times each label was counted.
    pub fn label_counts(&self) -> Vec<u64> {
        (0..self.labels).map(|l| self.label_count(l)).collect()
    }

    /// Count every node and every directed edge of a labelled graph.
    pub fn observe_graph(&mut self, edges: &[Vec<Edge>], labels: &[u32]) -> Result<(), Error> {
        if edges.len() != labels.len() {
            return Err(Error::InvalidParameter(
                "one label per node is required".to_owned(),
            ));
        }
        for (node, list) in edges.iter().enumerate() {
            self.observe_label(labels[node])?;
            for edge in list {
                let other = *labels
                    .get(edge.to as usize)
                    .ok_or_else(|| Error::InvalidParameter("edge leaves the graph".to_owned()))?;
                self.observe_pair(edge.relation, labels[node], other)?;
            }
        }
        Ok(())
    }

    fn check(&self, label: u32) -> Result<(), Error> {
        if label >= self.labels {
            return Err(Error::InvalidParameter(format!(
                "label {label} is outside 0..{}",
                self.labels
            )));
        }
        Ok(())
    }

    /// Number of times `label` was counted.
    pub fn label_count(&self, label: u32) -> u64 {
        self.counts.weight(&label).unwrap_or(0.0) as u64
    }

    /// Times `a` was seen next to `b` through `relation`.
    pub fn pair_count(&self, relation: u32, a: u32, b: u32) -> u64 {
        self.pair_counts(relation)
            .get(&(a, b))
            .copied()
            .unwrap_or(0)
    }

    fn pair_counts(&self, relation: u32) -> BTreeMap<(u32, u32), u64> {
        let mut result = BTreeMap::new();
        if let Some(model) = self.relations.get(&relation) {
            for t in model.to_data().forward {
                if t.context.len() == 1 {
                    result.insert((t.context[0], t.next), t.weight as u64);
                }
            }
        }
        result
    }

    /// Relations that have at least one observation.
    pub fn relations(&self) -> Vec<u32> {
        self.relations.keys().copied().collect()
    }

    /// The pair table for `relation`, as lift quantised to integers:
    ///
    /// `weight(a, b) = 1 + min(254, floor(32 * count(a,b) * T / (R(a) * C(b))))`
    ///
    /// where `T` is the relation's total count and `R`, `C` are the row and
    /// column sums. A pair that chance alone would produce gets 33; a pair
    /// never seen gets 1 (rare, not forbidden). A label never seen on this
    /// relation gets 33 against everything. A relation with no observations is
    /// all 33.
    pub fn table(&self, relation: u32) -> PairTable {
        let n = self.labels as usize;
        let counts = self.pair_counts(relation);
        let mut rows = vec![0u64; n];
        let mut cols = vec![0u64; n];
        let mut total = 0u64;
        for (&(a, b), &c) in &counts {
            rows[a as usize] += c;
            cols[b as usize] += c;
            total += c;
        }
        let mut weights = vec![NEUTRAL; n * n];
        for a in 0..n {
            for b in 0..n {
                if rows[a] == 0 || cols[b] == 0 {
                    continue;
                }
                let c = counts.get(&(a as u32, b as u32)).copied().unwrap_or(0) as u128;
                let lift = 32 * c * total as u128 / (rows[a] as u128 * cols[b] as u128);
                weights[a * n + b] = FLOOR + lift.min((CEILING - FLOOR) as u128) as u32;
            }
        }
        PairTable::new(self.labels, weights).expect("n * n weights")
    }

    /// Same shape, but zero where a pair was never seen and 1 where it was:
    /// the table for solvers that may only use observed adjacencies.
    pub fn support_table(&self, relation: u32) -> PairTable {
        let n = self.labels as usize;
        let counts = self.pair_counts(relation);
        let mut weights = vec![0u32; n * n];
        for (&(a, b), &c) in &counts {
            if c > 0 {
                weights[a as usize * n + b as usize] = 1;
            }
        }
        PairTable::new(self.labels, weights).expect("n * n weights")
    }

    /// Label frequencies as unary weights: `1 + count`, capped at 255 after
    /// scaling the largest count to 254.
    pub fn unary_weights(&self) -> Vec<u32> {
        let n = self.labels as usize;
        let counts: Vec<u64> = (0..self.labels).map(|l| self.label_count(l)).collect();
        let max = counts.iter().copied().max().unwrap_or(0).max(1);
        (0..n).map(|l| 1 + (254 * counts[l] / max) as u32).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(n: usize) -> Vec<Vec<Edge>> {
        let mut edges = vec![Vec::new(); n];
        for i in 0..n - 1 {
            edges[i].push(Edge {
                to: i as u32 + 1,
                relation: 0,
            });
            edges[i + 1].push(Edge {
                to: i as u32,
                relation: 0,
            });
        }
        edges
    }

    #[test]
    fn alternating_examples_make_unlike_neighbours_attractive() {
        let mut stats = PairStats::new(2);
        let labels: Vec<u32> = (0..40).map(|i| i % 2).collect();
        stats.observe_graph(&line(40), &labels).unwrap();
        let table = stats.table(0);
        assert!(table.get(0, 1) > NEUTRAL);
        assert_eq!(table.get(0, 0), FLOOR);
        assert_eq!(stats.pair_count(0, 0, 1), 39);
    }

    #[test]
    fn learned_tables_are_valid_for_a_network() {
        let mut stats = PairStats::new(3);
        let labels: Vec<u32> = (0..30).map(|i| (i / 3) % 3).collect();
        let edges = line(30);
        stats.observe_graph(&edges, &labels).unwrap();
        let unary = vec![(0..3).map(|l| (l, 1)).collect::<Vec<_>>(); 30];
        crate::Network::new(3, edges, vec![stats.table(0)], unary).unwrap();
    }

    #[test]
    fn an_unseen_relation_is_neutral() {
        let stats = PairStats::new(2);
        assert!(stats.table(5).weights().iter().all(|&w| w == NEUTRAL));
    }

    #[test]
    fn out_of_range_labels_are_rejected() {
        let mut stats = PairStats::new(2);
        assert!(stats.observe_pair(0, 0, 2).is_err());
    }
}
