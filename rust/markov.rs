//! A typed, explicitly-driven Markov model.
//!
//! Contexts are stored as `Vec<T>` keys.  Start and end are represented by
//! weights on a context node instead of values in `T`; this is what makes a
//! model safe for arbitrary keyed values (including values that happened to
//! be used as delimiters by the old string implementation).

use std::collections::{BTreeMap, BTreeSet};

use crate::{Error, Rng};

/// Direction used by [`Markov::step`] and [`Markov::generate`].
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Direction {
    /// Select a successor and append it to the context.
    #[default]
    Forward,
    /// Select a predecessor and prepend it to the context.
    Backward,
}

impl Direction {
    fn is_forward(self) -> bool {
        matches!(self, Self::Forward)
    }
}

/// Options for bounded sequence generation.
///
/// The model has no string delimiters, and generated values are always actual
/// caller values.  `must_contain` and `must_not_contain` are generic value
/// constraints; application-specific predicates belong in the caller.
#[derive(Clone, Debug)]
pub struct GenerateOptions<T: Clone + Ord> {
    /// Existing values to continue from.  Forward generation treats this as
    /// a prefix; backward generation treats it as the current suffix anchor.
    pub start: Option<Vec<T>>,
    /// Maximum context order to use.  `None` uses the model's max order.
    pub order: Option<usize>,
    /// Minimum number of generated values.
    pub min: usize,
    /// Maximum number of generated values.
    pub max: usize,
    /// Traversal direction.
    pub direction: Direction,
    /// Require an exact context of the requested order.  When false, the
    /// longest available shorter context is used.
    pub strict: bool,
    /// Values that must occur in the returned sequence.
    pub must_contain: Vec<T>,
    /// Values that must not occur in the returned sequence.
    pub must_not_contain: Vec<T>,
    /// Maximum complete paths to try while satisfying value constraints.
    pub max_attempts: usize,
}

impl<T: Clone + Ord> Default for GenerateOptions<T> {
    fn default() -> Self {
        Self {
            start: None,
            order: None,
            min: 0,
            max: 64,
            direction: Direction::Forward,
            strict: false,
            must_contain: Vec::new(),
            must_not_contain: Vec::new(),
            max_attempts: 1,
        }
    }
}

/// A portable forward transition.
#[derive(Clone, Debug, PartialEq)]
pub struct TransitionData<T> {
    pub context: Vec<T>,
    pub next: T,
    pub weight: f64,
}

/// A portable boundary transition.  `end` means the context can terminate
/// during forward traversal; `start` means it can terminate during backward
/// traversal.
#[derive(Clone, Debug, PartialEq)]
pub struct BoundaryData<T> {
    pub context: Vec<T>,
    pub weight: f64,
}

/// Portable model data independent of any random state.
#[derive(Clone, Debug, PartialEq)]
pub struct MarkovData<T> {
    pub max_order: usize,
    pub sequence_count: usize,
    pub forward: Vec<TransitionData<T>>,
    pub backward: Vec<TransitionData<T>>,
    pub end: Vec<BoundaryData<T>>,
    pub start: Vec<BoundaryData<T>>,
}

#[derive(Clone, Debug)]
struct Node<T: Clone + Ord> {
    next: BTreeMap<T, f64>,
    prev: BTreeMap<T, f64>,
    end_weight: f64,
    start_weight: f64,
    frequency: usize,
}

impl<T: Clone + Ord> Default for Node<T> {
    fn default() -> Self {
        Self {
            next: BTreeMap::new(),
            prev: BTreeMap::new(),
            end_weight: 0.0,
            start_weight: 0.0,
            frequency: 0,
        }
    }
}

/// Summary statistics for a Markov model.
#[derive(Clone, Debug, PartialEq)]
pub struct MarkovStats {
    pub gram_count: usize,
    pub sequence_count: usize,
    pub order_range: (usize, usize),
    pub avg_degree_in: f64,
    pub avg_degree_out: f64,
}

/// A score for one sequence under a model.
#[derive(Clone, Debug, PartialEq)]
pub struct Score<T> {
    pub sequence: Vec<T>,
    pub log_prob: f64,
    pub perplexity: f64,
    pub is_valid: bool,
    pub normalized: f64,
}

