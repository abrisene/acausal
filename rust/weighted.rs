//! Generic weighted choices backed by one canonical raw-weight representation.

use crate::{Error, Rng};

/// Selection mode for [`Weighted::draw_many`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Replacement {
    With,
    Without,
}

impl Replacement {
    fn is_with_replacement(self) -> bool {
        matches!(self, Self::With)
    }
}

/// A weighted table.  Raw weights are the only stored representation; all
/// normalized probabilities are derived from them when requested.
#[derive(Debug, Clone, PartialEq)]
pub struct Weighted<T: Clone + PartialEq> {
    entries: Vec<(T, f64)>,
}

impl<T: Clone + PartialEq> Weighted<T> {
    /// Build a table from `(value, raw_weight)` pairs.
    ///
    /// Equal values are merged in insertion order.  The merge and every
    /// mutation are checked before changing the table, so failed operations
    /// leave the original table untouched.
    pub fn new<I>(entries: I) -> Result<Self, Error>
    where
        I: IntoIterator<Item = (T, f64)>,
    {
        let mut result = Self {
            entries: Vec::new(),
        };
        for (value, weight) in entries {
            validate_weight(weight)?;
            if let Some(index) = result.entries.iter().position(|(item, _)| item == &value) {
                let merged = result.entries[index].1 + weight;
                validate_weight(merged)?;
                result.entries[index].1 = merged;
            } else {
                result.entries.push((value, weight));
            }
            if !result.total_weight_unchecked().is_finite() {
                return Err(Error::InvalidParameter(
                    "weighted total must be finite".to_string(),
                ));
            }
        }
        Ok(result)
    }

    /// Borrow the canonical raw entries without allocating.
    pub fn entries(&self) -> &[(T, f64)] {
        &self.entries
    }

    /// Return normalized probabilities in the same order as [`Self::entries`].
    ///
    /// Zero-weight entries remain visible with probability zero.  An empty or
    /// zero-total table therefore returns all zero probabilities and draws
    /// still report [`Error::EmptySupport`] without consuming random state.
    pub fn probabilities(&self) -> Vec<(T, f64)> {
        let total = self.total_weight_unchecked();
        self.entries
            .iter()
            .map(|(value, weight)| {
                (
                    value.clone(),
                    if total > 0.0 { *weight / total } else { 0.0 },
                )
            })
            .collect()
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn weight(&self, value: &T) -> Option<f64> {
        self.entries
            .iter()
            .find(|(item, _)| item == value)
            .map(|(_, weight)| *weight)
    }

    pub fn total_weight(&self) -> f64 {
        self.total_weight_unchecked()
    }

    /// Add a signed adjustment.  A missing value can be introduced with a
    /// non-negative adjustment; a negative resulting weight is rejected.
    pub fn adjust(&mut self, value: T, delta: f64) -> Result<(), Error> {
        validate_finite(delta, "adjustment")?;
        if let Some(index) = self.entries.iter().position(|(item, _)| item == &value) {
            let new_weight = self.entries[index].1 + delta;
            validate_weight(new_weight)?;
            let total = self.total_weight_unchecked() - self.entries[index].1 + new_weight;
            if !total.is_finite() {
                return Err(Error::InvalidParameter(
                    "weighted total must be finite".to_string(),
                ));
            }
            self.entries[index].1 = new_weight;
            return Ok(());
        }
        validate_weight(delta)?;
        self.entries.push((value, delta));
        Ok(())
    }

    /// Set a value's raw weight, inserting it when it is absent.
    pub fn set(&mut self, value: T, weight: f64) -> Result<(), Error> {
        validate_weight(weight)?;
        if let Some(index) = self.entries.iter().position(|(item, _)| item == &value) {
            let total = self.total_weight_unchecked() - self.entries[index].1 + weight;
            if !total.is_finite() {
                return Err(Error::InvalidParameter(
                    "weighted total must be finite".to_string(),
                ));
            }
            self.entries[index].1 = weight;
        } else {
            if !(self.total_weight_unchecked() + weight).is_finite() {
                return Err(Error::InvalidParameter(
                    "weighted total must be finite".to_string(),
                ));
            }
            self.entries.push((value, weight));
        }
        Ok(())
    }

    /// Remove all entries equal to `value`.
    pub fn remove(&mut self, value: T) -> Result<(), Error> {
        self.entries.retain(|(item, _)| item != &value);
        Ok(())
    }

    /// Draw one supported value.  This consumes exactly one uniform real
    /// (two MT words) when support exists.
    pub fn draw<'a>(&'a self, rng: &mut Rng) -> Result<&'a T, Error> {
        self.draw_excluding(rng, &[])
    }

    /// Draw one supported value while masking equal values for this call.
    pub fn draw_excluding<'a>(&'a self, rng: &mut Rng, excluded: &[T]) -> Result<&'a T, Error> {
        let (indices, total) = self.support_indices(excluded);
        if indices.is_empty() || total <= 0.0 {
            return Err(Error::EmptySupport);
        }
        let needle = rng.float(0.0, 1.0)? * total;
        let mut cumulative = 0.0;
        let mut last_index = None;
        for index in indices {
            last_index = Some(index);
            cumulative += self.entries[index].1;
            if cumulative >= needle {
                return Ok(&self.entries[index].0);
            }
        }
        // The unit interval is half-open, so this is only a floating point
        // roundoff fallback at the end of the cumulative sum.
        let index = last_index.ok_or(Error::EmptySupport)?;
        Ok(&self.entries[index].0)
    }

    /// Draw multiple values, sharing the same single-draw implementation.
    /// Without replacement, the distinct support shortfall is checked before
    /// the first random word is consumed.
    pub fn draw_many(
        &self,
        rng: &mut Rng,
        count: usize,
        replacement: Replacement,
        excluded: &[T],
    ) -> Result<Vec<T>, Error> {
        if count == 0 {
            return Ok(Vec::new());
        }
        let (indices, _) = self.support_indices(excluded);
        if indices.is_empty() {
            return Err(Error::EmptySupport);
        }
        if !replacement.is_with_replacement() && count > indices.len() {
            return Err(Error::InsufficientSupport {
                requested: count,
                available: indices.len(),
            });
        }

        let mut result = Vec::with_capacity(count);
        if replacement.is_with_replacement() {
            for _ in 0..count {
                result.push(self.draw_excluding(rng, excluded)?.clone());
            }
            return Ok(result);
        }

        let mut mask = excluded.to_vec();
        for _ in 0..count {
            let value = self.draw_excluding(rng, &mask)?.clone();
            mask.push(value.clone());
            result.push(value);
        }
        Ok(result)
    }

    fn support_indices(&self, excluded: &[T]) -> (Vec<usize>, f64) {
        let mut total = 0.0;
        let mut indices = Vec::new();
        for (index, (value, weight)) in self.entries.iter().enumerate() {
            if *weight > 0.0 && !excluded.iter().any(|item| item == value) {
                total += *weight;
                indices.push(index);
            }
        }
        (indices, total)
    }

    fn total_weight_unchecked(&self) -> f64 {
        self.entries.iter().map(|(_, weight)| *weight).sum()
    }
}