/// Strategy used by [`Markov::blend`].
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum BlendStrategy {
    /// Weighted arithmetic mean of row probabilities.
    #[default]
    Arithmetic,
    /// Weighted geometric mean of positive row probabilities.
    Geometric,
    /// Weighted harmonic mean of positive row probabilities.
    Harmonic,
    /// Maximum row probability.
    Max,
    /// Minimum positive row probability.
    Min,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Choice {
    Empty,
    Boundary,
    Value,
}

/// A typed Markov model with one mutable learning path.
#[derive(Clone, Debug)]
pub struct Markov<T: Clone + Ord> {
    max_order: usize,
    nodes: BTreeMap<Vec<T>, Node<T>>,
    sequence_count: usize,
}

impl<T: Clone + Ord> Markov<T> {
    /// Create an empty model with the requested maximum context order.
    pub fn new(max_order: usize) -> Result<Self, Error> {
        if max_order == 0 {
            return Err(Error::InvalidParameter(
                "max_order must be greater than zero".to_owned(),
            ));
        }
        let mut model = Self {
            max_order,
            nodes: BTreeMap::new(),
            sequence_count: 0,
        };
        model.nodes.insert(Vec::new(), Node::default());
        Ok(model)
    }

    /// Maximum context order configured for this model.
    pub fn max_order(&self) -> usize {
        self.max_order
    }

    /// Learn owned sequences through the same transition insertion path used
    /// by all other model updates.
    pub fn learn<I, S>(&mut self, sequences: I) -> Result<(), Error>
    where
        I: IntoIterator<Item = S>,
        S: IntoIterator<Item = T>,
    {
        for sequence in sequences {
            let values: Vec<T> = sequence.into_iter().collect();
            self.sequence_count = self.sequence_count.saturating_add(1);
            self.learn_one(&values)?;
        }
        Ok(())
    }

    fn learn_one(&mut self, sequence: &[T]) -> Result<(), Error> {
        if sequence.is_empty() {
            self.add_boundary_internal(&[], true, 1.0)?;
            self.add_boundary_internal(&[], false, 1.0)?;
            return Ok(());
        }

        // Forward n-grams.  Every order is inserted so weighted transitions
        // remain meaningful when a caller requests a smaller order.
        for index in 0..sequence.len() {
            let max_len = self.max_order.min(index);
            if max_len == 0 {
                self.add_transition_internal(&[], sequence[index].clone(), 1.0)?;
            } else {
                for length in 1..=max_len {
                    let context = &sequence[index - length..index];
                    self.add_transition_internal(context, sequence[index].clone(), 1.0)?;
                }
            }
        }

        // Reverse n-grams.  A backward context is a natural-order prefix of
        // the remaining suffix: [b, c] selects a predecessor of b.
        for index in 0..sequence.len() {
            let max_len = self.max_order.min(sequence.len() - index);
            for length in 1..=max_len {
                let context = &sequence[index..index + length];
                if index == 0 {
                    self.add_boundary_internal(context, false, 1.0)?;
                } else {
                    self.add_reverse_internal(context, sequence[index - 1].clone(), 1.0)?;
                }
            }
        }

        for length in 1..=sequence.len().min(self.max_order) {
            let context = &sequence[sequence.len() - length..];
            self.add_boundary_internal(context, true, 1.0)?;
        }
        // The final value is the predecessor of the typed end marker for a
        // backward walk with no supplied anchor.
        self.add_reverse_internal(&[], sequence[sequence.len() - 1].clone(), 1.0)?;
        Ok(())
    }

    /// Add or accumulate a weighted forward transition.
    pub fn add_transition(&mut self, context: &[T], next: T, weight: f64) -> Result<(), Error> {
        self.validate_context(context)?;
        self.validate_weight(weight)?;
        if weight == 0.0 {
            return Ok(());
        }

        // An authored edge also describes the corresponding reverse walk.
        // For a context [a, b] and next c, the reverse rows [c] -> b and
        // [b, c] -> a make the edge usable from either end without exposing a
        // second direction-specific mutation API.
        let mut path = context.to_vec();
        path.push(next.clone());
        self.validate_transition_row(context, true, &next, weight)?;
        let max_reverse = path.len().min(self.max_order);
        for length in 1..=max_reverse {
            let start = path.len() - length;
            let reverse_context = &path[start..];
            if start == 0 {
                self.validate_boundary_row(reverse_context, false, weight)?;
            } else {
                self.validate_reverse_row(reverse_context, &path[start - 1], weight)?;
            }
        }

        self.add_transition_internal(context, next, weight)?;
        for length in 1..=max_reverse {
            let start = path.len() - length;
            let reverse_context = &path[start..];
            if start == 0 {
                self.add_boundary_internal(reverse_context, false, weight)?;
            } else {
                self.add_reverse_internal(reverse_context, path[start - 1].clone(), weight)?;
            }
        }
        Ok(())
    }

    /// Add or accumulate a weighted transition to the typed end marker.
    pub fn add_end_transition(&mut self, context: &[T], weight: f64) -> Result<(), Error> {
        self.validate_context(context)?;
        self.validate_weight(weight)?;
        if weight == 0.0 {
            return Ok(());
        }
        self.validate_boundary_row(context, true, weight)?;
        if let Some(last) = context.last() {
            self.validate_reverse_row(&[], last, weight)?;
        }
        self.add_boundary_internal(context, true, weight)?;
        if let Some(last) = context.last() {
            self.add_reverse_internal(&[], last.clone(), weight)?;
        }
        Ok(())
    }

    /// Select one value from the requested row.  `None` means either no row
    /// exists or the typed boundary was selected.
    pub fn step(
        &self,
        context: &[T],
        rng: &mut Rng,
        direction: Direction,
    ) -> Result<Option<T>, Error> {
        let node = self.resolve_node(context, self.max_order, false, direction.is_forward());
        let Some(node) = node else {
            return Ok(None);
        };
        if direction.is_forward() {
            let choice = choose_row(&node.next, node.end_weight, rng)?;
            if choice.0 == Choice::Value {
                return Ok(choice.1);
            }
        } else {
            let choice = choose_row(&node.prev, node.start_weight, rng)?;
            if choice.0 == Choice::Value {
                return Ok(choice.1);
            }
        }
        Ok(None)
    }

    /// Generate a bounded path.  Every failed constraint attempt returns an
    /// error after the configured retry budget; no invalid partial path is
    /// presented as a successful result.
    pub fn generate(&self, rng: &mut Rng, options: GenerateOptions<T>) -> Result<Vec<T>, Error> {
        if options.min > options.max {
            return Err(Error::InvalidParameter(
                "generation min must be less than or equal to max".to_owned(),
            ));
        }
        let order = options.order.unwrap_or(self.max_order);
        if order == 0 || order > self.max_order {
            return Err(Error::InvalidParameter(
                "generation order must be between 1 and max_order".to_owned(),
            ));
        }

        let attempts = options.max_attempts.max(1);

        for attempt in 0..attempts {
            match self.generate_once(rng, &options, order) {
                Ok(candidate) if self.accepts(&candidate, &options) => return Ok(candidate),
                Ok(_) | Err(Error::GenerationExhausted { .. }) => {
                    if attempt + 1 == attempts {
                        return Err(Error::GenerationExhausted { attempts });
                    }
                }
                Err(error) => return Err(error),
            }
        }
        Err(Error::GenerationExhausted { attempts })
    }

    fn generate_once(
        &self,
        rng: &mut Rng,
        options: &GenerateOptions<T>,
        order: usize,
    ) -> Result<Vec<T>, Error> {
        let forward = options.direction.is_forward();
        let mut output = options.start.clone().unwrap_or_default();
        if output.len() > options.max {
            return Err(Error::GenerationExhausted { attempts: 1 });
        }

        // An explicitly supplied anchor is already part of the result.  A
        // cold start must draw its first value from the typed start/end row.
        loop {
            let length = output.len();
            if length >= options.max {
                if length >= options.min {
                    return Ok(output);
                }
                return Err(Error::GenerationExhausted { attempts: 1 });
            }

            let context = context_for(&output, order, forward);
            let Some(node) = self.resolve_node(&context, order, options.strict, forward) else {
                return Err(Error::GenerationExhausted { attempts: 1 });
            };
            let can_end = length >= options.min;
            let (choice, value) = if forward {
                choose_row(&node.next, if can_end { node.end_weight } else { 0.0 }, rng)?
            } else {
                choose_row(
                    &node.prev,
                    if can_end { node.start_weight } else { 0.0 },
                    rng,
                )?
            };

            match choice {
                Choice::Value => {
                    let Some(value) = value else {
                        return Err(Error::GenerationExhausted { attempts: 1 });
                    };
                    if forward {
                        output.push(value);
                    } else {
                        output.insert(0, value);
                    }
                }
                Choice::Boundary => {
                    if length >= options.min {
                        return Ok(output);
                    }
                    return Err(Error::GenerationExhausted { attempts: 1 });
                }
                Choice::Empty => return Err(Error::GenerationExhausted { attempts: 1 }),
            }
        }
    }

    fn accepts(&self, candidate: &[T], options: &GenerateOptions<T>) -> bool {
        if candidate.len() < options.min || candidate.len() > options.max {
            return false;
        }
        options
            .must_contain
            .iter()
            .all(|value| candidate.contains(value))
            && options
                .must_not_contain
                .iter()
                .all(|value| !candidate.contains(value))
    }

    /// Score every transition, including the typed start and end boundaries.
    /// One unsupported transition makes the sequence invalid.
    pub fn score(&self, sequence: &[T]) -> Score<T> {
        self.score_with_order(sequence, self.max_order)
    }

    fn score_with_order(&self, sequence: &[T], order: usize) -> Score<T> {
        if order == 0 || order > self.max_order {
            return Score {
                sequence: sequence.to_vec(),
                log_prob: f64::NEG_INFINITY,
                perplexity: f64::INFINITY,
                is_valid: false,
                normalized: f64::NEG_INFINITY,
            };
        }

        let mut log_prob = 0.0;
        let mut transition_count = 0usize;
        let mut valid = true;

        for index in 0..sequence.len() {
            let context = context_for(&sequence[..index], order, true);
            let Some(node) = self.resolve_node(&context, order, false, true) else {
                valid = false;
                continue;
            };
            let weight = node.next.get(&sequence[index]).copied().unwrap_or(0.0);
            let total = row_total(&node.next, node.end_weight);
            if weight <= 0.0 || total <= 0.0 {
                valid = false;
                continue;
            }
            log_prob += (weight / total).ln();
            transition_count += 1;
        }

        let end_context = context_for(sequence, order, true);
        let end_weight = self
            .resolve_node(&end_context, order, false, true)
            .map(|node| node.end_weight)
            .unwrap_or(0.0);
        let end_total = self
            .resolve_node(&end_context, order, false, true)
            .map(|node| row_total(&node.next, node.end_weight))
            .unwrap_or(0.0);
        if end_weight <= 0.0 || end_total <= 0.0 {
            valid = false;
        } else {
            log_prob += (end_weight / end_total).ln();
            transition_count += 1;
        }

        if !valid {
            Score {
                sequence: sequence.to_vec(),
                log_prob: f64::NEG_INFINITY,
                perplexity: f64::INFINITY,
                is_valid: false,
                normalized: f64::NEG_INFINITY,
            }
        } else {
            let normalized = log_prob / transition_count as f64;
            Score {
                sequence: sequence.to_vec(),
                log_prob,
                perplexity: (-normalized).exp(),
                is_valid: true,
                normalized,
            }
        }
    }

    /// Return model topology statistics.
    pub fn stats(&self) -> MarkovStats {
        let nonempty: Vec<&Vec<T>> = self
            .nodes
            .keys()
            .filter(|context| !context.is_empty())
            .collect();
        let min_order = nonempty
            .iter()
            .map(|context| context.len())
            .min()
            .unwrap_or(0);
        let max_order = nonempty
            .iter()
            .map(|context| context.len())
            .max()
            .unwrap_or(0);
        let node_count = self.nodes.len();
        if node_count == 0 {
            return MarkovStats {
                gram_count: 0,
                sequence_count: self.sequence_count,
                order_range: (0, 0),
                avg_degree_in: 0.0,
                avg_degree_out: 0.0,
            };
        }
        let mut degree_in = 0usize;
        let mut degree_out = 0usize;
        for node in self.nodes.values() {
            degree_in += node.prev.len() + usize::from(node.start_weight > 0.0);
            degree_out += node.next.len() + usize::from(node.end_weight > 0.0);
        }
        MarkovStats {
            gram_count: node_count,
            sequence_count: self.sequence_count,
            order_range: (min_order, max_order),
            avg_degree_in: degree_in as f64 / node_count as f64,
            avg_degree_out: degree_out as f64 / node_count as f64,
        }
    }

    /// Whether a context node exists exactly as supplied.
    pub fn has_gram(&self, context: &[T]) -> bool {
        self.nodes.contains_key(context)
    }

    /// Export sorted, portable model data.
    pub fn to_data(&self) -> MarkovData<T> {
        let mut forward = Vec::new();
        let mut backward = Vec::new();
        let mut end = Vec::new();
        let mut start = Vec::new();
        for (context, node) in &self.nodes {
            for (next, weight) in &node.next {
                forward.push(TransitionData {
                    context: context.clone(),
                    next: next.clone(),
                    weight: *weight,
                });
            }
            for (prev, weight) in &node.prev {
                backward.push(TransitionData {
                    context: context.clone(),
                    next: prev.clone(),
                    weight: *weight,
                });
            }
            if node.end_weight > 0.0 {
                end.push(BoundaryData {
                    context: context.clone(),
                    weight: node.end_weight,
                });
            }
            if node.start_weight > 0.0 {
                start.push(BoundaryData {
                    context: context.clone(),
                    weight: node.start_weight,
                });
            }
        }
        MarkovData {
            max_order: self.max_order,
            sequence_count: self.sequence_count,
            forward,
            backward,
            end,
            start,
        }
    }

    /// Restore a model from portable data after validating every row.
    pub fn from_data(data: MarkovData<T>) -> Result<Self, Error> {
        let mut model = Self::new(data.max_order)?;
        model.sequence_count = data.sequence_count;
        for transition in data.forward {
            model.validate_context(&transition.context)?;
            model.validate_weight(transition.weight)?;
            model.add_transition_internal(
                &transition.context,
                transition.next,
                transition.weight,
            )?;
        }
        for transition in data.backward {
            model.validate_context(&transition.context)?;
            model.validate_weight(transition.weight)?;
            model.add_reverse_internal(&transition.context, transition.next, transition.weight)?;
        }
        for boundary in data.end {
            model.validate_context(&boundary.context)?;
            model.validate_weight(boundary.weight)?;
            model.add_boundary_internal(&boundary.context, true, boundary.weight)?;
        }
        for boundary in data.start {
            model.validate_context(&boundary.context)?;
            model.validate_weight(boundary.weight)?;
            model.add_boundary_internal(&boundary.context, false, boundary.weight)?;
        }
        Ok(model)
    }

    /// Blend borrowed models by weighted row probabilities.
    pub fn blend<'a, I>(models: I, strategy: BlendStrategy) -> Result<Self, Error>
    where
        I: IntoIterator<Item = (&'a Self, f64)>,
        T: 'a,
    {
        let models: Vec<(&Self, f64)> = models.into_iter().collect();
        if models.is_empty() {
            return Err(Error::InvalidModel("cannot blend zero models".to_owned()));
        }
        let mut total_weight = 0.0;
        for (_, weight) in &models {
            if !weight.is_finite() || *weight < 0.0 {
                return Err(Error::InvalidParameter(
                    "blend weights must be finite and non-negative".to_owned(),
                ));
            }
            total_weight += *weight;
        }
        if !total_weight.is_finite() || total_weight <= 0.0 {
            return Err(Error::InvalidParameter(
                "blend weights must have a positive total".to_owned(),
            ));
        }
        let max_order = models[0].0.max_order;
        if models.iter().any(|(model, _)| model.max_order != max_order) {
            return Err(Error::InvalidModel(
                "blended models must have the same max_order".to_owned(),
            ));
        }
        let mut result = Self::new(max_order)?;

        let mut contexts = BTreeSet::new();
        for (model, _) in &models {
            contexts.extend(model.nodes.keys().cloned());
        }
        for context in contexts {
            let (next, end_weight) = blend_side(&models, &context, strategy, true, total_weight);
            for (value, weight) in next {
                result.add_transition_internal(&context, value, weight)?;
            }
            if end_weight > 0.0 {
                result.add_boundary_internal(&context, true, end_weight)?;
            }
            let (prev, start_weight) = blend_side(&models, &context, strategy, false, total_weight);
            for (value, weight) in prev {
                result.add_reverse_internal(&context, value, weight)?;
            }
            if start_weight > 0.0 {
                result.add_boundary_internal(&context, false, start_weight)?;
            }
        }
        Ok(result)
    }

    fn validate_context(&self, context: &[T]) -> Result<(), Error> {
        if context.len() > self.max_order {
            return Err(Error::InvalidParameter(
                "transition context is longer than max_order".to_owned(),
            ));
        }
        Ok(())
    }

    fn validate_weight(&self, weight: f64) -> Result<(), Error> {
        if !weight.is_finite() || weight < 0.0 {
            return Err(Error::InvalidParameter(
                "transition weight must be finite and non-negative".to_owned(),
            ));
        }
        Ok(())
    }

    fn validate_transition_row(
        &self,
        context: &[T],
        forward: bool,
        value: &T,
        weight: f64,
    ) -> Result<(), Error> {
        let node = self.nodes.get(context);
        let (values, boundary) = match node {
            Some(node) if forward => (&node.next, node.end_weight),
            Some(node) => (&node.prev, node.start_weight),
            None => return Ok(()),
        };
        validate_edge_total(values, boundary, value, weight)
    }

    fn validate_reverse_row(&self, context: &[T], value: &T, weight: f64) -> Result<(), Error> {
        self.validate_transition_row(context, false, value, weight)
    }

    fn validate_boundary_row(&self, context: &[T], end: bool, weight: f64) -> Result<(), Error> {
        let node = self.nodes.get(context);
        let (values, boundary) = match node {
            Some(node) if end => (&node.next, node.end_weight),
            Some(node) => (&node.prev, node.start_weight),
            None => return Ok(()),
        };
        validate_boundary_total(values, boundary, weight)
    }

    fn add_transition_internal(
        &mut self,
        context: &[T],
        next: T,
        weight: f64,
    ) -> Result<(), Error> {
        if weight == 0.0 {
            return Ok(());
        }
        self.validate_transition_row(context, true, &next, weight)?;
        let node = self.nodes.entry(context.to_vec()).or_default();
        let entry = node.next.entry(next).or_insert(0.0);
        *entry += weight;
        node.frequency = node.frequency.saturating_add(1);
        Ok(())
    }

    fn add_reverse_internal(&mut self, context: &[T], prev: T, weight: f64) -> Result<(), Error> {
        if weight == 0.0 {
            return Ok(());
        }
        self.validate_reverse_row(context, &prev, weight)?;
        let node = self.nodes.entry(context.to_vec()).or_default();
        let entry = node.prev.entry(prev).or_insert(0.0);
        *entry += weight;
        node.frequency = node.frequency.saturating_add(1);
        Ok(())
    }

    fn add_boundary_internal(
        &mut self,
        context: &[T],
        end: bool,
        weight: f64,
    ) -> Result<(), Error> {
        if weight == 0.0 {
            return Ok(());
        }
        self.validate_boundary_row(context, end, weight)?;
        let node = self.nodes.entry(context.to_vec()).or_default();
        if end {
            node.end_weight += weight;
        } else {
            node.start_weight += weight;
        }
        node.frequency = node.frequency.saturating_add(1);
        Ok(())
    }

    fn resolve_node(
        &self,
        context: &[T],
        order: usize,
        strict: bool,
        forward: bool,
    ) -> Option<&Node<T>> {
        let limit = order.min(self.max_order).min(context.len());
        if strict {
            let exact = if forward {
                &context[context.len().saturating_sub(limit)..]
            } else {
                &context[..limit]
            };
            return self.nodes.get(exact);
        }
        for length in (1..=limit).rev() {
            let candidate = if forward {
                &context[context.len() - length..]
            } else {
                &context[..length]
            };
            if let Some(node) = self.nodes.get(candidate) {
                return Some(node);
            }
        }
        if context.is_empty() {
            self.nodes.get(&Vec::new())
        } else {
            None
        }
    }
}

fn validate_edge_total<T: Clone + Ord>(
    values: &BTreeMap<T, f64>,
    boundary: f64,
    value: &T,
    weight: f64,
) -> Result<(), Error> {
    let mut total = 0.0;
    let mut found = false;
    for (existing, current) in values {
        let amount = if existing == value {
            found = true;
            *current + weight
        } else {
            *current
        };
        if !amount.is_finite() || amount < 0.0 {
            return Err(Error::InvalidParameter(
                "transition weight sum must remain finite".to_owned(),
            ));
        }
        total += amount;
        if !total.is_finite() {
            return Err(Error::InvalidParameter(
                "transition row total must remain finite".to_owned(),
            ));
        }
    }
    if !found {
        total += weight;
        if !total.is_finite() {
            return Err(Error::InvalidParameter(
                "transition row total must remain finite".to_owned(),
            ));
        }
    }
    total += boundary;
    if !total.is_finite() || total < 0.0 {
        return Err(Error::InvalidParameter(
            "transition row total must remain finite".to_owned(),
        ));
    }
    Ok(())
}

fn validate_boundary_total<T: Clone + Ord>(
    values: &BTreeMap<T, f64>,
    boundary: f64,
    weight: f64,
) -> Result<(), Error> {
    let mut total = 0.0;
    for current in values.values() {
        if !current.is_finite() || *current < 0.0 {
            return Err(Error::InvalidParameter(
                "transition weight sum must remain finite".to_owned(),
            ));
        }
        total += *current;
        if !total.is_finite() {
            return Err(Error::InvalidParameter(
                "transition row total must remain finite".to_owned(),
            ));
        }
    }
    total += boundary;
    if !total.is_finite() || total < 0.0 {
        return Err(Error::InvalidParameter(
            "transition row total must remain finite".to_owned(),
        ));
    }
    total += weight;
    if !total.is_finite() || total < 0.0 {
        return Err(Error::InvalidParameter(
            "transition row total must remain finite".to_owned(),
        ));
    }
    Ok(())
}

fn context_for<T: Clone + Ord>(values: &[T], order: usize, forward: bool) -> Vec<T> {
    if values.is_empty() {
        return Vec::new();
    }
    if forward {
        values[values.len().saturating_sub(order)..].to_vec()
    } else {
        values[..values.len().min(order)].to_vec()
    }
}

fn row_total<T: Clone + Ord>(values: &BTreeMap<T, f64>, boundary: f64) -> f64 {
    values.values().copied().sum::<f64>() + boundary
}

fn choose_row<T: Clone + Ord>(
    values: &BTreeMap<T, f64>,
    boundary: f64,
    rng: &mut Rng,
) -> Result<(Choice, Option<T>), Error> {
    let total = row_total(values, boundary);
    if !total.is_finite() || total <= 0.0 {
        return Ok((Choice::Empty, None));
    }
    let draw = rng.float(0.0, total)?;
    let mut cumulative = 0.0;
    for (value, weight) in values {
        cumulative += *weight;
        if draw < cumulative {
            return Ok((Choice::Value, Some(value.clone())));
        }
    }
    if boundary > 0.0 {
        return Ok((Choice::Boundary, None));
    }
    // Protect against a floating-point draw at the upper edge of the row.
    values
        .iter()
        .next_back()
        .map(|(value, _)| (Choice::Value, Some(value.clone())))
        .ok_or(Error::EmptySupport)
}

fn blend_side<T: Clone + Ord>(
    models: &[(&Markov<T>, f64)],
    context: &[T],
    strategy: BlendStrategy,
    forward: bool,
    total_weight: f64,
) -> (BTreeMap<T, f64>, f64) {
    let mut values = BTreeSet::new();
    for (model, _) in models {
        if let Some(node) = model.nodes.get(context) {
            let row = if forward { &node.next } else { &node.prev };
            values.extend(row.keys().cloned());
        }
    }

    let probabilities = |model: &Markov<T>, value: Option<&T>| {
        let Some(node) = model.nodes.get(context) else {
            return 0.0;
        };
        let row = if forward { &node.next } else { &node.prev };
        let boundary = if forward {
            node.end_weight
        } else {
            node.start_weight
        };
        let total = row_total(row, boundary);
        if total <= 0.0 {
            return 0.0;
        }
        value.map_or(boundary / total, |key| {
            row.get(key).copied().unwrap_or(0.0) / total
        })
    };

    let combine = |value: Option<&T>| -> f64 {
        let entries: Vec<(f64, f64)> = models
            .iter()
            .map(|(model, weight)| (probabilities(model, value), *weight / total_weight))
            .collect();
        match strategy {
            BlendStrategy::Arithmetic => entries.iter().map(|(p, w)| p * w).sum(),
            BlendStrategy::Geometric => {
                let positive: Vec<(f64, f64)> =
                    entries.iter().copied().filter(|(p, _)| *p > 0.0).collect();
                let sum: f64 = positive.iter().map(|(_, weight)| *weight).sum();
                if sum <= 0.0 {
                    0.0
                } else {
                    positive
                        .iter()
                        .map(|(p, weight)| p.powf(*weight / sum))
                        .product()
                }
            }
            BlendStrategy::Harmonic => {
                let positive: Vec<(f64, f64)> =
                    entries.iter().copied().filter(|(p, _)| *p > 0.0).collect();
                let sum: f64 = positive.iter().map(|(_, weight)| *weight).sum();
                if sum <= 0.0 {
                    0.0
                } else {
                    let reciprocal: f64 =
                        positive.iter().map(|(p, weight)| (weight / sum) / p).sum();
                    if reciprocal > 0.0 {
                        1.0 / reciprocal
                    } else {
                        0.0
                    }
                }
            }
            BlendStrategy::Max => entries.iter().map(|(p, _)| *p).fold(0.0, f64::max),
            BlendStrategy::Min => {
                let minimum = entries
                    .iter()
                    .map(|(p, _)| *p)
                    .filter(|p| *p > 0.0)
                    .fold(f64::INFINITY, f64::min);
                if minimum.is_finite() { minimum } else { 0.0 }
            }
        }
    };

    let mut result = BTreeMap::new();
    for value in values {
        let weight = combine(Some(&value));
        if weight.is_finite() && weight > 0.0 {
            result.insert(value, weight);
        }
    }
    let boundary = combine(None);
    (result, if boundary.is_finite() { boundary } else { 0.0 })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rng(seed: u32) -> Rng {
        Rng::seeded(seed)
    }

    #[test]
    fn learns_and_generates_name_with_real_rng() {
        let mut model = Markov::new(2).expect("order");
        model
            .learn([
                "alice".chars().collect::<Vec<_>>(),
                "alina".chars().collect::<Vec<_>>(),
                "bob".chars().collect::<Vec<_>>(),
            ])
            .expect("learn");
        let mut random = rng(33);
        let output = model
            .generate(
                &mut random,
                GenerateOptions {
                    min: 2,
                    max: 12,
                    ..GenerateOptions::default()
                },
            )
            .expect("name generation");
        assert!((2..=12).contains(&output.len()));
        assert!(model.score(&output).is_valid);
    }

    #[test]
    fn weighted_authored_path_and_end_are_respected() {
        let mut model = Markov::new(2).expect("order");
        model.add_transition(&[], "common", 9.0).expect("edge");
        model.add_transition(&[], "rare", 1.0).expect("edge");
        model.add_end_transition(&["common"], 1.0).expect("end");
        model.add_end_transition(&["rare"], 1.0).expect("end");
        let mut random = rng(4);
        let value = model
            .step(&[], &mut random, Direction::Forward)
            .expect("step")
            .expect("value");
        assert!(value == "common" || value == "rare");
    }

    #[test]
    fn backward_generation_walks_to_start() {
        let mut model = Markov::new(2).expect("order");
        model.learn([vec!['a', 'b', 'c']]).expect("learn");
        let mut random = rng(7);
        let output = model
            .generate(
                &mut random,
                GenerateOptions {
                    min: 3,
                    max: 3,
                    direction: Direction::Backward,
                    ..GenerateOptions::default()
                },
            )
            .expect("backward path");
        assert_eq!(output, vec!['a', 'b', 'c']);
    }

    #[test]
    fn score_rejects_unsupported_later_transition() {
        let mut model = Markov::new(2).expect("order");
        model.learn([vec!["a", "b"]]).expect("learn");
        let score = model.score(&["a", "z"]);
        assert!(!score.is_valid);
        assert_eq!(score.perplexity, f64::INFINITY);
    }

    #[test]
    fn arbitrary_values_do_not_collide_with_boundaries() {
        let mut model = Markov::new(2).expect("order");
        model.learn([vec!["<START>", "<END>"]]).expect("learn");
        let mut random = rng(9);
        let output = model
            .generate(
                &mut random,
                GenerateOptions {
                    min: 2,
                    max: 2,
                    ..GenerateOptions::default()
                },
            )
            .expect("boundary-safe path");
        assert_eq!(output, vec!["<START>", "<END>"]);
    }

    #[test]
    fn portable_data_round_trips() {
        let mut model = Markov::new(2).expect("order");
        model.learn([vec![1, 2, 3], vec![1, 2, 4]]).expect("learn");
        let restored = Markov::from_data(model.to_data()).expect("restore");
        assert_eq!(restored.to_data(), model.to_data());
    }

    #[test]
    fn authored_edges_support_backward_traversal() {
        let mut model = Markov::new(2).expect("order");
        model.add_transition(&["a"], "b", 1.0).expect("edge");
        let mut random = rng(5);
        assert_eq!(
            model
                .step(&["b"], &mut random, Direction::Backward)
                .expect("step"),
            Some("a")
        );
    }

    #[test]
    fn row_total_overflow_is_rejected_without_mutation() {
        let mut forward = Markov::new(1).expect("order");
        forward
            .add_transition(&[], "a", f64::MAX)
            .expect("first edge");
        assert!(forward.add_transition(&[], "b", f64::MAX).is_err());
        let mut random = rng(6);
        assert_eq!(
            forward
                .step(&[], &mut random, Direction::Forward)
                .expect("step"),
            Some("a")
        );

        let mut reverse = Markov::new(2).expect("order");
        reverse
            .add_transition(&["a"], "b", f64::MAX)
            .expect("first reverse edge");
        assert!(reverse.add_transition(&["c"], "b", f64::MAX).is_err());
        let mut random = rng(7);
        assert_eq!(
            reverse
                .step(&["b"], &mut random, Direction::Backward)
                .expect("reverse step"),
            Some("a")
        );
    }

    #[test]
    fn from_data_rejects_overflow_and_does_not_double_count_edges() {
        let overflow = MarkovData {
            max_order: 1,
            sequence_count: 0,
            forward: vec![
                TransitionData {
                    context: vec![],
                    next: "a",
                    weight: f64::MAX,
                },
                TransitionData {
                    context: vec![],
                    next: "b",
                    weight: f64::MAX,
                },
            ],
            backward: Vec::new(),
            end: Vec::new(),
            start: Vec::new(),
        };
        assert!(Markov::from_data(overflow).is_err());

        let mut model = Markov::new(1).expect("order");
        model.add_transition(&[], "a", 2.0).expect("edge");
        let data = model.to_data();
        let restored = Markov::from_data(data.clone()).expect("restore");
        assert_eq!(restored.to_data(), data);
    }

    #[test]
    fn exhaustion_is_an_error() {
        let model = Markov::<String>::new(1).expect("order");
        let mut random = rng(1);
        let result = model.generate(
            &mut random,
            GenerateOptions {
                min: 1,
                max: 3,
                ..GenerateOptions::default()
            },
        );
        assert!(matches!(result, Err(Error::GenerationExhausted { .. })));
    }

    #[test]
    fn generation_retries_exhausted_paths_when_budget_allows() {
        let mut model = Markov::new(2).expect("order");
        model.add_transition(&[], "short", 1.0).expect("edge");
        model.add_transition(&[], "long", 1.0).expect("edge");
        model
            .add_end_transition(&["short"], 1.0)
            .expect("short end");
        model
            .add_transition(&["long"], "x", 1.0)
            .expect("long edge");
        model
            .add_end_transition(&["long", "x"], 1.0)
            .expect("long end");

        let mut one_attempt = rng(0);
        assert!(
            model
                .generate(
                    &mut one_attempt,
                    GenerateOptions {
                        min: 2,
                        max: 3,
                        max_attempts: 1,
                        ..GenerateOptions::default()
                    },
                )
                .is_err()
        );

        let mut retries = rng(0);
        assert_eq!(
            model.generate(
                &mut retries,
                GenerateOptions {
                    min: 2,
                    max: 3,
                    max_attempts: 10,
                    ..GenerateOptions::default()
                },
            ),
            Ok(vec!["long", "x"])
        );
    }

    #[test]
    fn blend_keeps_union_of_weighted_paths() {
        let mut left = Markov::new(1).expect("order");
        left.add_transition(&[], "left", 1.0).expect("edge");
        left.add_end_transition(&["left"], 1.0).expect("end");
        let mut right = Markov::new(1).expect("order");
        right.add_transition(&[], "right", 1.0).expect("edge");
        right.add_end_transition(&["right"], 1.0).expect("end");
        let blended =
            Markov::blend([(&left, 0.5), (&right, 0.5)], BlendStrategy::Arithmetic).expect("blend");
        let mut random = rng(2);
        let value = blended
            .step(&[], &mut random, Direction::Forward)
            .expect("step")
            .expect("value");
        assert!(value == "left" || value == "right");
    }
}