fn validate_finite(value: f64, name: &str) -> Result<(), Error> {
    if value.is_finite() {
        Ok(())
    } else {
        Err(Error::InvalidParameter(format!(
            "weighted {name} must be finite"
        )))
    }
}

fn validate_weight(weight: f64) -> Result<(), Error> {
    if !weight.is_finite() || weight < 0.0 {
        return Err(Error::InvalidParameter(
            "weighted weight must be finite and >= 0".to_string(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weighted_draw_matches_typescript_fixture() {
        let table = Weighted::new([
            ("common", 60.0),
            ("uncommon", 25.0),
            ("rare", 12.0),
            ("legendary", 3.0),
        ])
        .unwrap();
        let mut rng = Rng::seeded(42);
        let expected = [
            "common",
            "common",
            "rare",
            "uncommon",
            "uncommon",
            "uncommon",
            "uncommon",
            "uncommon",
            "common",
            "common",
            "common",
            "legendary",
            "rare",
            "common",
            "uncommon",
            "rare",
        ];
        for value in expected {
            assert_eq!(*table.draw(&mut rng).unwrap(), value);
        }
        assert_eq!(rng.uses(), 2_032);
    }

    #[test]
    fn empty_and_shortfall_fail_without_consuming_state() {
        let empty = Weighted::<&str>::new([]).unwrap();
        let mut rng = Rng::seeded(42);
        assert_eq!(rng.uses(), 2_000);
        assert_eq!(empty.draw(&mut rng), Err(Error::EmptySupport));
        assert_eq!(rng.uses(), 2_000);

        let table = Weighted::new([("a", 1.0), ("b", 1.0)]).unwrap();
        assert_eq!(
            table.draw_many(&mut rng, 3, Replacement::Without, &[]),
            Err(Error::InsufficientSupport {
                requested: 3,
                available: 2
            })
        );
        assert_eq!(rng.uses(), 2_000);
    }

    #[test]
    fn mutation_is_atomic_and_duplicates_are_canonicalized() {
        let mut table = Weighted::new([("a", 1.0), ("a", 2.0), ("b", 0.0)]).unwrap();
        assert_eq!(table.entries(), &[("a", 3.0), ("b", 0.0)]);
        assert!(table.adjust("a", -4.0).is_err());
        assert_eq!(table.entries(), &[("a", 3.0), ("b", 0.0)]);
        assert_eq!(table.probabilities(), vec![("a", 1.0), ("b", 0.0)]);
    }
}
